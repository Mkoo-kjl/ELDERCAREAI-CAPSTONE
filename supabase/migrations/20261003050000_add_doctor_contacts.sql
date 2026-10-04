create table if not exists public.doctor_contacts (
  id uuid primary key default gen_random_uuid(),
  caregiver_id uuid not null references public.caregivers(id) on delete cascade,
  elderly_id uuid not null references public.elderly_profiles(elderly_id) on delete cascade,
  full_name text not null,
  phone text not null,
  photo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (caregiver_id, elderly_id)
);

alter table public.doctor_contacts enable row level security;

drop policy if exists "Caregivers manage doctor contacts" on public.doctor_contacts;
create policy "Caregivers manage doctor contacts"
  on public.doctor_contacts for all to authenticated
  using (
    caregiver_id = (select auth.uid())
    and exists (
      select 1 from public.elderly_profiles e
      where e.elderly_id = doctor_contacts.elderly_id
        and e.caregiver_id = (select auth.uid())
    )
  )
  with check (
    caregiver_id = (select auth.uid())
    and exists (
      select 1 from public.elderly_profiles e
      where e.elderly_id = doctor_contacts.elderly_id
        and e.caregiver_id = (select auth.uid())
    )
  );

create index if not exists doctor_contacts_caregiver_elderly_idx
  on public.doctor_contacts (caregiver_id, elderly_id);
