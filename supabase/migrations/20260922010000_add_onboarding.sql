-- ElderCareAI onboarding state and fields missing from the original schema.
-- This migration is additive and safe to run after the existing tables.

alter table public.caregivers
  add column if not exists email text,
  add column if not exists updated_at timestamptz not null default now();

alter table public.elderly_profiles
  add column if not exists date_of_birth date,
  add column if not exists emergency_contact_phone text,
  add column if not exists updated_at timestamptz not null default now();

alter table public.google_health_tokens
  add column if not exists google_health_user_id text,
  add column if not exists provider text not null default 'google_health_v4',
  add column if not exists connected_at timestamptz;

create table if not exists public.onboarding_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  caregiver_completed_at timestamptz,
  elderly_completed_at timestamptz,
  wearable_status text not null default 'not_started'
    check (wearable_status in ('not_started', 'connected', 'authorized_no_device', 'skipped', 'error')),
  paired_device_count integer not null default 0 check (paired_device_count >= 0),
  wearable_completed_at timestamptz,
  location_permission text not null default 'not_requested'
    check (location_permission in ('not_requested', 'granted', 'denied')),
  location_consent_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.google_health_oauth_states (
  state text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  code_verifier text not null,
  app_redirect_uri text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.wearable_sync_locations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  elderly_id uuid references public.elderly_profiles(elderly_id) on delete set null,
  event_type text not null check (event_type in ('wearable_connection', 'health_sync')),
  latitude double precision not null,
  longitude double precision not null,
  accuracy_m double precision,
  recorded_at timestamptz not null default now()
);

alter table public.caregivers enable row level security;
alter table public.elderly_profiles enable row level security;
alter table public.onboarding_progress enable row level security;
alter table public.google_health_tokens enable row level security;
alter table public.google_health_oauth_states enable row level security;
alter table public.wearable_sync_locations enable row level security;

drop policy if exists "Caregivers manage their own profile" on public.caregivers;
create policy "Caregivers manage their own profile"
  on public.caregivers for all to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "Caregivers manage their elderly profiles" on public.elderly_profiles;
create policy "Caregivers manage their elderly profiles"
  on public.elderly_profiles for all to authenticated
  using ((select auth.uid()) = caregiver_id)
  with check ((select auth.uid()) = caregiver_id);

drop policy if exists "Users manage their onboarding progress" on public.onboarding_progress;
create policy "Users manage their onboarding progress"
  on public.onboarding_progress for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- OAuth secrets are intentionally service-role only. Authenticated clients can
-- see connection status through onboarding_progress, never token contents.
revoke all on public.google_health_tokens from anon, authenticated;
revoke all on public.google_health_oauth_states from anon, authenticated;

drop policy if exists "Users insert their phone sync location" on public.wearable_sync_locations;
create policy "Users insert their phone sync location"
  on public.wearable_sync_locations for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users read their phone sync locations" on public.wearable_sync_locations;
create policy "Users read their phone sync locations"
  on public.wearable_sync_locations for select to authenticated
  using ((select auth.uid()) = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-photos',
  'profile-photos',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users upload their profile photos" on storage.objects;
create policy "Users upload their profile photos"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Users update their profile photos" on storage.objects;
create policy "Users update their profile photos"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create or replace function public.handle_eldercare_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.caregivers (id, full_name, email, photo_url)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(coalesce(new.email, 'Caregiver'), '@', 1)
    ),
    new.email,
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture')
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = case
      when public.caregivers.full_name = '' then excluded.full_name
      else public.caregivers.full_name
    end,
    updated_at = now();

  insert into public.onboarding_progress (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_eldercare on auth.users;
create trigger on_auth_user_created_eldercare
  after insert or update of email, raw_user_meta_data on auth.users
  for each row execute procedure public.handle_eldercare_user();

-- Backfill authenticated users who existed before this migration.
insert into public.caregivers (id, full_name, email, photo_url)
select
  id,
  coalesce(
    raw_user_meta_data ->> 'full_name',
    raw_user_meta_data ->> 'name',
    split_part(coalesce(email, 'Caregiver'), '@', 1)
  ),
  email,
  coalesce(raw_user_meta_data ->> 'avatar_url', raw_user_meta_data ->> 'picture')
from auth.users
on conflict (id) do update set email = excluded.email, updated_at = now();

insert into public.onboarding_progress (user_id)
select id from auth.users
on conflict (user_id) do nothing;
