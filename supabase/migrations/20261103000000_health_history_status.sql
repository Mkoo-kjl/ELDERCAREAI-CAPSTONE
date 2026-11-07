-- A reading row only contains the metric actually measured at that instant.
-- This view presents the latest independently timestamped values together.
create or replace view public.vital_sign_latest with (security_invoker=true) as
select elderly_id,device_id as watch_device_id,
  heart_rate_bpm,heart_rate_measured_at,spo2_percent,spo2_measured_at,
  skin_temp_celsius,skin_temp_measured_at,hrv_rmssd_ms,hrv_measured_at,
  stress_score,stress_baseline_rmssd,stress_reference_count,hrv_measured_at as stress_measured_at,
  steps_count,steps_measured_at,sleep_hours,sleep_measured_at,
  monitoring,received_at,status_at,sensor_status
from public.wearable_live_state;
revoke all on public.vital_sign_latest from anon;
grant select on public.vital_sign_latest to authenticated,service_role;

-- Record a scoped import outcome even when a rejected RPC rolls back its batch.
-- No raw readings, device credentials or request bodies are stored here.
alter table public.samsung_health_links
  add column last_import_at timestamptz,
  add column last_import_metric text,
  add column last_import_count integer,
  add column last_import_error_code text,
  add column last_import_error text;
