begin;
do $$ begin
  if exists(select 1 from supabase_migrations.schema_migrations where version='20261108010000') then raise exception 'Migration already applied';end if;
  if (select md5(regexp_replace(btrim(prosrc),E'\\s+',' ','g')) from pg_proc where oid='public.ingest_galaxy_watch(text,jsonb)'::regprocedure)<>'087edd74f7fd2b46f90e8fc33e8159db' then raise exception 'Ingestion changed since review';end if;
  perform set_config('care.migration_table_count',(select count(*)::text from information_schema.tables where table_schema='public'),true);
  perform set_config('care.migration_vital_count',(select count(*)::text from public.vital_sign_logs),true);
end $$;
-- One current daily step record in the existing vital table. Preserve older
-- snapshots as superseded history; no rows or tables are deleted.
alter table public.vital_sign_logs add column if not exists steps_day date;
update public.vital_sign_logs set steps_day=(coalesce(watch_measured_at,recorded_at) at time zone 'Asia/Manila')::date
where source='galaxy_watch' and watch_metric='steps_count' and steps_count is not null and steps_day is null;
with ranked as (
  select id,row_number() over(partition by elderly_id,steps_day order by steps_count desc,recorded_at desc,id desc) position
  from public.vital_sign_logs where source='galaxy_watch' and watch_metric='steps_count' and not is_superseded and steps_day is not null
)
update public.vital_sign_logs v set is_superseded=true from ranked r where r.id=v.id and r.position>1;
create unique index if not exists vital_steps_one_current_day on public.vital_sign_logs(elderly_id,steps_day)
where source='galaxy_watch' and watch_metric='steps_count' and not is_superseded and steps_day is not null;

create or replace function public.ingest_galaxy_watch(p_token_hash text, p_payload jsonb)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare device public.wearable_devices; sample jsonb; metric text; measured timestamptz;
  value double precision; time_column text; captured timestamptz; added integer;
