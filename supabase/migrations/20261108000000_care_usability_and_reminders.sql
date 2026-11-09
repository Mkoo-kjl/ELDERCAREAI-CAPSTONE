-- Reuse existing tables; preserve patient, medication and appointment records.
alter table public.medication_schedules
  add column if not exists image_path text,
  add column if not exists prescription_path text,
  add column if not exists prescription_reviewed_at timestamptz,
  add column if not exists related_vitals text[] not null default '{}'::text[];
alter table public.medication_schedules add constraint medication_related_vitals_valid check(
  related_vitals <@ array['heart_rate_bpm','spo2_percent','sleep_hours','steps_count','skin_temp_celsius','hrv_rmssd_ms']::text[]);
alter table public.medication_schedules add constraint medication_image_owner_path check(
  image_path is null or image_path like caregiver_id::text||'/'||elderly_id::text||'/medication-%');
alter table public.medication_schedules add constraint medication_prescription_owner_path check(
  prescription_path is null or prescription_path like caregiver_id::text||'/'||elderly_id::text||'/prescription-%');
alter table public.medication_schedules add constraint medication_prescription_confirmed check(
  prescription_path is null or prescription_reviewed_at is not null);

alter table public.elderly_profiles add column if not exists emergency_contacts jsonb not null default '[]'::jsonb
  check(jsonb_typeof(emergency_contacts)='array' and jsonb_array_length(emergency_contacts)<=3);
alter table public.appointments add column if not exists timezone text not null default 'Asia/Manila';

