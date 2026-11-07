alter table public.caregiver_notifications add column event_key text,
  add column push_status text not null default 'not_registered', add column push_error text;
create unique index care_notification_event_unique on public.caregiver_notifications(caregiver_id,event_key) where event_key is not null;
alter table public.medication_schedules add column timezone text not null default 'Asia/Manila';

create table public.care_vital_rule_state (
  elderly_id uuid not null references public.elderly_profiles(elderly_id) on delete cascade,
  rule text not null, active boolean not null default false, measured_at timestamptz,
  notified_at timestamptz, primary key(elderly_id,rule)
);
create table public.care_push_jobs (
  id uuid primary key default gen_random_uuid(), notification_id uuid not null references public.caregiver_notifications(id) on delete cascade,
  token text not null, status text not null default 'pending', attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(), lease_id uuid, leased_until timestamptz,
  ticket_id text, error text, receipt_checked_at timestamptz, created_at timestamptz not null default now(),
  unique(notification_id,token)
);
create index care_push_due on public.care_push_jobs(status,next_attempt_at);
alter table public.care_vital_rule_state enable row level security;
alter table public.care_push_jobs enable row level security;
revoke all on public.care_vital_rule_state,public.care_push_jobs from anon,authenticated;
grant all on public.care_vital_rule_state,public.care_push_jobs to service_role;

create function public.queue_care_push() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  insert into public.care_push_jobs(notification_id,token)
    select new.id,t.token from public.caregiver_push_tokens t join public.user_access a on a.user_id=t.caregiver_id
    where t.caregiver_id=new.caregiver_id and a.role='caregiver' and a.status='active'
      and t.updated_at>now()-interval '90 days' on conflict do nothing;
  update public.caregiver_notifications set push_status=case when exists(select 1 from public.care_push_jobs where notification_id=new.id) then 'queued' else 'not_registered' end where id=new.id;
  return new;
end $$;
create trigger care_notification_push after insert on public.caregiver_notifications for each row execute function public.queue_care_push();

create function public.register_care_push(p_token text,p_timezone text) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare old_owner uuid; registered_owner uuid:=auth.uid();
begin
  if not public.is_active_caregiver() then raise exception 'Active caregiver required'; end if;
  if p_token is null or length(p_token)>256 or p_token !~ '^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$' then raise exception 'Invalid notification token'; end if;
  if not exists(select 1 from pg_timezone_names where name=p_timezone) then raise exception 'Invalid timezone'; end if;
  select caregiver_id into old_owner from public.caregiver_push_tokens where token=p_token;
  insert into public.caregiver_push_tokens(token,caregiver_id,updated_at) values(p_token,registered_owner,now())
    on conflict(token) do update set caregiver_id=excluded.caregiver_id,updated_at=now();
  insert into public.care_push_jobs(notification_id,token)
    select n.id,p_token from public.caregiver_notifications n where n.caregiver_id=registered_owner and not n.is_read and n.sent_at>now()-interval '15 minutes'
    on conflict do nothing;
  if old_owner is distinct from registered_owner then
    insert into public.caregiver_notifications(caregiver_id,elderly_id,notification_type,title,body,data,channel,delivery_status,event_key)
      select registered_owner,e.elderly_id,'system','Background notifications enabled','This phone is registered for care reminders and health alerts.',
        jsonb_build_object('care_kind','system','url','/alerts?tab=Notifications'),'in_app','sent','registration:'||md5(p_token)
      from public.elderly_profiles e where e.caregiver_id=registered_owner order by e.created_at limit 1
      on conflict(caregiver_id,event_key) where event_key is not null do nothing;
  end if;
  return jsonb_build_object('registered',true);
end $$;
revoke all on function public.register_care_push(text,text) from public,anon;
grant execute on function public.register_care_push(text,text) to authenticated;

create function public.persist_vital_review() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare owner_id uuid; patient text; rule_name text; rules text[]; unsafe boolean; value float8; threshold float8;
  headline text; description text; severity text; prior public.care_vital_rule_state;
  alert_id uuid; event_key text; baseline float8; deviation float8; reference_count integer; historical boolean;
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
    if rule_name in ('sleep_short','oxygen_low') and (rule_name='sleep_short' or historical) then
      if not coalesce(unsafe,false) then continue; end if;
      event_key:='recorded:'||rule_name||':'||coalesce(new.source_device_id,new.watch_device_id::text)||':'||coalesce(new.source_group_key,new.id::text);
      if exists(select 1 from public.caregiver_notifications n where n.caregiver_id=owner_id and n.event_key=event_key) then continue; end if;
    else
      insert into public.care_vital_rule_state(elderly_id,rule) values(new.elderly_id,rule_name) on conflict do nothing;
      select * into prior from public.care_vital_rule_state where elderly_id=new.elderly_id and care_vital_rule_state.rule=rule_name for update;
      if new.recorded_at<=coalesce(prior.measured_at,'-infinity') then continue; end if;
      update public.care_vital_rule_state set active=coalesce(unsafe,false),measured_at=new.recorded_at where elderly_id=new.elderly_id and care_vital_rule_state.rule=rule_name;
      if not coalesce(unsafe,false) or (prior.active and prior.notified_at>now()-interval '1 hour') then continue; end if;
      update public.care_vital_rule_state set notified_at=now() where elderly_id=new.elderly_id and care_vital_rule_state.rule=rule_name;
      event_key:='vital:'||rule_name||':'||new.id::text;
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
        'in_app','sent',event_key) on conflict(caregiver_id,event_key) where event_key is not null do nothing;
  end loop;
  return new;
