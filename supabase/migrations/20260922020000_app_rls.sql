-- Row-level security for the caregiver-facing application tables.

alter table public.vital_sign_logs enable row level security;
alter table public.medication_schedules enable row level security;
alter table public.medication_logs enable row level security;
alter table public.appointments enable row level security;
alter table public.caregiver_notes enable row level security;
alter table public.health_alerts enable row level security;
alter table public.caregiver_notifications enable row level security;
alter table public.emergency_events enable row level security;
alter table public.ai_chatbot_sessions enable row level security;
alter table public.ai_chatbot_messages enable row level security;

drop policy if exists "Caregivers read elderly vitals" on public.vital_sign_logs;
create policy "Caregivers read elderly vitals" on public.vital_sign_logs
  for select to authenticated using (exists (
    select 1 from public.elderly_profiles e
    where e.elderly_id = vital_sign_logs.elderly_id and e.caregiver_id = (select auth.uid())
  ));

drop policy if exists "Caregivers manage medication schedules" on public.medication_schedules;
create policy "Caregivers manage medication schedules" on public.medication_schedules
  for all to authenticated
  using (caregiver_id = (select auth.uid()))
  with check (caregiver_id = (select auth.uid()));

drop policy if exists "Caregivers read medication logs" on public.medication_logs;
create policy "Caregivers read medication logs" on public.medication_logs
  for select to authenticated using (exists (
    select 1 from public.elderly_profiles e
    where e.elderly_id = medication_logs.elderly_id and e.caregiver_id = (select auth.uid())
  ));
drop policy if exists "Caregivers create medication logs" on public.medication_logs;
create policy "Caregivers create medication logs" on public.medication_logs
  for insert to authenticated with check (recorded_by = (select auth.uid()));

drop policy if exists "Caregivers manage appointments" on public.appointments;
create policy "Caregivers manage appointments" on public.appointments
  for all to authenticated
  using (caregiver_id = (select auth.uid()))
  with check (caregiver_id = (select auth.uid()));

drop policy if exists "Caregivers manage notes" on public.caregiver_notes;
create policy "Caregivers manage notes" on public.caregiver_notes
  for all to authenticated
  using (caregiver_id = (select auth.uid()))
  with check (caregiver_id = (select auth.uid()));

drop policy if exists "Caregivers manage elderly alerts" on public.health_alerts;
create policy "Caregivers manage elderly alerts" on public.health_alerts
  for all to authenticated
  using (exists (
    select 1 from public.elderly_profiles e
    where e.elderly_id = health_alerts.elderly_id and e.caregiver_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.elderly_profiles e
    where e.elderly_id = health_alerts.elderly_id and e.caregiver_id = (select auth.uid())
  ));

drop policy if exists "Caregivers manage notifications" on public.caregiver_notifications;
create policy "Caregivers manage notifications" on public.caregiver_notifications
  for all to authenticated
  using (caregiver_id = (select auth.uid()))
  with check (caregiver_id = (select auth.uid()));

drop policy if exists "Caregivers manage emergency events" on public.emergency_events;
create policy "Caregivers manage emergency events" on public.emergency_events
  for all to authenticated
  using (exists (
    select 1 from public.elderly_profiles e
    where e.elderly_id = emergency_events.elderly_id and e.caregiver_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.elderly_profiles e
    where e.elderly_id = emergency_events.elderly_id and e.caregiver_id = (select auth.uid())
  ));

drop policy if exists "Caregivers manage chatbot sessions" on public.ai_chatbot_sessions;
create policy "Caregivers manage chatbot sessions" on public.ai_chatbot_sessions
  for all to authenticated
  using (caregiver_id = (select auth.uid()))
  with check (caregiver_id = (select auth.uid()));

drop policy if exists "Caregivers manage chatbot messages" on public.ai_chatbot_messages;
create policy "Caregivers manage chatbot messages" on public.ai_chatbot_messages
  for all to authenticated
  using (exists (
    select 1 from public.ai_chatbot_sessions s
    where s.id = ai_chatbot_messages.session_id and s.caregiver_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.ai_chatbot_sessions s
    where s.id = ai_chatbot_messages.session_id and s.caregiver_id = (select auth.uid())
  ));

create index if not exists vital_sign_logs_elderly_recorded_idx on public.vital_sign_logs (elderly_id, recorded_at desc);
create index if not exists health_alerts_elderly_triggered_idx on public.health_alerts (elderly_id, triggered_at desc);
create index if not exists appointments_caregiver_date_idx on public.appointments (caregiver_id, appointment_at);
