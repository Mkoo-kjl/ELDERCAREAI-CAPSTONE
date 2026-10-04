alter table public.vital_sign_logs
  add column if not exists hrv_rmssd_ms numeric;