end $$;
create trigger persist_vital_review after insert on public.vital_sign_logs for each row execute function public.persist_vital_review();

create function public.schedule_care_reminders(p_now timestamptz default now()) returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare med record; clock text; local_day date; due timestamptz; inserted integer; total integer:=0;
begin
  for med in select m.*,e.full_name from public.medication_schedules m join public.elderly_profiles e on e.elderly_id=m.elderly_id and e.caregiver_id=m.caregiver_id
    join public.user_access a on a.user_id=m.caregiver_id where m.is_active and m.reminder_enabled and lower(m.frequency) in ('daily','twice daily','weekly')
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
          values(med.caregiver_id,med.elderly_id,'medication','Medication reminder',med.full_name||': time for '||med.medication_name||coalesce(' ('||med.dosage||')','')||'.',
            jsonb_build_object('care_kind','medication','url','/care?tab=Medications','schedule_id',med.id,'scheduled_time',due,'schedule_version',med.updated_at),
            'in_app','sent','medication:'||med.id||':'||extract(epoch from due)::bigint) on conflict(caregiver_id,event_key) where event_key is not null do nothing;
        get diagnostics inserted=row_count;total:=total+inserted;
      end loop;
    end loop;
  end loop;
  insert into public.caregiver_notifications(caregiver_id,elderly_id,notification_type,title,body,data,channel,delivery_status,event_key)
    select a.caregiver_id,a.elderly_id,'appointment','Appointment now: '||a.title,e.full_name||coalesce(' · '||a.doctor_name,'')||coalesce(' · '||a.location,''),
      jsonb_build_object('care_kind','appointment','url','/care?tab=Appointments','appointment_id',a.id,'appointment_at',a.appointment_at),
      'in_app','sent','appointment:'||a.id||':'||extract(epoch from a.appointment_at)::bigint
    from public.appointments a join public.elderly_profiles e on e.elderly_id=a.elderly_id and e.caregiver_id=a.caregiver_id
      join public.user_access u on u.user_id=a.caregiver_id where a.status not in ('completed','cancelled','canceled')
      and a.appointment_at between p_now-interval '15 minutes' and p_now and u.role='caregiver' and u.status='active'
    on conflict(caregiver_id,event_key) where event_key is not null do nothing;
  get diagnostics inserted=row_count;return total+inserted;
end $$;

create function public.care_push_is_current(p_notification uuid) returns boolean language plpgsql stable security definer set search_path=public,pg_temp as $$
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
    and a.status not in ('completed','cancelled','canceled') and a.appointment_at=(n.data->>'appointment_at')::timestamptz); end if;
  return true;
end $$;

create function public.claim_care_push(p_limit integer default 50) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
  update public.care_push_jobs j set status='expired',error='Reminder no longer current' where j.status in ('pending','processing') and not public.care_push_is_current(j.notification_id);
  with picked as (select id from public.care_push_jobs j where ((status='pending' and next_attempt_at<=now()) or (status='processing' and leased_until<now()))
      and attempts<12 order by created_at for update skip locked limit greatest(1,least(p_limit,100))),
    claimed as (update public.care_push_jobs j set status='processing',lease_id=gen_random_uuid(),leased_until=now()+interval '90 seconds',attempts=attempts+1
      from picked p where j.id=p.id returning j.*)
  select coalesce(jsonb_agg(to_jsonb(c)||jsonb_build_object('title',n.title,'body',n.body,'data',n.data,'kind',coalesce(n.data->>'care_kind',case when n.notification_type='emergency' then 'sos' else 'vital' end))),'[]'::jsonb)
    into result from claimed c join public.caregiver_notifications n on n.id=c.notification_id;
  return result;
end $$;

create function public.refresh_care_push_status(p_notification uuid) returns void language sql security definer set search_path=public,pg_temp as $$
  update public.caregiver_notifications n set push_status=case
    when exists(select 1 from public.care_push_jobs where notification_id=n.id and status='confirmed') then 'accepted'
    when exists(select 1 from public.care_push_jobs where notification_id=n.id and status='submitted') then 'submitted'
    when exists(select 1 from public.care_push_jobs where notification_id=n.id and status in ('pending','processing')) then 'queued'
    when exists(select 1 from public.care_push_jobs where notification_id=n.id and status='failed') then 'failed'
    when exists(select 1 from public.care_push_jobs where notification_id=n.id) then 'expired' else 'not_registered' end,
    push_error=(select error from public.care_push_jobs where notification_id=n.id and error is not null order by next_attempt_at desc limit 1)
    where n.id=p_notification;
$$;

revoke all on function public.schedule_care_reminders(timestamptz),public.claim_care_push(integer),public.refresh_care_push_status(uuid),public.care_push_is_current(uuid),public.persist_vital_review(),public.queue_care_push() from public,anon,authenticated;
grant execute on function public.schedule_care_reminders(timestamptz),public.claim_care_push(integer),public.refresh_care_push_status(uuid),public.care_push_is_current(uuid) to service_role;

create function public.care_push_ready() returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select exists(select 1 from public.care_push_jobs where status='pending' and next_attempt_at<=now());
$$;
revoke all on function public.care_push_ready() from public,anon,authenticated;
grant execute on function public.care_push_ready() to service_role;
