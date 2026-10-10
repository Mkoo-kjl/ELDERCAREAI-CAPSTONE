create table if not exists public.sleep_sessions (
  id uuid primary key default gen_random_uuid(),
  elderly_id uuid not null references public.elderly_profiles(elderly_id) on delete cascade,
  source_key text not null,
  session_start_at timestamptz not null,
  session_end_at timestamptz not null,
  minutes_asleep integer not null check (minutes_asleep > 0),
  minutes_in_sleep_period integer check (minutes_in_sleep_period > 0),
  is_main_sleep boolean not null default false,
  is_processed boolean not null default false,
  synced_at timestamptz not null default now(),
  unique (elderly_id, source_key),
  check (session_end_at > session_start_at)
);

create index if not exists sleep_sessions_elderly_end_idx
  on public.sleep_sessions (elderly_id, session_end_at desc);

alter table public.sleep_sessions enable row level security;

create policy "Caregivers read patient sleep sessions" on public.sleep_sessions
  for select to authenticated using (exists (
    select 1 from public.elderly_profiles e
    where e.elderly_id = sleep_sessions.elderly_id
      and e.caregiver_id = (select auth.uid())
  ));
