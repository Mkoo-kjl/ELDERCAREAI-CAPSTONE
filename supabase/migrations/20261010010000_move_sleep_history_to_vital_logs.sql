alter table public.vital_sign_logs
  add column if not exists sleep_history jsonb not null default '[]'::jsonb;

with latest_google_log as (
  select distinct on (elderly_id) elderly_id, id
  from public.vital_sign_logs
  where source = 'google_health_v4'
  order by elderly_id, synced_at desc nulls last, recorded_at desc
), saved_history as (
  select elderly_id, jsonb_agg(jsonb_build_object(
    'source_key', source_key,
    'session_start_at', session_start_at,
    'session_end_at', session_end_at,
    'minutes_asleep', minutes_asleep,
    'minutes_in_sleep_period', minutes_in_sleep_period,
    'is_main_sleep', is_main_sleep,
    'is_processed', is_processed
  ) order by session_end_at desc) as sessions
  from public.sleep_sessions
  group by elderly_id
)
update public.vital_sign_logs as log
set sleep_history = saved_history.sessions
from latest_google_log
join saved_history on saved_history.elderly_id = latest_google_log.elderly_id
where log.id = latest_google_log.id;

drop table public.sleep_sessions;
