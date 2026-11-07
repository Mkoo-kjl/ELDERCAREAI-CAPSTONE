-- Scoped watch actions, dose-level acknowledgements, and a non-clinical HRV index.
alter table public.medication_logs add column if not exists dose_key text;
alter table public.medication_logs add column if not exists watch_device_id uuid references public.wearable_devices(id);
create unique index medication_dose_once on public.medication_logs(schedule_id,dose_key) where dose_key is not null;
create table public.watch_care_actions (
  id uuid primary key, device_id uuid not null references public.wearable_devices(id),
  kind text not null check(kind in ('sos','medication_taken')), result jsonb not null, created_at timestamptz not null default now()
);
alter table public.watch_care_actions enable row level security;
revoke all on public.watch_care_actions from anon,authenticated;
grant all on public.watch_care_actions to service_role;
create table public.caregiver_push_tokens (
  token text primary key check(length(token)<256), caregiver_id uuid not null references auth.users(id) on delete cascade,
  updated_at timestamptz not null default now()
);
alter table public.caregiver_push_tokens enable row level security;
grant select,insert,update,delete on public.caregiver_push_tokens to authenticated;
grant all on public.caregiver_push_tokens to service_role;
create policy own_push_token on public.caregiver_push_tokens for all to authenticated
  using(caregiver_id=(select auth.uid()) and (select public.is_active_caregiver()))
  with check(caregiver_id=(select auth.uid()) and (select public.is_active_caregiver()));

create or replace function public.record_care_dose(p_schedule uuid,p_elderly uuid,p_scheduled timestamptz,p_taken timestamptz,p_zone text,p_actor uuid,p_device uuid)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare med public.medication_schedules; local_dose timestamp; log_id uuid; key text;
begin
  select * into med from public.medication_schedules where id=p_schedule and elderly_id=p_elderly for update;
  if not found or not med.is_active or lower(med.frequency)='as needed' or not exists(
    select 1 from public.elderly_profiles e where e.elderly_id=p_elderly and e.caregiver_id=med.caregiver_id
  ) then raise exception 'Medication schedule unavailable'; end if;
  if not exists(select 1 from pg_timezone_names where name=p_zone) then raise exception 'Invalid timezone'; end if;
  if p_scheduled is null or p_taken is null or p_taken>now()+interval '5 minutes' or p_taken<now()-interval '2 days'
    or p_scheduled>p_taken+interval '5 minutes' or p_scheduled<now()-interval '2 days' then raise exception 'Dose is outside the confirmation window'; end if;
  local_dose:=p_scheduled at time zone p_zone;
  if local_dose::date<med.start_date or (med.end_date is not null and local_dose::date>med.end_date)
    or to_char(local_dose,'HH24:MI')<>all(coalesce(med.times_of_day,array[]::text[]))
    or cardinality(coalesce(med.times_of_day,array[]::text[]))=0
    or extract(second from local_dose)<>0
    or (lower(med.frequency)='weekly' and mod(local_dose::date-med.start_date,7)<>0)
    then raise exception 'Dose does not match the medication schedule'; end if;
  key:=extract(epoch from p_scheduled)::bigint::text;
  insert into public.medication_logs(schedule_id,elderly_id,scheduled_time,taken_at,status,recorded_by,watch_device_id,dose_key,notes)
    values(med.id,p_elderly,p_scheduled,p_taken,'taken',p_actor,p_device,key,
      case when p_device is null then 'Confirmed in caregiver app' else 'Confirmed Taken on Galaxy Watch; user-reported, ingestion not independently verified' end)
    on conflict(schedule_id,dose_key) where dose_key is not null do nothing returning id into log_id;
  if log_id is null then select id into log_id from public.medication_logs where schedule_id=med.id and dose_key=key; end if;
  return log_id;
end $$;
revoke all on function public.record_care_dose(uuid,uuid,timestamptz,timestamptz,text,uuid,uuid) from public,anon,authenticated;