begin
  select d.* into device from public.wearable_devices d
    join public.elderly_profiles e on e.elderly_id = d.elderly_id and e.caregiver_id = d.caregiver_id
    join public.user_access a on a.user_id = d.caregiver_id and a.role = 'caregiver' and a.status = 'active'
    where d.token_hash = p_token_hash and d.revoked_at is null and d.expires_at > now() for update of d;
  if not found then return false; end if;
  captured := (p_payload->>'captured_at')::timestamptz;
  if captured is null or captured > now() + interval '5 minutes' then raise exception 'Invalid capture time'; end if;
  update public.wearable_devices set last_seen_at = now() where id = device.id;
  insert into public.wearable_live_state as current (
    elderly_id, device_id, latitude, longitude, accuracy_m, gps_measured_at, location_source,
    battery_percent, monitoring, status_at, received_at, gps_status, sensor_status
  ) values (
    device.elderly_id, device.id, (p_payload->>'latitude')::double precision,
    (p_payload->>'longitude')::double precision, (p_payload->>'accuracy_m')::double precision,
    (p_payload->>'gps_measured_at')::timestamptz, p_payload->>'location_source',
    (p_payload->>'battery_percent')::integer, (p_payload->>'monitoring')::boolean, captured, now(),
    p_payload->>'gps_status', coalesce(p_payload->'sensor_status','{}')
  ) on conflict (elderly_id) do update set
    device_id = excluded.device_id,
    latitude = case when excluded.gps_measured_at > coalesce(current.gps_measured_at,'-infinity') then excluded.latitude else current.latitude end,
    longitude = case when excluded.gps_measured_at > coalesce(current.gps_measured_at,'-infinity') then excluded.longitude else current.longitude end,
    accuracy_m = case when excluded.gps_measured_at > coalesce(current.gps_measured_at,'-infinity') then excluded.accuracy_m else current.accuracy_m end,
    location_source = case when excluded.gps_measured_at > coalesce(current.gps_measured_at,'-infinity') then excluded.location_source else current.location_source end,
    gps_measured_at = greatest(current.gps_measured_at,excluded.gps_measured_at),
    battery_percent = case when excluded.status_at >= current.status_at then excluded.battery_percent else current.battery_percent end,
    monitoring = case when excluded.status_at >= current.status_at then excluded.monitoring else current.monitoring end,
    gps_status = case when excluded.status_at >= current.status_at then excluded.gps_status else current.gps_status end,
    sensor_status = case when excluded.status_at >= current.status_at then excluded.sensor_status else current.sensor_status end,
    status_at = greatest(current.status_at,excluded.status_at), received_at = now();

  if jsonb_array_length(coalesce(p_payload->'samples','[]')) > 120 then raise exception 'Batch too large'; end if;
  for sample in select * from jsonb_array_elements(coalesce(p_payload->'samples','[]')) loop
    metric := sample->>'metric'; measured := (sample->>'measured_at')::timestamptz;
    value := (sample->>'value')::double precision;
    time_column := case metric when 'heart_rate_bpm' then 'heart_rate_measured_at'
      when 'spo2_percent' then 'spo2_measured_at' when 'skin_temp_celsius' then 'skin_temp_measured_at'
      when 'hrv_rmssd_ms' then 'hrv_measured_at' when 'steps_count' then 'steps_measured_at' end;
    if time_column is null or measured is null or value is null or sample->>'id' is null
      or measured < '2020-01-01'::timestamptz or measured > now() + interval '5 minutes'
      or not (case metric when 'heart_rate_bpm' then value between 1 and 350
        when 'spo2_percent' then value between 1 and 100 when 'skin_temp_celsius' then value between -10 and 60
        when 'hrv_rmssd_ms' then value between 0 and 1000 when 'steps_count' then value between 0 and 1000000 and value = trunc(value)
        else false end) then raise exception 'Invalid sensor sample'; end if;
    if metric='steps_count' then
      -- An archived snapshot may still own the original event's unique ID.
      -- Replaying it is already covered by the daily maximum, so do not move
      -- that ID onto the retained row or reject an otherwise valid batch.
      if exists(select 1 from public.vital_sign_logs where watch_sample_id=(sample->>'id')::uuid
        or watch_device_id=device.id and watch_metric=metric and watch_measured_at=measured) then continue;end if;
      insert into public.vital_sign_logs as current
        (elderly_id,steps_count,steps_day,source,recorded_at,synced_at,measurement_times,watch_device_id,watch_sample_id,watch_metric,watch_measured_at)
      values(device.elderly_id,value::integer,(measured at time zone 'Asia/Manila')::date,'galaxy_watch',measured,now(),jsonb_build_object(metric,measured),device.id,(sample->>'id')::uuid,metric,measured)
      on conflict(elderly_id,steps_day) where source='galaxy_watch' and watch_metric='steps_count' and not is_superseded and steps_day is not null
      do update set steps_count=greatest(current.steps_count,excluded.steps_count),
        recorded_at=case when excluded.steps_count>current.steps_count or excluded.steps_count=current.steps_count and excluded.watch_measured_at>=coalesce(current.watch_measured_at,current.recorded_at) then excluded.recorded_at else current.recorded_at end,
        watch_measured_at=case when excluded.steps_count>current.steps_count or excluded.steps_count=current.steps_count and excluded.watch_measured_at>=coalesce(current.watch_measured_at,current.recorded_at) then excluded.watch_measured_at else current.watch_measured_at end,
        measurement_times=case when excluded.steps_count>current.steps_count or excluded.steps_count=current.steps_count and excluded.watch_measured_at>=coalesce(current.watch_measured_at,current.recorded_at) then excluded.measurement_times else current.measurement_times end,
        watch_device_id=case when excluded.steps_count>current.steps_count or excluded.steps_count=current.steps_count and excluded.watch_measured_at>=coalesce(current.watch_measured_at,current.recorded_at) then excluded.watch_device_id else current.watch_device_id end,
        watch_sample_id=case when excluded.steps_count>current.steps_count or excluded.steps_count=current.steps_count and excluded.watch_measured_at>=coalesce(current.watch_measured_at,current.recorded_at) then excluded.watch_sample_id else current.watch_sample_id end,
        synced_at=now()
      returning steps_count,watch_measured_at into value,measured;
    else
      -- Preserve every valid non-step sensor event independently.
      execute format('insert into public.vital_sign_logs
        (elderly_id,%I,source,recorded_at,synced_at,measurement_times,watch_device_id,watch_sample_id,watch_metric,watch_measured_at)
        values ($1,$2,''galaxy_watch'',$3,now(),jsonb_build_object($4::text,$3),$5,$6,$4,$3) on conflict do nothing',metric)
        using device.elderly_id,value,measured,metric,device.id,(sample->>'id')::uuid;
    end if;
    get diagnostics added = row_count;
    -- Queued history cannot move a live reading backwards.
    if added=1 and metric='steps_count' then
      update public.wearable_live_state set steps_count=value,steps_measured_at=measured where elderly_id=device.elderly_id
        and (steps_measured_at is null or (measured at time zone 'Asia/Manila')::date>(steps_measured_at at time zone 'Asia/Manila')::date
          or (measured at time zone 'Asia/Manila')::date=(steps_measured_at at time zone 'Asia/Manila')::date
            and (value>coalesce(steps_count,-1) or measured>steps_measured_at));
    elsif added=1 then
      execute format('update public.wearable_live_state set %I=$1,%I=$2
        where elderly_id=$3 and $2 > coalesce(%I,''-infinity''::timestamptz)',metric,time_column,time_column)
        using value,measured,device.elderly_id;
    end if;
  end loop;
  if p_payload->>'gps_measured_at' is not null and (p_payload->>'gps_measured_at')::timestamptz > now() - interval '5 minutes' then
    insert into public.watch_location_points(elderly_id,device_id,latitude,longitude,accuracy_m,location_source,measured_at)
    values (device.elderly_id,device.id,(p_payload->>'latitude')::double precision,(p_payload->>'longitude')::double precision,
      (p_payload->>'accuracy_m')::double precision,coalesce(p_payload->>'location_source','watch_gps'),(p_payload->>'gps_measured_at')::timestamptz)
    on conflict (device_id,measured_at) do nothing;
  end if;
  return true;
end $$;
revoke all on function public.ingest_galaxy_watch(text,jsonb) from public,anon,authenticated;
grant execute on function public.ingest_galaxy_watch(text,jsonb) to service_role;

create or replace function public.daily_step_history(p_elderly uuid,p_from date,p_until date)
returns setof public.vital_sign_logs language plpgsql stable security invoker set search_path=public,pg_temp as $$
begin
  if not public.is_active_caregiver() or not exists(select 1 from public.elderly_profiles where elderly_id=p_elderly and caregiver_id=auth.uid()) then raise exception 'Patient access denied';end if;
  if p_from is null or p_until is null or p_until<p_from or p_until-p_from>3660 then raise exception 'Choose a valid date range of at most ten years';end if;
  return query select distinct on(coalesce(v.steps_day,(v.recorded_at at time zone 'Asia/Manila')::date)) v.*
    from public.vital_sign_logs v where v.elderly_id=p_elderly and v.source='galaxy_watch' and not v.is_superseded and v.steps_count is not null
      and coalesce(v.steps_day,(v.recorded_at at time zone 'Asia/Manila')::date) between p_from and p_until
    order by coalesce(v.steps_day,(v.recorded_at at time zone 'Asia/Manila')::date) desc,v.steps_count desc,v.recorded_at desc,v.id desc;
end $$;
revoke all on function public.daily_step_history(uuid,date,date) from public,anon;
grant execute on function public.daily_step_history(uuid,date,date) to authenticated;

do $$ begin
  if (select count(*) from information_schema.tables where table_schema='public')<>current_setting('care.migration_table_count')::bigint then raise exception 'Unexpected table count change';end if;
  if (select count(*) from public.vital_sign_logs)<current_setting('care.migration_vital_count')::bigint then raise exception 'Vital records were removed';end if;
end $$;
insert into supabase_migrations.schema_migrations(version,name,statements) values ('20261108010000','daily_watch_steps',array[$daily_migration$-- One current daily step record in the existing vital table. Preserve older
-- snapshots as superseded history; no rows or tables are deleted.
alter table public.vital_sign_logs add column if not exists steps_day date;
update public.vital_sign_logs set steps_day=(coalesce(watch_measured_at,recorded_at) at time zone 'Asia/Manila')::date
where source='galaxy_watch' and watch_metric='steps_count' and steps_count is not null and steps_day is null;
with ranked as (
  select id,row_number() over(partition by elderly_id,steps_day order by steps_count desc,recorded_at desc,id desc) position
  from public.vital_sign_logs where source='galaxy_watch' and watch_metric='steps_count' and not is_superseded and steps_day is not null
)
update public.vital_sign_logs v set is_superseded=true from ranked r where r.id=v.id and r.position>1;
create unique index if not exists vital_steps_one_current_day on public.vital_sign_logs(elderly_id,steps_day)
where source='galaxy_watch' and watch_metric='steps_count' and not is_superseded and steps_day is not null;

create or replace function public.ingest_galaxy_watch(p_token_hash text, p_payload jsonb)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare device public.wearable_devices; sample jsonb; metric text; measured timestamptz;
  value double precision; time_column text; captured timestamptz; added integer;
begin
  select d.* into device from public.wearable_devices d
    join public.elderly_profiles e on e.elderly_id = d.elderly_id and e.caregiver_id = d.caregiver_id
    join public.user_access a on a.user_id = d.caregiver_id and a.role = 'caregiver' and a.status = 'active'
    where d.token_hash = p_token_hash and d.revoked_at is null and d.expires_at > now() for update of d;
  if not found then return false; end if;
  captured := (p_payload->>'captured_at')::timestamptz;
  if captured is null or captured > now() + interval '5 minutes' then raise exception 'Invalid capture time'; end if;
  update public.wearable_devices set last_seen_at = now() where id = device.id;
  insert into public.wearable_live_state as current (
    elderly_id, device_id, latitude, longitude, accuracy_m, gps_measured_at, location_source,
    battery_percent, monitoring, status_at, received_at, gps_status, sensor_status
  ) values (
    device.elderly_id, device.id, (p_payload->>'latitude')::double precision,
    (p_payload->>'longitude')::double precision, (p_payload->>'accuracy_m')::double precision,
    (p_payload->>'gps_measured_at')::timestamptz, p_payload->>'location_source',
    (p_payload->>'battery_percent')::integer, (p_payload->>'monitoring')::boolean, captured, now(),
    p_payload->>'gps_status', coalesce(p_payload->'sensor_status','{}')
  ) on conflict (elderly_id) do update set
    device_id = excluded.device_id,
    latitude = case when excluded.gps_measured_at > coalesce(current.gps_measured_at,'-infinity') then excluded.latitude else current.latitude end,
    longitude = case when excluded.gps_measured_at > coalesce(current.gps_measured_at,'-infinity') then excluded.longitude else current.longitude end,
    accuracy_m = case when excluded.gps_measured_at > coalesce(current.gps_measured_at,'-infinity') then excluded.accuracy_m else current.accuracy_m end,
    location_source = case when excluded.gps_measured_at > coalesce(current.gps_measured_at,'-infinity') then excluded.location_source else current.location_source end,
    gps_measured_at = greatest(current.gps_measured_at,excluded.gps_measured_at),
    battery_percent = case when excluded.status_at >= current.status_at then excluded.battery_percent else current.battery_percent end,
    monitoring = case when excluded.status_at >= current.status_at then excluded.monitoring else current.monitoring end,
    gps_status = case when excluded.status_at >= current.status_at then excluded.gps_status else current.gps_status end,
    sensor_status = case when excluded.status_at >= current.status_at then excluded.sensor_status else current.sensor_status end,
    status_at = greatest(current.status_at,excluded.status_at), received_at = now();

  if jsonb_array_length(coalesce(p_payload->'samples','[]')) > 120 then raise exception 'Batch too large'; end if;
  for sample in select * from jsonb_array_elements(coalesce(p_payload->'samples','[]')) loop
    metric := sample->>'metric'; measured := (sample->>'measured_at')::timestamptz;
    value := (sample->>'value')::double precision;
    time_column := case metric when 'heart_rate_bpm' then 'heart_rate_measured_at'
      when 'spo2_percent' then 'spo2_measured_at' when 'skin_temp_celsius' then 'skin_temp_measured_at'
      when 'hrv_rmssd_ms' then 'hrv_measured_at' when 'steps_count' then 'steps_measured_at' end;
    if time_column is null or measured is null or value is null or sample->>'id' is null
      or measured < '2020-01-01'::timestamptz or measured > now() + interval '5 minutes'
      or not (case metric when 'heart_rate_bpm' then value between 1 and 350
        when 'spo2_percent' then value between 1 and 100 when 'skin_temp_celsius' then value between -10 and 60
        when 'hrv_rmssd_ms' then value between 0 and 1000 when 'steps_count' then value between 0 and 1000000 and value = trunc(value)
        else false end) then raise exception 'Invalid sensor sample'; end if;
    if metric='steps_count' then
      -- An archived snapshot may still own the original event's unique ID.
      -- Replaying it is already covered by the daily maximum, so do not move
      -- that ID onto the retained row or reject an otherwise valid batch.
      if exists(select 1 from public.vital_sign_logs where watch_sample_id=(sample->>'id')::uuid
        or watch_device_id=device.id and watch_metric=metric and watch_measured_at=measured) then continue;end if;
      insert into public.vital_sign_logs as current
        (elderly_id,steps_count,steps_day,source,recorded_at,synced_at,measurement_times,watch_device_id,watch_sample_id,watch_metric,watch_measured_at)
      values(device.elderly_id,value::integer,(measured at time zone 'Asia/Manila')::date,'galaxy_watch',measured,now(),jsonb_build_object(metric,measured),device.id,(sample->>'id')::uuid,metric,measured)
      on conflict(elderly_id,steps_day) where source='galaxy_watch' and watch_metric='steps_count' and not is_superseded and steps_day is not null
      do update set steps_count=greatest(current.steps_count,excluded.steps_count),
        recorded_at=case when excluded.steps_count>current.steps_count or excluded.steps_count=current.steps_count and excluded.watch_measured_at>=coalesce(current.watch_measured_at,current.recorded_at) then excluded.recorded_at else current.recorded_at end,
        watch_measured_at=case when excluded.steps_count>current.steps_count or excluded.steps_count=current.steps_count and excluded.watch_measured_at>=coalesce(current.watch_measured_at,current.recorded_at) then excluded.watch_measured_at else current.watch_measured_at end,
        measurement_times=case when excluded.steps_count>current.steps_count or excluded.steps_count=current.steps_count and excluded.watch_measured_at>=coalesce(current.watch_measured_at,current.recorded_at) then excluded.measurement_times else current.measurement_times end,
        watch_device_id=case when excluded.steps_count>current.steps_count or excluded.steps_count=current.steps_count and excluded.watch_measured_at>=coalesce(current.watch_measured_at,current.recorded_at) then excluded.watch_device_id else current.watch_device_id end,
        watch_sample_id=case when excluded.steps_count>current.steps_count or excluded.steps_count=current.steps_count and excluded.watch_measured_at>=coalesce(current.watch_measured_at,current.recorded_at) then excluded.watch_sample_id else current.watch_sample_id end,
        synced_at=now()
      returning steps_count,watch_measured_at into value,measured;
    else
      -- Preserve every valid non-step sensor event independently.
      execute format('insert into public.vital_sign_logs
        (elderly_id,%I,source,recorded_at,synced_at,measurement_times,watch_device_id,watch_sample_id,watch_metric,watch_measured_at)
        values ($1,$2,''galaxy_watch'',$3,now(),jsonb_build_object($4::text,$3),$5,$6,$4,$3) on conflict do nothing',metric)
        using device.elderly_id,value,measured,metric,device.id,(sample->>'id')::uuid;
    end if;
    get diagnostics added = row_count;
    -- Queued history cannot move a live reading backwards.
    if added=1 and metric='steps_count' then
      update public.wearable_live_state set steps_count=value,steps_measured_at=measured where elderly_id=device.elderly_id
        and (steps_measured_at is null or (measured at time zone 'Asia/Manila')::date>(steps_measured_at at time zone 'Asia/Manila')::date
          or (measured at time zone 'Asia/Manila')::date=(steps_measured_at at time zone 'Asia/Manila')::date
            and (value>coalesce(steps_count,-1) or measured>steps_measured_at));
    elsif added=1 then
      execute format('update public.wearable_live_state set %I=$1,%I=$2
        where elderly_id=$3 and $2 > coalesce(%I,''-infinity''::timestamptz)',metric,time_column,time_column)
        using value,measured,device.elderly_id;
    end if;
  end loop;
  if p_payload->>'gps_measured_at' is not null and (p_payload->>'gps_measured_at')::timestamptz > now() - interval '5 minutes' then
    insert into public.watch_location_points(elderly_id,device_id,latitude,longitude,accuracy_m,location_source,measured_at)
    values (device.elderly_id,device.id,(p_payload->>'latitude')::double precision,(p_payload->>'longitude')::double precision,
      (p_payload->>'accuracy_m')::double precision,coalesce(p_payload->>'location_source','watch_gps'),(p_payload->>'gps_measured_at')::timestamptz)
    on conflict (device_id,measured_at) do nothing;
  end if;
  return true;
end $$;
revoke all on function public.ingest_galaxy_watch(text,jsonb) from public,anon,authenticated;
grant execute on function public.ingest_galaxy_watch(text,jsonb) to service_role;

create or replace function public.daily_step_history(p_elderly uuid,p_from date,p_until date)
returns setof public.vital_sign_logs language plpgsql stable security invoker set search_path=public,pg_temp as $$
begin
  if not public.is_active_caregiver() or not exists(select 1 from public.elderly_profiles where elderly_id=p_elderly and caregiver_id=auth.uid()) then raise exception 'Patient access denied';end if;
  if p_from is null or p_until is null or p_until<p_from or p_until-p_from>3660 then raise exception 'Choose a valid date range of at most ten years';end if;
  return query select distinct on(coalesce(v.steps_day,(v.recorded_at at time zone 'Asia/Manila')::date)) v.*
    from public.vital_sign_logs v where v.elderly_id=p_elderly and v.source='galaxy_watch' and not v.is_superseded and v.steps_count is not null
      and coalesce(v.steps_day,(v.recorded_at at time zone 'Asia/Manila')::date) between p_from and p_until
    order by coalesce(v.steps_day,(v.recorded_at at time zone 'Asia/Manila')::date) desc,v.steps_count desc,v.recorded_at desc,v.id desc;
end $$;
revoke all on function public.daily_step_history(uuid,date,date) from public,anon;
grant execute on function public.daily_step_history(uuid,date,date) to authenticated;
$daily_migration$]);
commit;
select exists(select 1 from supabase_migrations.schema_migrations where version='20261108010000') migration_applied,
  exists(select 1 from pg_indexes where schemaname='public' and indexname='vital_steps_one_current_day') daily_index_present,
  (select count(*) from (select elderly_id,steps_day from public.vital_sign_logs where source='galaxy_watch' and watch_metric='steps_count' and not is_superseded and steps_day is not null group by 1,2 having count(*)>1) duplicates) duplicate_current_step_days;
