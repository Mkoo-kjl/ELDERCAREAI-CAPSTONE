alter table public.vital_sign_logs
  add column if not exists measurement_times jsonb not null default '{}'::jsonb;

create index if not exists google_health_tokens_health_user_idx
  on public.google_health_tokens (google_health_user_id)
  where google_health_user_id is not null;
