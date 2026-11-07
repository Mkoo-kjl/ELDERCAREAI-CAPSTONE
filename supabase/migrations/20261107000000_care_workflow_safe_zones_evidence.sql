-- Patient-scoped response history, watch GPS boundaries and traceable AI sources.
alter table public.health_alerts
  add column acknowledged_at timestamptz,
  add column acknowledged_by uuid references auth.users(id) on delete set null,
  add column emergency_event_id uuid references public.emergency_events(id) on delete set null,
  add column resolution_note text check(length(resolution_note)<=2000);

create table public.alert_response_events (
  id uuid primary key default gen_random_uuid(),
  alert_id uuid not null references public.health_alerts(id) on delete cascade,
  elderly_id uuid not null references public.elderly_profiles(elderly_id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null check(action in ('acknowledged','resolved')),
  note text check(length(note)<=2000), occurred_at timestamptz not null default now(),
  unique(alert_id,action)
);
alter table public.alert_response_events enable row level security;
revoke all on public.alert_response_events from anon,authenticated;
grant select on public.alert_response_events to authenticated;
grant all on public.alert_response_events to service_role;
create policy own_alert_response_events on public.alert_response_events for select to authenticated
  using((select public.is_active_caregiver()) and exists(select 1 from public.elderly_profiles e
    where e.elderly_id=alert_response_events.elderly_id and e.caregiver_id=(select auth.uid())));

create function public.stamp_alert_response() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if old.acknowledged_at is not null and new.acknowledged_at is distinct from old.acknowledged_at then
    raise exception 'An acknowledgment cannot be removed or retimed'; end if;
  if old.is_resolved and not new.is_resolved then raise exception 'A resolved alert cannot be reopened'; end if;
  if old.is_resolved and new.resolution_note is distinct from old.resolution_note then raise exception 'The resolution note is final'; end if;
  if old.is_resolved and (new.resolved_at is distinct from old.resolved_at or (new.resolved_by is not null and new.resolved_by is distinct from old.resolved_by)) then
    raise exception 'The resolution actor and time are final'; end if;
  if (new.acknowledged_at is not null or (new.is_resolved and not coalesce(old.is_resolved,false))) and old.acknowledged_at is null then
    new.acknowledged_at:=now(); new.acknowledged_by:=coalesce(auth.uid(),new.acknowledged_by); new.is_read:=true;
  elsif old.acknowledged_at is not null and new.acknowledged_by is not null then
    new.acknowledged_by:=old.acknowledged_by;
  end if;
  if new.is_resolved and not coalesce(old.is_resolved,false) then
    new.resolved_at:=now(); new.resolved_by:=coalesce(auth.uid(),new.resolved_by); new.is_read:=true;
  end if;
  return new;
end $$;
create trigger stamp_alert_response before update on public.health_alerts for each row execute function public.stamp_alert_response();
create function public.audit_alert_response() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if old.acknowledged_at is null and new.acknowledged_at is not null then
    insert into public.alert_response_events(alert_id,elderly_id,actor_id,action,occurred_at)
      values(new.id,new.elderly_id,new.acknowledged_by,'acknowledged',new.acknowledged_at) on conflict do nothing;
  end if;
  if new.is_resolved and not coalesce(old.is_resolved,false) then
    insert into public.alert_response_events(alert_id,elderly_id,actor_id,action,note,occurred_at)
      values(new.id,new.elderly_id,new.resolved_by,'resolved',new.resolution_note,new.resolved_at) on conflict do nothing;
  end if;
  return new;
end $$;
create trigger audit_alert_response after update on public.health_alerts for each row execute function public.audit_alert_response();

create function public.respond_to_care_alert(p_alert uuid,p_action text,p_note text default null) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare selected public.health_alerts; cleaned text:=nullif(btrim(p_note),'');
begin
  if not public.is_active_caregiver() then raise exception 'Active caregiver required'; end if;
  select a.* into selected from public.health_alerts a join public.elderly_profiles e on e.elderly_id=a.elderly_id
    where a.id=p_alert and e.caregiver_id=auth.uid() for update of a;
  if not found then raise exception 'Alert access denied'; end if;
  if p_action not in ('acknowledge','resolve') or p_action is null then raise exception 'Unsupported response'; end if;
  if selected.is_resolved then return to_jsonb(selected); end if;
  if p_action='resolve' and (cleaned is null or length(cleaned)<3 or length(cleaned)>2000) then
    raise exception 'Add a response note between 3 and 2000 characters'; end if;
  update public.health_alerts set acknowledged_at=coalesce(acknowledged_at,now()),acknowledged_by=coalesce(acknowledged_by,auth.uid()),
    is_resolved=case when p_action='resolve' then true else is_resolved end,
    resolution_note=case when p_action='resolve' then cleaned else resolution_note end where id=p_alert returning * into selected;
  update public.caregiver_notifications set is_read=true,read_at=coalesce(read_at,now()) where alert_id=p_alert and caregiver_id=auth.uid();
  if p_action='resolve' then
    update public.emergency_events ev set is_resolved=true,responded_by=auth.uid(),responded_at=now(),resolution_notes=cleaned
      where ev.elderly_id=selected.elderly_id and not ev.is_resolved and (ev.id=selected.emergency_event_id or exists(select 1 from public.caregiver_notifications n where n.alert_id=p_alert
        and coalesce(n.data->>'emergency_event_id',n.data->>'watch_sos_id')=ev.id::text));
  end if;
  return to_jsonb(selected);
end $$;
revoke all on function public.respond_to_care_alert(uuid,text,text) from public,anon;
grant execute on function public.respond_to_care_alert(uuid,text,text) to authenticated;
revoke all on function public.stamp_alert_response(),public.audit_alert_response() from public,anon,authenticated;

create function public.sync_emergency_alert_response() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if new.is_resolved and not coalesce(old.is_resolved,false) then
    update public.health_alerts a set is_resolved=true,resolved_by=new.responded_by,
      resolution_note=coalesce(nullif(btrim(new.resolution_notes),''),'Marked resolved without a response note.')
      where a.elderly_id=new.elderly_id and not a.is_resolved and (a.emergency_event_id=new.id or exists(select 1 from public.caregiver_notifications n
        where n.alert_id=a.id and coalesce(n.data->>'emergency_event_id',n.data->>'watch_sos_id')=new.id::text));
  end if;
  return new;
end $$;
revoke all on function public.sync_emergency_alert_response() from public,anon,authenticated;
create trigger sync_emergency_alert_response after update of is_resolved on public.emergency_events for each row execute function public.sync_emergency_alert_response();

-- Keep the emergency relationship after the caregiver clears notifications.
update public.health_alerts a set emergency_event_id=e.id from public.caregiver_notifications n
  join public.emergency_events e on e.id::text=coalesce(n.data->>'emergency_event_id',n.data->>'watch_sos_id')
  where a.id=n.alert_id and a.elderly_id=e.elderly_id;
create function public.link_emergency_alert() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  update public.health_alerts a set emergency_event_id=e.id from public.emergency_events e
    where a.id=new.alert_id and a.elderly_id=new.elderly_id and e.elderly_id=a.elderly_id
      and e.id::text=coalesce(new.data->>'emergency_event_id',new.data->>'watch_sos_id');
  return new;
end $$;
revoke all on function public.link_emergency_alert() from public,anon,authenticated;
create trigger link_emergency_alert after insert on public.caregiver_notifications for each row execute function public.link_emergency_alert();

create table public.patient_safe_zones (
  elderly_id uuid primary key references public.elderly_profiles(elderly_id) on delete cascade,
  caregiver_id uuid not null references auth.users(id) on delete cascade,
  name text not null check(length(btrim(name)) between 1 and 80),
  latitude float8 not null check(latitude between -90 and 90),longitude float8 not null check(longitude between -180 and 180),
  radius_m integer not null check(radius_m between 100 and 5000),enabled boolean not null default false,
  revision uuid not null default gen_random_uuid(),updated_at timestamptz not null default now()
);
create table public.patient_safe_zone_state (
  elderly_id uuid primary key references public.patient_safe_zones(elderly_id) on delete cascade,
  status text not null default 'unknown' check(status in ('unknown','inside','outside')),
  device_id uuid references public.wearable_devices(id) on delete set null,
  last_point_at timestamptz,last_fix_at timestamptz,confirmed_at timestamptz,checked_at timestamptz,
  candidate text,candidate_since timestamptz,candidate_count integer not null default 0,
  distance_m float8,last_check text not null default 'Waiting for fresh watch GPS',last_alert_id uuid references public.health_alerts(id) on delete set null
);
create table public.safe_zone_events (
  id uuid primary key default gen_random_uuid(),elderly_id uuid not null references public.elderly_profiles(elderly_id) on delete cascade,
  zone_revision uuid not null,zone_name text not null,direction text not null check(direction in ('outside','inside')),
  distance_m float8 not null,accuracy_m float8 not null,measured_at timestamptz not null,created_at timestamptz not null default now(),
  alert_id uuid references public.health_alerts(id) on delete set null
);
create index safe_zone_events_patient_time on public.safe_zone_events(elderly_id,measured_at desc);
alter table public.patient_safe_zones enable row level security;
alter table public.patient_safe_zone_state enable row level security;
alter table public.safe_zone_events enable row level security;
revoke all on public.patient_safe_zones,public.patient_safe_zone_state,public.safe_zone_events from anon,authenticated;
grant select on public.patient_safe_zones,public.patient_safe_zone_state,public.safe_zone_events to authenticated;
grant all on public.patient_safe_zones,public.patient_safe_zone_state,public.safe_zone_events to service_role;
do $$ declare tab text; begin
  foreach tab in array array['patient_safe_zones','patient_safe_zone_state','safe_zone_events'] loop
    execute format('create policy own_patient on public.%1$I for select to authenticated using ((select public.is_active_caregiver()) and exists(select 1 from public.elderly_profiles e where e.elderly_id=%1$I.elderly_id and e.caregiver_id=(select auth.uid())))',tab);
  end loop;
end $$;

create function public.save_patient_safe_zone(p_elderly uuid,p_name text,p_latitude float8,p_longitude float8,p_radius integer,p_enabled boolean)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare saved public.patient_safe_zones;
begin
  if not public.is_active_caregiver() or not exists(select 1 from public.elderly_profiles where elderly_id=p_elderly and caregiver_id=auth.uid()) then raise exception 'Patient access denied'; end if;
  if p_name is null or length(btrim(p_name)) not between 1 and 80 or p_latitude is null or p_longitude is null or p_radius is null or p_enabled is null
    or not(p_latitude between -90 and 90 and p_longitude between -180 and 180 and p_radius between 100 and 5000) then raise exception 'Choose a valid name, center and radius (100–5000 meters)'; end if;
  insert into public.patient_safe_zones(elderly_id,caregiver_id,name,latitude,longitude,radius_m,enabled)
    values(p_elderly,auth.uid(),btrim(p_name),p_latitude,p_longitude,p_radius,p_enabled)
    on conflict(elderly_id) do update set name=excluded.name,latitude=excluded.latitude,longitude=excluded.longitude,radius_m=excluded.radius_m,
      enabled=excluded.enabled,caregiver_id=excluded.caregiver_id,revision=gen_random_uuid(),updated_at=now() returning * into saved;
  delete from public.patient_safe_zone_state where elderly_id=p_elderly;
  insert into public.patient_safe_zone_state(elderly_id) values(p_elderly);
  return to_jsonb(saved);
end $$;
revoke all on function public.save_patient_safe_zone(uuid,text,float8,float8,integer,boolean) from public,anon;
grant execute on function public.save_patient_safe_zone(uuid,text,float8,float8,integer,boolean) to authenticated;

create function public.evaluate_watch_safe_zone() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare zone public.patient_safe_zones; previous public.patient_safe_zone_state; target text; gap boolean; distance float8;
  v_count integer; v_since timestamptz; event_id uuid; alert_id uuid; patient text; headline text; copy text; h float8;
begin
  select z.* into zone from public.patient_safe_zones z join public.elderly_profiles e on e.elderly_id=z.elderly_id and e.caregiver_id=z.caregiver_id
    join public.user_access u on u.user_id=z.caregiver_id and u.role='caregiver' and u.status='active'
    where z.elderly_id=new.elderly_id and z.enabled for update of z;
  if not found then return new; end if;
  insert into public.patient_safe_zone_state(elderly_id) values(new.elderly_id) on conflict do nothing;
  select * into previous from public.patient_safe_zone_state where elderly_id=new.elderly_id for update;
  -- A device clock in the future must not advance the ordering watermark.
  if new.measured_at>now()+interval '10 seconds' then return new; end if;
  if new.measured_at<=coalesce(previous.last_point_at,'-infinity') then return new; end if;
  update public.patient_safe_zone_state set last_point_at=new.measured_at,checked_at=now() where elderly_id=new.elderly_id;
  if new.location_source<>'watch_gps' or new.accuracy_m is null or new.accuracy_m>least(100,zone.radius_m/2) or new.measured_at<now()-interval '90 seconds'
    or not exists(select 1 from public.wearable_live_state s where s.device_id=new.device_id and s.elderly_id=new.elderly_id and s.monitoring and s.status_at>now()-interval '2 minutes') then
    update public.patient_safe_zone_state set candidate=null,candidate_count=0,candidate_since=null,last_check='Waiting for fresh, accurate watch satellite GPS' where elderly_id=new.elderly_id;
    return new;
  end if;
  h:=sin(radians(new.latitude-zone.latitude)/2)^2+cos(radians(zone.latitude))*cos(radians(new.latitude))*sin(radians(new.longitude-zone.longitude)/2)^2;
  distance:=6371000*2*atan2(sqrt(greatest(0,least(1,h))),sqrt(greatest(0,1-h)));
  if distance-new.accuracy_m>zone.radius_m+25 then target:='outside';
  elsif distance+new.accuracy_m<zone.radius_m-25 then target:='inside'; end if;
  if previous.device_id is distinct from new.device_id then
    previous.status:='unknown';previous.candidate:=null;previous.candidate_count:=0;previous.candidate_since:=null;
    update public.patient_safe_zone_state set status='unknown',confirmed_at=null where elderly_id=new.elderly_id;
  end if;
  gap:=new.measured_at-coalesce(previous.last_fix_at,new.measured_at)>interval '2 minutes';
  v_count:=case when target is not null and target=previous.candidate and not gap then previous.candidate_count+1 else 1 end;
  v_since:=case when target is not null and target=previous.candidate and not gap then previous.candidate_since else new.measured_at end;
  update public.patient_safe_zone_state set device_id=new.device_id,last_fix_at=new.measured_at,distance_m=distance,candidate=target,
    candidate_count=case when target is null then 0 else v_count end,candidate_since=case when target is null then null else v_since end,
    last_check=case when target is null then 'Near the boundary; waiting for a clearer position' else 'Confirming '||target||' position' end where elderly_id=new.elderly_id;
  if target is null or target=previous.status or v_count<3 or new.measured_at-v_since<interval '20 seconds' then return new; end if;
  update public.patient_safe_zone_state set status=target,confirmed_at=new.measured_at,last_check='Confirmed '||target||' safe zone' where elderly_id=new.elderly_id;
  -- Establishing an initial inside position is not a return event.
  if target='inside' and previous.status<>'outside' then return new; end if;
  select full_name into patient from public.elderly_profiles where elderly_id=new.elderly_id;
  headline:=case when target='outside' then 'Outside safe zone: ' else 'Returned to safe zone: ' end||zone.name;
  copy:=patient||case when target='outside' then ' was recorded outside ' else ' was recorded back inside ' end||zone.name||'. Distance from center: '||round(distance)::text||' m. Confirmed from multiple watch GPS fixes; check the recorded time and location.';
  if target='outside' then
    insert into public.health_alerts(elderly_id,alert_type,severity,title,message,ai_generated)
      values(new.elderly_id,'safe_zone_exit','warning',headline,copy,false) returning id into alert_id;
    update public.patient_safe_zone_state set last_alert_id=alert_id where elderly_id=new.elderly_id;
  end if;
  insert into public.safe_zone_events(elderly_id,zone_revision,zone_name,direction,distance_m,accuracy_m,measured_at,alert_id)
    values(new.elderly_id,zone.revision,zone.name,target,distance,new.accuracy_m,new.measured_at,alert_id) returning id into event_id;
  insert into public.caregiver_notifications(caregiver_id,elderly_id,alert_id,notification_type,title,body,data,channel,delivery_status,event_key)
    values(zone.caregiver_id,new.elderly_id,alert_id,case when target='outside' then 'health_alert' else 'system' end,headline,copy,
      jsonb_build_object('care_kind',case when target='outside' then 'vital' else 'system' end,'url','/location','zone_revision',zone.revision,'zone_direction',target,'safe_zone_event_id',event_id,'measured_at',new.measured_at),
      'in_app','sent','safe-zone:'||event_id) on conflict(caregiver_id,event_key) where event_key is not null do nothing;
  return new;
end $$;
revoke all on function public.evaluate_watch_safe_zone() from public,anon,authenticated;
create trigger evaluate_watch_safe_zone after insert on public.watch_location_points for each row execute function public.evaluate_watch_safe_zone();

-- Preserve reminder-version, token-ownership and expiry checks while stopping
-- queued alerts that have already been handled or have an obsolete boundary.
alter function public.care_push_is_current(uuid) rename to care_push_is_current_before_workflow;
create function public.care_push_is_current(p_notification uuid) returns boolean language plpgsql stable security definer set search_path=public,pg_temp as $$
declare n public.caregiver_notifications;
begin
  if not public.care_push_is_current_before_workflow(p_notification) then return false; end if;
  select * into n from public.caregiver_notifications where id=p_notification;
  if n.alert_id is not null and exists(select 1 from public.health_alerts where id=n.alert_id and (is_resolved or acknowledged_at is not null)) then return false; end if;
  if n.data->>'zone_revision' is not null then
    return exists(select 1 from public.patient_safe_zones z join public.patient_safe_zone_state s using(elderly_id)
      where z.elderly_id=n.elderly_id and z.caregiver_id=n.caregiver_id and z.enabled and z.revision::text=n.data->>'zone_revision'
        and s.status=n.data->>'zone_direction' and s.last_fix_at>now()-interval '2 minutes');
  end if;
  return true;
end $$;
revoke all on function public.care_push_is_current(uuid),public.care_push_is_current_before_workflow(uuid) from public,anon,authenticated;
grant execute on function public.care_push_is_current(uuid) to service_role;

-- The model never supplies record IDs. Evidence is retrieved with the same
-- authorized history bounds, then the Edge Function validates its citations.
alter table public.ai_chatbot_messages add column evidence jsonb not null default '[]'::jsonb check(jsonb_typeof(evidence)='array'),
  add column evidence_summary jsonb;
create function public.watch_vital_evidence(p_caregiver uuid,p_elderly uuid,p_metric text,p_threshold float8,p_comparison text,p_from timestamptz,p_until timestamptz)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare compare text; result jsonb;
begin
  if not exists(select 1 from public.elderly_profiles e join public.user_access u on u.user_id=e.caregiver_id and u.role='caregiver' and u.status='active'
    where e.elderly_id=p_elderly and e.caregiver_id=p_caregiver) then raise exception 'Patient access denied'; end if;
  if p_metric is null or p_metric not in ('heart_rate_bpm','spo2_percent','sleep_hours','steps_count','skin_temp_celsius','hrv_rmssd_ms','stress_score') then raise exception 'Invalid metric'; end if;
  compare:=case p_comparison when 'gte' then '>=' when 'gt' then '>' when 'lte' then '<=' when 'lt' then '<' when 'eq' then '=' end;
  if compare is null or p_threshold is null or p_threshold in ('Infinity'::float8,'-Infinity'::float8,'NaN'::float8) then raise exception 'Invalid comparison'; end if;
  execute format('select coalesce(jsonb_agg(row_data),''[]''::jsonb) from (select to_jsonb(v) as row_data from public.vital_sign_logs v
    where v.elderly_id=$1 and v.source=''galaxy_watch'' and not v.is_superseded and v.%1$I %2$s $4
      and ($2 is null or v.recorded_at>=$2) and ($3 is null or v.recorded_at<$3) order by v.recorded_at,v.id limit 8) q',p_metric,compare)
    into result using p_elderly,p_from,p_until,p_threshold;
  return result;
end $$;
revoke all on function public.watch_vital_evidence(uuid,uuid,text,float8,text,timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.watch_vital_evidence(uuid,uuid,text,float8,text,timestamptz,timestamptz) to service_role;

do $$ declare tab text; begin
  foreach tab in array array['alert_response_events','patient_safe_zones','patient_safe_zone_state','safe_zone_events'] loop
    if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=tab) then
      execute format('alter publication supabase_realtime add table public.%I',tab);
    end if;
  end loop;
end $$;
