-- Continuous watch telemetry is separate from slower historical vital rows.
alter table public.onboarding_progress add column if not exists wearable_provider text
  not null default 'google_health' check (wearable_provider in ('google_health', 'galaxy_watch'));

create table public.wearable_devices (
  id uuid primary key default gen_random_uuid(),
  caregiver_id uuid not null references auth.users(id) on delete cascade,
  elderly_id uuid not null references public.elderly_profiles(elderly_id) on delete cascade,
  device_name text not null,
  token_hash text not null unique,
  expires_at timestamptz not null default now() + interval '90 days',
  revoked_at timestamptz,
  paired_at timestamptz not null default now(),
  last_seen_at timestamptz,
  last_history_at timestamptz
);
create index wearable_devices_patient on public.wearable_devices(elderly_id);
create unique index wearable_devices_one_active_patient on public.wearable_devices(elderly_id) where revoked_at is null;
create table public.galaxy_watch_pairings (
  code_hash text primary key,
  caregiver_id uuid not null references auth.users(id) on delete cascade,
  elderly_id uuid not null references public.elderly_profiles(elderly_id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create table public.galaxy_watch_attempts (
  request_key text primary key,
  window_start timestamptz not null default now(),
  attempts integer not null default 1
);
create table public.wearable_live_state (
  elderly_id uuid primary key references public.elderly_profiles(elderly_id) on delete cascade,
  device_id uuid not null references public.wearable_devices(id) on delete cascade,
  heart_rate_bpm double precision,
  heart_rate_measured_at timestamptz,
  latitude double precision,
  longitude double precision,
  accuracy_m double precision,
  gps_measured_at timestamptz,
  battery_percent integer check (battery_percent between 0 and 100),
  monitoring boolean not null default false,
  status_at timestamptz not null,
  received_at timestamptz not null default now()
);
alter table public.wearable_devices enable row level security;
alter table public.galaxy_watch_pairings enable row level security;
alter table public.galaxy_watch_attempts enable row level security;
alter table public.wearable_live_state enable row level security;
revoke all on public.wearable_devices, public.galaxy_watch_pairings, public.galaxy_watch_attempts, public.wearable_live_state from anon, authenticated;
-- Hashes and credentials must never be available in client table queries.
grant select (id, caregiver_id, elderly_id, device_name, expires_at, revoked_at, paired_at, last_seen_at) on public.wearable_devices to authenticated;
grant select on public.wearable_live_state to authenticated;
grant all on public.wearable_devices, public.galaxy_watch_pairings, public.galaxy_watch_attempts, public.wearable_live_state to service_role;
create policy "Caregivers read their watch devices" on public.wearable_devices for select to authenticated
using ((select public.is_active_caregiver()) and caregiver_id = (select auth.uid()) and exists (
  select 1 from public.elderly_profiles e where e.elderly_id = wearable_devices.elderly_id and e.caregiver_id = (select auth.uid())
));
create policy "Caregivers read their watch telemetry" on public.wearable_live_state for select to authenticated
using ((select public.is_active_caregiver()) and exists (select 1 from public.elderly_profiles e
  where e.elderly_id = wearable_live_state.elderly_id and e.caregiver_id = (select auth.uid())));

-- Claim is atomic; a code can link exactly one device. Rate limiting persists across function instances.
create or replace function public.claim_galaxy_watch(p_code_hash text, p_token_hash text, p_device_name text, p_request_key text)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare pairing public.galaxy_watch_pairings; device_id uuid; attempt_count integer;
begin
  insert into public.galaxy_watch_attempts(request_key) values (p_request_key)
  on conflict (request_key) do update set
    attempts = case when galaxy_watch_attempts.window_start < now() - interval '10 minutes' then 1 else galaxy_watch_attempts.attempts + 1 end,
    window_start = case when galaxy_watch_attempts.window_start < now() - interval '10 minutes' then now() else galaxy_watch_attempts.window_start end
  returning attempts into attempt_count;
  if attempt_count > 10 then return null; end if;
  select * into pairing from public.galaxy_watch_pairings where code_hash = p_code_hash and expires_at > now() for update;
  if not found then return null; end if;
  -- Recheck account and ownership at claim time, not only at code creation.
  if not exists (select 1 from public.elderly_profiles e join public.user_access a on a.user_id = e.caregiver_id
    where e.elderly_id = pairing.elderly_id and e.caregiver_id = pairing.caregiver_id and a.role = 'caregiver' and a.status = 'active') then return null; end if;
  update public.wearable_devices set revoked_at = now() where elderly_id = pairing.elderly_id and revoked_at is null;
  delete from public.wearable_live_state where elderly_id = pairing.elderly_id;
  insert into public.wearable_devices(caregiver_id, elderly_id, token_hash, device_name)
    values (pairing.caregiver_id, pairing.elderly_id, p_token_hash, p_device_name) returning id into device_id;
  delete from public.galaxy_watch_pairings where code_hash = p_code_hash;
  update public.onboarding_progress set wearable_provider = 'galaxy_watch', wearable_status = 'connected',
    paired_device_count = 1, wearable_completed_at = coalesce(wearable_completed_at, now()), updated_at = now()
    where user_id = pairing.caregiver_id;
  delete from public.galaxy_watch_attempts where window_start < now() - interval '1 day';
  delete from public.galaxy_watch_pairings where expires_at < now();
  return device_id;
end $$;

-- Serialize uploads per device and merge each measurement by its own timestamp.
create or replace function public.ingest_galaxy_watch(p_token_hash text, p_payload jsonb)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare device public.wearable_devices; latest public.wearable_live_state;
begin
  select d.* into device from public.wearable_devices d
    join public.elderly_profiles e on e.elderly_id = d.elderly_id and e.caregiver_id = d.caregiver_id
    join public.user_access a on a.user_id = d.caregiver_id and a.role = 'caregiver' and a.status = 'active'
    where d.token_hash = p_token_hash and d.revoked_at is null and d.expires_at > now() for update of d;
  if not found then return false; end if;
  update public.wearable_devices set last_seen_at = now() where id = device.id;
  insert into public.wearable_live_state as current (
    elderly_id, device_id, heart_rate_bpm, heart_rate_measured_at, latitude, longitude, accuracy_m,
    gps_measured_at, battery_percent, monitoring, status_at, received_at
  ) values (
    device.elderly_id, device.id, (p_payload->>'heart_rate_bpm')::double precision, (p_payload->>'heart_rate_measured_at')::timestamptz,
    (p_payload->>'latitude')::double precision, (p_payload->>'longitude')::double precision, (p_payload->>'accuracy_m')::double precision,
    (p_payload->>'gps_measured_at')::timestamptz, (p_payload->>'battery_percent')::integer,
    (p_payload->>'monitoring')::boolean, (p_payload->>'captured_at')::timestamptz, now()
  ) on conflict (elderly_id) do update set
    device_id = excluded.device_id,
    heart_rate_bpm = case when excluded.heart_rate_measured_at > coalesce(current.heart_rate_measured_at, '-infinity') then excluded.heart_rate_bpm else current.heart_rate_bpm end,
    heart_rate_measured_at = greatest(current.heart_rate_measured_at, excluded.heart_rate_measured_at),
    latitude = case when excluded.gps_measured_at > coalesce(current.gps_measured_at, '-infinity') then excluded.latitude else current.latitude end,
    longitude = case when excluded.gps_measured_at > coalesce(current.gps_measured_at, '-infinity') then excluded.longitude else current.longitude end,
    accuracy_m = case when excluded.gps_measured_at > coalesce(current.gps_measured_at, '-infinity') then excluded.accuracy_m else current.accuracy_m end,
    gps_measured_at = greatest(current.gps_measured_at, excluded.gps_measured_at),
    battery_percent = case when excluded.status_at >= current.status_at then excluded.battery_percent else current.battery_percent end,
    monitoring = case when excluded.status_at >= current.status_at then excluded.monitoring else current.monitoring end,
    status_at = greatest(current.status_at, excluded.status_at), received_at = now()
  returning * into latest;
  -- About one history row per minute; live card updates are independent of history frequency.
  if latest.heart_rate_measured_at > now() - interval '1 minute'
    and (device.last_history_at is null or latest.heart_rate_measured_at >= device.last_history_at + interval '1 minute') then
    insert into public.vital_sign_logs(elderly_id, heart_rate_bpm, source, recorded_at, synced_at, measurement_times)
      values (device.elderly_id, latest.heart_rate_bpm, 'galaxy_watch', latest.heart_rate_measured_at, now(),
        jsonb_build_object('heart_rate_bpm', latest.heart_rate_measured_at));
    update public.wearable_devices set last_history_at = latest.heart_rate_measured_at where id = device.id;
  end if;
  return true;
end $$;
revoke all on function public.claim_galaxy_watch(text,text,text,text) from public, anon, authenticated;
revoke all on function public.ingest_galaxy_watch(text,jsonb) from public, anon, authenticated;
grant execute on function public.claim_galaxy_watch(text,text,text,text) to service_role;
grant execute on function public.ingest_galaxy_watch(text,jsonb) to service_role;
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'wearable_live_state') then
    alter publication supabase_realtime add table public.wearable_live_state;
  end if;
end $$;
