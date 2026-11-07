-- Galaxy Watch is the only wearable provider. Preserve existing medical history.
update public.onboarding_progress set wearable_status = 'not_started', paired_device_count = 0
  where wearable_provider <> 'galaxy_watch';
update public.onboarding_progress set wearable_provider = 'galaxy_watch';
alter table public.onboarding_progress alter column wearable_provider set default 'galaxy_watch';
alter table public.onboarding_progress drop constraint if exists onboarding_progress_wearable_provider_check;
alter table public.onboarding_progress add constraint onboarding_progress_wearable_provider_check check (wearable_provider = 'galaxy_watch');
-- Retired cloud integrations cannot retain usable credentials or pending authorizations.
do $$ begin
  if to_regclass('public.google_health_tokens') is not null then delete from public.google_health_tokens; end if;
  if to_regclass('public.google_health_oauth_states') is not null then delete from public.google_health_oauth_states; end if;
end $$;

alter table public.wearable_live_state
  add column spo2_percent double precision, add column spo2_measured_at timestamptz,
  add column skin_temp_celsius double precision, add column skin_temp_measured_at timestamptz,
  add column hrv_rmssd_ms double precision, add column hrv_measured_at timestamptz,
  add column steps_count integer, add column steps_measured_at timestamptz,
  add column location_source text check (location_source in ('watch_gps','fused','network')),
  add column gps_status text, add column sensor_status jsonb not null default '{}';

alter table public.vital_sign_logs
  add column watch_device_id uuid references public.wearable_devices(id) on delete set null,
  add column watch_sample_id uuid, add column watch_metric text, add column watch_measured_at timestamptz;
create unique index vital_watch_sample_unique on public.vital_sign_logs(watch_device_id, watch_sample_id);
create unique index vital_watch_measurement_unique on public.vital_sign_logs(watch_device_id, watch_metric, watch_measured_at);
create index vital_watch_metric_history on public.vital_sign_logs(elderly_id, watch_metric, recorded_at desc) where source = 'galaxy_watch';

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
    -- One row per new sensor event, even when its numeric value is unchanged.
    -- Two uniqueness keys protect against retries and replay with a different ID.
    execute format('insert into public.vital_sign_logs
      (elderly_id,%I,source,recorded_at,synced_at,measurement_times,watch_device_id,watch_sample_id,watch_metric,watch_measured_at)
      values ($1,$2,''galaxy_watch'',$3,now(),jsonb_build_object($4::text,$3),$5,$6,$4,$3) on conflict do nothing',metric)
      using device.elderly_id,value,measured,metric,device.id,(sample->>'id')::uuid;
    get diagnostics added = row_count;
    -- Queued history cannot move a live reading backwards.
    if added = 1 then execute format('update public.wearable_live_state set %I=$1,%I=$2
      where elderly_id=$3 and $2 > coalesce(%I,''-infinity''::timestamptz)',metric,time_column,time_column)
      using value,measured,device.elderly_id;
    end if;
  end loop;
  return true;
end $$;
revoke all on function public.ingest_galaxy_watch(text,jsonb) from public,anon,authenticated;
grant execute on function public.ingest_galaxy_watch(text,jsonb) to service_role;
