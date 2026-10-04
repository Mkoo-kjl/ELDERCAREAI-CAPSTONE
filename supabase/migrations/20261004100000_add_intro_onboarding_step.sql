alter table public.onboarding_progress
  add column if not exists intro_completed_at timestamptz;