-- A private bucket is a row in existing Storage tables, not a new database table.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('care-files','care-files',false,10485760,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
create policy "Caregivers read their private care files" on storage.objects for select to authenticated
using(bucket_id='care-files' and (storage.foldername(name))[1]=auth.uid()::text and exists(
  select 1 from public.elderly_profiles e where e.elderly_id::text=(storage.foldername(name))[2] and e.caregiver_id=auth.uid()) and public.is_active_caregiver());
create policy "Caregivers upload private care files" on storage.objects for insert to authenticated
with check(bucket_id='care-files' and (storage.foldername(name))[1]=auth.uid()::text and exists(
  select 1 from public.elderly_profiles e where e.elderly_id::text=(storage.foldername(name))[2] and e.caregiver_id=auth.uid()) and public.is_active_caregiver());
create policy "Caregivers remove their private care files" on storage.objects for delete to authenticated
using(bucket_id='care-files' and (storage.foldername(name))[1]=auth.uid()::text and exists(
  select 1 from public.elderly_profiles e where e.elderly_id::text=(storage.foldername(name))[2] and e.caregiver_id=auth.uid()) and public.is_active_caregiver());

create or replace function public.schedule_care_reminders(p_now timestamptz default now()) returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare med record; clock text; local_day date; due timestamptz; inserted integer; total integer:=0;
begin
  for med in select m.*,e.full_name from public.medication_schedules m join public.elderly_profiles e on e.elderly_id=m.elderly_id and e.caregiver_id=m.caregiver_id
    join public.user_access a on a.user_id=m.caregiver_id where m.is_active and m.reminder_enabled and lower(m.frequency) in ('daily','twice daily','weekly','custom')
      and a.role='caregiver' and a.status='active' and exists(select 1 from pg_timezone_names where name=m.timezone)
  loop
    for local_day in select d::date from generate_series((p_now at time zone med.timezone)::date-1,(p_now at time zone med.timezone)::date,interval '1 day') d loop
      if local_day<coalesce(med.start_date,local_day) or local_day>coalesce(med.end_date,local_day) then continue; end if;
      if lower(med.frequency)='weekly' and extract(isodow from local_day)<>extract(isodow from coalesce(med.start_date,(med.created_at at time zone med.timezone)::date)) then continue; end if;
      foreach clock in array coalesce(med.times_of_day,array[]::text[]) loop
        if clock !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then continue; end if;
        due:=(local_day+clock::time) at time zone med.timezone;
        if due>p_now or due<p_now-interval '15 minutes' then continue; end if;
        if exists(select 1 from public.medication_logs where schedule_id=med.id and status='taken' and scheduled_time=due) then continue; end if;
        insert into public.caregiver_notifications(caregiver_id,elderly_id,notification_type,title,body,data,channel,delivery_status,event_key)
          values(med.caregiver_id,med.elderly_id,'medication','Medication reminder',med.full_name||': time for '||med.medication_name||coalesce(' ('||med.dosage||')','')||' · '||to_char(due at time zone med.timezone,'Mon DD, YYYY HH12:MI AM'),
            jsonb_build_object('care_kind','medication','url','/care?tab=Medications','schedule_id',med.id,'scheduled_time',due,'schedule_version',med.updated_at),
            'in_app','sent','medication:'||med.id||':'||extract(epoch from due)::bigint) on conflict(caregiver_id,event_key) where event_key is not null do nothing;
        get diagnostics inserted=row_count;total:=total+inserted;
      end loop;
    end loop;
  end loop;
  insert into public.caregiver_notifications(caregiver_id,elderly_id,notification_type,title,body,data,channel,delivery_status,event_key)
    select a.caregiver_id,a.elderly_id,'appointment',case when lead.minutes=0 then 'Appointment now: ' else 'Appointment in 15 minutes: ' end||a.title,
      e.full_name||' · '||to_char(a.appointment_at at time zone a.timezone,'Mon DD, YYYY HH12:MI AM')||' ('||a.timezone||')'||coalesce(' · '||a.doctor_name,'')||coalesce(' · '||a.location,'')||coalesce(' · '||nullif(left(a.notes,250),''),''),
      jsonb_build_object('care_kind','appointment','url','/care?tab=Appointments','appointment_id',a.id,'appointment_at',a.appointment_at,'lead_minutes',lead.minutes),
      'in_app','sent','appointment:'||a.id||':'||extract(epoch from a.appointment_at)::bigint||case when lead.minutes=0 then '' else ':15' end
    from public.appointments a join public.elderly_profiles e on e.elderly_id=a.elderly_id and e.caregiver_id=a.caregiver_id
      join public.user_access u on u.user_id=a.caregiver_id cross join (values (15),(0)) as lead(minutes)
    where coalesce(a.status,'upcoming') not in ('completed','cancelled','canceled')
      and a.appointment_at-make_interval(mins=>lead.minutes) between p_now-interval '15 minutes' and p_now
      and (lead.minutes=0 or a.appointment_at>p_now) and u.role='caregiver' and u.status='active'
    on conflict(caregiver_id,event_key) where event_key is not null do nothing;
  get diagnostics inserted=row_count;
  update public.appointments a set reminder_sent=true where not coalesce(a.reminder_sent,false) and exists(
    select 1 from public.caregiver_notifications n where n.event_key='appointment:'||a.id||':'||extract(epoch from a.appointment_at)::bigint and n.caregiver_id=a.caregiver_id);
  return total+inserted;
end $$;

create or replace function public.care_push_is_current_before_workflow(p_notification uuid) returns boolean language plpgsql stable security definer set search_path=public,pg_temp as $$
declare n public.caregiver_notifications; kind text;
begin
  select * into n from public.caregiver_notifications where id=p_notification;
  if not found or not exists(select 1 from public.user_access where user_id=n.caregiver_id and role='caregiver' and status='active') then return false; end if;
  kind:=coalesce(n.data->>'care_kind',case when n.notification_type='emergency' then 'sos' else 'vital' end);
  if n.sent_at<now()-(case when kind='sos' then interval '24 hours' when kind in ('medication','appointment') then interval '15 minutes' else interval '2 hours' end) then return false; end if;
  if kind='medication' then return exists(select 1 from public.medication_schedules m where m.id=(n.data->>'schedule_id')::uuid and m.caregiver_id=n.caregiver_id
    and m.is_active and m.reminder_enabled and m.updated_at=(n.data->>'schedule_version')::timestamptz)
    and not exists(select 1 from public.medication_logs where schedule_id=(n.data->>'schedule_id')::uuid and scheduled_time=(n.data->>'scheduled_time')::timestamptz and status='taken'); end if;
  if kind='appointment' then return exists(select 1 from public.appointments a where a.id=(n.data->>'appointment_id')::uuid and a.caregiver_id=n.caregiver_id
    and coalesce(a.status,'upcoming') not in ('completed','cancelled','canceled') and a.appointment_at=(n.data->>'appointment_at')::timestamptz); end if;
  return true;
end $$;


-- Existing rule-state table only; no new table.
alter table public.care_vital_rule_state add column if not exists last_severity text;
create or replace function public.persist_vital_review() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare owner_id uuid; patient text; rule_name text; rules text[]; unsafe boolean; value float8; threshold float8;
  headline text; description text; severity text; prior public.care_vital_rule_state;
  alert_id uuid; v_event_key text; baseline float8; deviation float8; reference_count integer; historical boolean;
begin
  if new.source is distinct from 'galaxy_watch' or new.is_superseded then return new; end if;
  select e.caregiver_id,e.full_name into owner_id,patient from public.elderly_profiles e join public.user_access a on a.user_id=e.caregiver_id
    where e.elderly_id=new.elderly_id and a.role='caregiver' and a.status='active';
  if owner_id is null then return new; end if;
  historical:=new.measurement_origin='samsung_health' and new.watch_metric='spo2_percent' and new.recorded_at<now()-interval '2 minutes';
  if new.recorded_at>now()+interval '5 minutes' then return new; end if;
  if (new.watch_metric='sleep_hours' or historical) and new.recorded_at<now()-interval '24 hours' then return new; end if;
  if new.watch_metric<>'sleep_hours' and not coalesce(historical,false) and new.recorded_at<now()-interval '2 minutes' then return new; end if;
  rules:=case new.watch_metric when 'heart_rate_bpm' then array['heart_low','heart_high'] when 'spo2_percent' then array['oxygen_low']
    when 'sleep_hours' then array['sleep_short'] when 'skin_temp_celsius' then array['skin_change'] else array[]::text[] end;
  foreach rule_name in array rules loop
    baseline:=null; deviation:=null; reference_count:=0; severity:='warning';
    case rule_name
      when 'heart_low' then value:=new.heart_rate_bpm;threshold:=50;unsafe:=value>=1 and value<threshold;headline:='Heart rate below review threshold';
      when 'heart_high' then value:=new.heart_rate_bpm;threshold:=110;unsafe:=value>threshold and value<=350;headline:='Heart rate above review threshold';
      when 'oxygen_low' then value:=new.spo2_percent;threshold:=95;unsafe:=value>=1 and value<threshold;headline:=case when historical then 'Recorded oxygen below review threshold' else 'Blood oxygen below review threshold' end;
      when 'sleep_short' then value:=new.sleep_hours;threshold:=5;unsafe:=value>0 and value<threshold;headline:='Short recorded sleep session';
      when 'skin_change' then
        value:=new.skin_temp_celsius;threshold:=0.8;headline:='Wrist temperature differs from recent baseline';
        select avg(v),stddev_pop(v),count(*) into baseline,deviation,reference_count from (
          select skin_temp_celsius v from public.vital_sign_logs where elderly_id=new.elderly_id and watch_device_id=new.watch_device_id and not is_superseded
            and skin_temp_celsius is not null and recorded_at<new.recorded_at and recorded_at>=new.recorded_at-interval '24 hours'
          order by recorded_at desc limit 7
        ) b;
        unsafe:=reference_count>=5 and deviation>0 and abs(value-baseline)>=threshold and abs(value-baseline)>=2*deviation;
    end case;
    if value is null then continue; end if;
    if rule_name='oxygen_low' and value<=92 then severity:='critical';headline:='Blood oxygen needs prompt confirmation';end if;
    if rule_name in ('sleep_short','oxygen_low') and (rule_name='sleep_short' or historical) then
      if not coalesce(unsafe,false) then continue; end if;
      v_event_key:='recorded:'||rule_name||':'||coalesce(new.source_device_id,new.watch_device_id::text)||':'||coalesce(new.source_group_key,new.id::text);
      if exists(select 1 from public.caregiver_notifications n where n.caregiver_id=owner_id and n.event_key=v_event_key) then continue; end if;
    else
      insert into public.care_vital_rule_state(elderly_id,rule) values(new.elderly_id,rule_name) on conflict do nothing;
      select * into prior from public.care_vital_rule_state where elderly_id=new.elderly_id and care_vital_rule_state.rule=rule_name for update;
      if new.recorded_at<=coalesce(prior.measured_at,'-infinity') then continue; end if;
      update public.care_vital_rule_state set active=coalesce(unsafe,false),measured_at=new.recorded_at,last_severity=severity where elderly_id=new.elderly_id and care_vital_rule_state.rule=rule_name;
      if not coalesce(unsafe,false) or (prior.active and prior.notified_at>now()-interval '1 hour' and not(severity='critical' and prior.last_severity is distinct from 'critical')) then continue; end if;
      update public.care_vital_rule_state set notified_at=now() where elderly_id=new.elderly_id and care_vital_rule_state.rule=rule_name;
      v_event_key:='vital:'||rule_name||':'||new.id::text;
    end if;
    description:=case rule_name when 'heart_low' then patient||': recorded heart rate '||value||' BPM, below 50 BPM.'
      when 'heart_high' then patient||': recorded heart rate '||value||' BPM, above 110 BPM.'
      when 'oxygen_low' then patient||': recorded SpO₂ '||round(value::numeric,1)||'%, below 95%.'
      when 'sleep_short' then patient||': recorded sleep session '||round(value::numeric,2)||' hours, below the 5-hour app review threshold.'
      else patient||': wrist skin temperature changed by '||round(abs(value-baseline)::numeric,1)||'°C from the recent reference. This is not core temperature or a fever measurement.' end;
    if historical then description:=description||' This is imported history, not a live oxygen alarm.'; end if;
    description:=description||' Confirm the reading and consider activity, symptoms and your care plan.';
    insert into public.health_alerts(elderly_id,alert_type,severity,title,message,ai_generated)
      values(new.elderly_id,rule_name,severity,headline,description,false) returning id into alert_id;
    insert into public.caregiver_notifications(caregiver_id,elderly_id,alert_id,notification_type,title,body,data,channel,delivery_status,event_key)
      values(owner_id,new.elderly_id,alert_id,'health_alert',headline,description,
        jsonb_build_object('care_kind','vital','url','/alerts?tab=Alerts','vital_log_id',new.id,'rule',rule_name,'measured_at',new.recorded_at,'historical',coalesce(historical,false)),
        'in_app','sent',v_event_key) on conflict(caregiver_id,event_key) where event_key is not null do nothing;
  end loop;
  return new;
end $$;