create or replace function public.mark_medication_taken(p_schedule uuid,p_scheduled timestamptz,p_zone text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare patient uuid;
begin
  if not public.is_active_caregiver() then raise exception 'Active caregiver required'; end if;
  select m.elderly_id into patient from public.medication_schedules m join public.elderly_profiles e on e.elderly_id=m.elderly_id
    where m.id=p_schedule and m.caregiver_id=auth.uid() and e.caregiver_id=auth.uid();
  if patient is null then raise exception 'Medication access denied'; end if;
  return public.record_care_dose(p_schedule,patient,p_scheduled,now(),p_zone,auth.uid(),null);
end $$;
revoke all on function public.mark_medication_taken(uuid,timestamptz,text) from public,anon;
grant execute on function public.mark_medication_taken(uuid,timestamptz,text) to authenticated;

create or replace function public.watch_care(p_token_hash text,p_action text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare device public.wearable_devices; action_id uuid; prior public.watch_care_actions; result jsonb; alert_id uuid; notification_id uuid; log_id uuid; patient_name text;
begin
  select d.* into device from public.wearable_devices d join public.elderly_profiles e on e.elderly_id=d.elderly_id and e.caregiver_id=d.caregiver_id
    join public.user_access a on a.user_id=d.caregiver_id and a.role='caregiver' and a.status='active'
    where d.token_hash=p_token_hash and d.revoked_at is null and d.expires_at>now() for update of d;
  if not found then return null; end if;
  if p_action='sync' then
    return jsonb_build_object('server_at',now(),'device_id',device.id,'medications',coalesce((select jsonb_agg(to_jsonb(m)) from public.medication_schedules m
      where m.elderly_id=device.elderly_id and m.caregiver_id=device.caregiver_id and m.is_active),'[]'::jsonb),
      'taken_doses',coalesce((select jsonb_agg(jsonb_build_object('schedule_id',l.schedule_id,'scheduled_time',l.scheduled_time)) from public.medication_logs l
        where l.elderly_id=device.elderly_id and l.status='taken' and l.scheduled_time>now()-interval '2 days'),'[]'::jsonb),
      'stress',(select jsonb_build_object('score',s.stress_score,'baseline',s.stress_baseline_rmssd,'samples',s.stress_reference_count,'measured_at',s.hrv_measured_at,'hrv',s.hrv_rmssd_ms) from public.wearable_live_state s where s.device_id=device.id));
  end if;
  action_id:=(p_payload->>'id')::uuid;
  if action_id is null then raise exception 'Action ID required'; end if;
  select * into prior from public.watch_care_actions where id=action_id;
  if found then
    if prior.device_id<>device.id or prior.kind<>p_action then raise exception 'Action ID already used'; end if;
    return prior.result;
  end if;
  if p_action='sos' then
    select full_name into patient_name from public.elderly_profiles where elderly_id=device.elderly_id;
    insert into public.emergency_events(id,elderly_id,event_type,severity,description,vital_snapshot)
      values(action_id,device.elderly_id,'sos_call','high','SOS requested from Galaxy Watch for '||patient_name||'. Caregiver assistance requested; no emergency-service call was placed.',
      (select to_jsonb(s) from public.wearable_live_state s where s.device_id=device.id));
    insert into public.health_alerts(elderly_id,alert_type,severity,title,message,ai_generated)
      values(device.elderly_id,'sos','critical','Watch SOS — assistance requested',patient_name||' tapped SOS on their Galaxy Watch.',false) returning id into alert_id;
    insert into public.caregiver_notifications(caregiver_id,elderly_id,alert_id,notification_type,title,body,data,channel,delivery_status)
      values(device.caregiver_id,device.elderly_id,alert_id,'emergency','Watch SOS — assistance requested',patient_name||' requested assistance from their Galaxy Watch.',
        jsonb_build_object('watch_sos_id',action_id,'url','/alerts?tab=Emergency'),'in_app','sent') returning id into notification_id;
    result:=jsonb_build_object('accepted',true,'event_id',action_id,'notification_id',notification_id,'caregiver_id',device.caregiver_id);
  elsif p_action='medication_taken' then
    log_id:=public.record_care_dose((p_payload->>'schedule_id')::uuid,device.elderly_id,(p_payload->>'scheduled_time')::timestamptz,
      (p_payload->>'taken_at')::timestamptz,p_payload->>'timezone',null,device.id);
    result:=jsonb_build_object('accepted',true,'log_id',log_id);
  else raise exception 'Unknown care action'; end if;
  insert into public.watch_care_actions values(action_id,device.id,p_action,result,now());
  return result;
end $$;
-- Function references stress columns added below; PostgreSQL resolves them when called.
revoke all on function public.watch_care(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.watch_care(text,text,jsonb) to service_role;

alter table public.wearable_live_state add column stress_score integer check(stress_score between 0 and 100);
alter table public.wearable_live_state add column stress_baseline_rmssd double precision;
alter table public.wearable_live_state add column stress_reference_count integer not null default 0;
create table public.watch_hrv_reference_buckets (
  device_id uuid not null references public.wearable_devices(id) on delete cascade, bucket_at timestamptz not null,
  total double precision not null, samples integer not null, primary key(device_id,bucket_at)
);
alter table public.watch_hrv_reference_buckets enable row level security;
revoke all on public.watch_hrv_reference_buckets from anon,authenticated;
grant all on public.watch_hrv_reference_buckets to service_role;
insert into public.watch_hrv_reference_buckets
select watch_device_id,to_timestamp(floor(extract(epoch from watch_measured_at)/300)*300),sum(hrv_rmssd_ms),count(*)::integer
from public.vital_sign_logs where watch_metric='hrv_rmssd_ms' and hrv_rmssd_ms>0 and watch_measured_at>now()-interval '7 days'
group by 1,2;
create or replace function public.update_watch_stress_index() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare bucket timestamptz; baseline double precision; reference_count integer; score integer;
begin
  if new.watch_metric is distinct from 'hrv_rmssd_ms' or new.watch_device_id is null or new.hrv_rmssd_ms is null then return new; end if;
  bucket:=to_timestamp(floor(extract(epoch from new.watch_measured_at)/300)*300);
  if new.hrv_rmssd_ms>0 then
    insert into public.watch_hrv_reference_buckets values(new.watch_device_id,bucket,new.hrv_rmssd_ms,1)
      on conflict(device_id,bucket_at) do update set total=watch_hrv_reference_buckets.total+excluded.total,samples=watch_hrv_reference_buckets.samples+1;
  end if;
  select percentile_cont(0.5) within group(order by total/samples),count(*) into baseline,reference_count
    from public.watch_hrv_reference_buckets where device_id=new.watch_device_id and bucket_at<bucket
      and bucket_at>=new.watch_measured_at-interval '7 days';
  -- Experimental scale, NOT a validated stress classifier: baseline=50, half baseline=100, double baseline=0.
  if reference_count>=12 and baseline>0 and new.hrv_rmssd_ms>0 then
    score:=greatest(0,least(100,round(50+50*ln(baseline/new.hrv_rmssd_ms)/ln(2.0))::integer));
  end if;
  update public.wearable_live_state set stress_score=score,stress_baseline_rmssd=baseline,stress_reference_count=reference_count
    where device_id=new.watch_device_id and new.watch_measured_at>=coalesce(hrv_measured_at,'-infinity');
  return new;
end $$;
create trigger watch_stress_index after insert on public.vital_sign_logs for each row execute function public.update_watch_stress_index();
create or replace function public.reset_watch_stress_index() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
  if old.device_id is distinct from new.device_id then
    new.stress_score:=null; new.stress_baseline_rmssd:=null; new.stress_reference_count:=0;
  end if;
  return new;
end $$;
create trigger reset_watch_stress before update of device_id on public.wearable_live_state for each row execute function public.reset_watch_stress_index();

do $$ declare name text; begin
  foreach name in array array['medication_schedules','medication_logs','emergency_events','caregiver_notifications'] loop
    if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=name) then
      execute format('alter publication supabase_realtime add table public.%I',name);
    end if;
  end loop;
end $$;
