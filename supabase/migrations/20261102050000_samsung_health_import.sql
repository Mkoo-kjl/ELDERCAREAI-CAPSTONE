alter table public.wearable_live_state add column sleep_hours double precision;
alter table public.wearable_live_state add column sleep_measured_at timestamptz;
alter table public.vital_sign_logs add column measurement_origin text check(measurement_origin in ('watch_sensor','samsung_health'));
alter table public.vital_sign_logs add column source_device_id text;
alter table public.vital_sign_logs add column source_record_key text;
alter table public.vital_sign_logs add column source_group_key text;
alter table public.vital_sign_logs add column source_revision_at timestamptz;
alter table public.vital_sign_logs add column if not exists is_superseded boolean not null default false;
update public.vital_sign_logs set measurement_origin='watch_sensor' where source='galaxy_watch';
drop index public.vital_watch_measurement_unique;
create unique index vital_watch_measurement_unique on public.vital_sign_logs(watch_device_id,watch_metric,watch_measured_at) where measurement_origin is distinct from 'samsung_health';
create unique index samsung_health_revision_unique on public.vital_sign_logs(elderly_id,source_device_id,source_record_key,source_revision_at) where measurement_origin='samsung_health';
create table public.samsung_health_links (
  elderly_id uuid primary key references public.elderly_profiles(elderly_id) on delete cascade,
  caregiver_id uuid not null references auth.users(id) on delete cascade,
  source_device_id text not null check(length(source_device_id) between 1 and 256),
  source_name text not null, linked_at timestamptz not null default now()
);
alter table public.samsung_health_links enable row level security;
grant select on public.samsung_health_links to authenticated;
grant all on public.samsung_health_links to service_role;
create policy own_samsung_link on public.samsung_health_links for select to authenticated
  using(caregiver_id=(select auth.uid()) and (select public.is_active_caregiver()));

create or replace function public.import_samsung_health(p_caregiver uuid,p_elderly uuid,p_source text,p_samples jsonb)
returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare device public.wearable_devices; sample jsonb; metric text; value double precision; measured timestamptz;
  revision timestamptz; previous_revision timestamptz; source_key text; group_key text; record_id uuid; count integer:=0;
  started timestamptz; ended timestamptz; asleep double precision; period double precision; obsolete boolean; sleep_data jsonb;
begin
  perform 1 from public.elderly_profiles e join public.user_access a on a.user_id=e.caregiver_id and a.role='caregiver' and a.status='active'
    join public.samsung_health_links l on l.elderly_id=e.elderly_id and l.caregiver_id=e.caregiver_id and l.source_device_id=p_source
    where e.elderly_id=p_elderly and e.caregiver_id=p_caregiver for update of e;
  if not found then raise exception 'Samsung Health source is not linked to this patient'; end if;
  select * into device from public.wearable_devices where elderly_id=p_elderly and caregiver_id=p_caregiver and revoked_at is null and expires_at>now() order by paired_at desc limit 1;
  if not found then raise exception 'Pair an active Galaxy Watch first'; end if;
  insert into public.wearable_live_state(elderly_id,device_id,monitoring,status_at) values(p_elderly,device.id,false,now()) on conflict(elderly_id) do nothing;
  if jsonb_typeof(p_samples)<>'array' or jsonb_array_length(p_samples)>120 then raise exception 'Invalid import batch'; end if;
  for sample in select * from jsonb_array_elements(p_samples) loop
    metric:=sample->>'metric';value:=(sample->>'value')::double precision;measured:=(sample->>'measured_at')::timestamptz;
    revision:=(sample->>'source_revision_at')::timestamptz;source_key:=sample->>'source_record_key';group_key:=sample->>'source_group_key';
    if source_key is null or length(source_key) not between 1 and 256 or group_key is null or length(group_key) not between 1 and 256 or measured is null or revision is null
      or measured<'2020-01-01'::timestamptz or revision<'2020-01-01'::timestamptz or measured>now()+interval '5 minutes' or revision>now()+interval '5 minutes'
      or value is null or not(case metric when 'sleep_hours' then value>0 and value<=24 when 'spo2_percent' then value>0 and value<=100 else false end)
      then raise exception 'Invalid Samsung Health sample'; end if;
    sleep_data:=null;
    if metric='sleep_hours' then
      started:=(sample->>'session_start_at')::timestamptz;ended:=(sample->>'session_end_at')::timestamptz;
      asleep:=(sample->>'minutes_asleep')::double precision;period:=(sample->>'minutes_in_sleep_period')::double precision;
      if started is null or ended is null or asleep is null or period is null or started<'2020-01-01'::timestamptz or period>2880 or ended<>measured or ended<=started
        or asleep<=0 or asleep>period+1 or abs(asleep/60-value)>0.0001 or abs(extract(epoch from ended-started)/60-period)>0.1
        then raise exception 'Invalid sleep session'; end if;
      sleep_data:=jsonb_build_array(jsonb_build_object('source_key','samsung_health:'||p_source||':'||source_key,
        'session_start_at',started,'session_end_at',ended,'minutes_asleep',asleep,'minutes_in_sleep_period',period,'is_main_sleep',false,'is_processed',true));
    end if;
    select max(source_revision_at) into previous_revision from public.vital_sign_logs where elderly_id=p_elderly and measurement_origin='samsung_health'
      and source_device_id=p_source and source_group_key=group_key;
    obsolete:=coalesce(previous_revision>revision,false);
    record_id:=null;
    insert into public.vital_sign_logs(elderly_id,source,recorded_at,synced_at,measurement_times,watch_device_id,watch_metric,watch_measured_at,
      measurement_origin,source_device_id,source_record_key,source_group_key,source_revision_at,is_superseded,sleep_hours,spo2_percent,sleep_history)
      values(p_elderly,'galaxy_watch',measured,now(),jsonb_build_object(metric,measured),device.id,metric,measured,
        'samsung_health',p_source,source_key,group_key,revision,obsolete,case when metric='sleep_hours' then value end,case when metric='spo2_percent' then value end,sleep_data)
      on conflict do nothing returning id into record_id;
    if record_id is not null then
      count:=count+1;
      if not obsolete then
        update public.vital_sign_logs set is_superseded=true where elderly_id=p_elderly and measurement_origin='samsung_health'
          and source_device_id=p_source and source_group_key=group_key and source_revision_at<revision;
        if metric='sleep_hours' then update public.wearable_live_state set sleep_hours=value,sleep_measured_at=measured
          where elderly_id=p_elderly and measured>=coalesce(sleep_measured_at,'-infinity');
        else update public.wearable_live_state set spo2_percent=value,spo2_measured_at=measured
          where elderly_id=p_elderly and measured>=coalesce(spo2_measured_at,'-infinity'); end if;
      end if;
    end if;
  end loop;
  return count;
end $$;
revoke all on function public.import_samsung_health(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.import_samsung_health(uuid,uuid,text,jsonb) to service_role;
