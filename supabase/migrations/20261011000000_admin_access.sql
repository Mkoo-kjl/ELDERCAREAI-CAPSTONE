-- Keep authorization in the database. The public website only carries a
-- publishable key; it can never assign itself the admin role.
create table if not exists public.user_access (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'caregiver' check (role in ('caregiver', 'admin')),
  status text not null default 'active' check (status in ('active', 'suspended')),
  updated_at timestamptz not null default now()
);

insert into public.user_access (user_id)
select id from auth.users
on conflict (user_id) do nothing;

create or replace function public.assign_eldercare_access()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.user_access (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_access_created on auth.users;
create trigger on_auth_user_access_created
  after insert on auth.users for each row execute procedure public.assign_eldercare_access();

alter table public.user_access enable row level security;
revoke all on public.user_access from anon, authenticated;
grant select on public.user_access to authenticated;
create policy "Users read their own access" on public.user_access
  for select to authenticated using (user_id = (select auth.uid()));

-- An admin cannot accidentally suspend or delete the final active admin.
-- The advisory lock serializes two simultaneous administrator changes.
create or replace function public.protect_last_active_admin()
returns trigger language plpgsql security definer set search_path = '' as $$
declare removing_active_admin boolean := false;
begin
  if old.role = 'admin' and old.status = 'active' then
    if tg_op = 'DELETE' then
      removing_active_admin := true;
    else
      removing_active_admin := new.role <> 'admin' or new.status <> 'active';
    end if;
  end if;
  if removing_active_admin then
    perform pg_catalog.pg_advisory_xact_lock(813041062);
    if (select count(*) from public.user_access where role = 'admin' and status = 'active') <= 1 then
      raise exception 'The last active administrator cannot be removed';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger protect_last_active_admin
  before update or delete on public.user_access
  for each row execute procedure public.protect_last_active_admin();

create or replace function public.is_active_caregiver()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.user_access
    where user_id = (select auth.uid()) and role = 'caregiver' and status = 'active'
  );
$$;
revoke all on function public.is_active_caregiver() from public, anon;
grant execute on function public.is_active_caregiver() to authenticated;

-- Restrictive policies are ANDed with the existing ownership policies. A
-- suspended account cannot keep reading records with an unexpired JWT.
do $$
declare table_name text;
begin
  foreach table_name in array array[
    'profiles', 'caregivers', 'elderly_profiles', 'onboarding_progress',
    'wearable_sync_locations', 'vital_sign_logs', 'medication_schedules',
    'medication_logs', 'appointments', 'caregiver_notes', 'health_alerts',
    'caregiver_notifications', 'emergency_events', 'ai_chatbot_sessions',
    'ai_chatbot_messages', 'doctor_contacts'
  ] loop
    execute format(
      'create policy "Active caregiver access" on public.%I as restrictive for all to authenticated using ((select public.is_active_caregiver())) with check ((select public.is_active_caregiver()))',
      table_name
    );
  end loop;
end;
$$;

create policy "Active caregiver profile photo access" on storage.objects
  as restrictive for all to authenticated
  using (bucket_id <> 'profile-photos' or (select public.is_active_caregiver()))
  with check (bucket_id <> 'profile-photos' or (select public.is_active_caregiver()));

create table if not exists public.admin_audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_type text,
  target_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists admin_audit_log_created_idx on public.admin_audit_log (created_at desc);
alter table public.admin_audit_log enable row level security;
revoke all on public.admin_audit_log from anon, authenticated;

-- Keep dependent-record deletion atomic. Only the trusted service-role Edge
-- Function may invoke these RPCs; the website cannot execute them directly.
create or replace function public.admin_delete_elderly_data(p_elderly_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Service role required';
  end if;
  if not exists (select 1 from public.elderly_profiles where elderly_id = p_elderly_id) then
    raise exception 'Older adult profile not found';
  end if;
  delete from public.caregiver_notifications where elderly_id = p_elderly_id;
  delete from public.medication_logs where elderly_id = p_elderly_id;
  delete from public.health_alerts where elderly_id = p_elderly_id;
  delete from public.emergency_events where elderly_id = p_elderly_id;
  delete from public.ai_chatbot_messages where session_id in
    (select id from public.ai_chatbot_sessions where elderly_id = p_elderly_id);
  delete from public.ai_chatbot_sessions where elderly_id = p_elderly_id;
  delete from public.medication_schedules where elderly_id = p_elderly_id;
  delete from public.appointments where elderly_id = p_elderly_id;
  delete from public.caregiver_notes where elderly_id = p_elderly_id;
  delete from public.doctor_contacts where elderly_id = p_elderly_id;
  delete from public.wearable_sync_locations where elderly_id = p_elderly_id;
  delete from public.vital_sign_logs where elderly_id = p_elderly_id;
  delete from public.elderly_profiles where elderly_id = p_elderly_id;
end;
$$;
revoke all on function public.admin_delete_elderly_data(uuid) from public, anon, authenticated;
grant execute on function public.admin_delete_elderly_data(uuid) to service_role;

create or replace function public.admin_purge_caregiver_data(p_caregiver_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare patient record;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Service role required';
  end if;
  for patient in select elderly_id from public.elderly_profiles where caregiver_id = p_caregiver_id loop
    perform public.admin_delete_elderly_data(patient.elderly_id);
  end loop;
  update public.health_alerts set resolved_by = null where resolved_by = p_caregiver_id;
  update public.emergency_events set responded_by = null where responded_by = p_caregiver_id;
  update public.medication_logs set recorded_by = null where recorded_by = p_caregiver_id;
  delete from public.caregiver_notifications where caregiver_id = p_caregiver_id;
  delete from public.google_health_oauth_states where user_id = p_caregiver_id;
  delete from public.google_health_tokens where user_id = p_caregiver_id;
  delete from public.wearable_sync_locations where user_id = p_caregiver_id;
  delete from public.caregivers where id = p_caregiver_id;
end;
$$;
revoke all on function public.admin_purge_caregiver_data(uuid) from public, anon, authenticated;
grant execute on function public.admin_purge_caregiver_data(uuid) to service_role;

-- Provision the admin in Supabase Auth first, then run the one-time role
-- update in the deployment guide. Never insert a password into SQL or JS.
