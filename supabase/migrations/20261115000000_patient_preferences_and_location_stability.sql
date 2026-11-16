-- Caregiver-owned patient preferences; existing elderly_profiles RLS protects both fields.
alter table public.elderly_profiles
  add column primary_emergency_role text not null default 'caregiver' check(primary_emergency_role in ('caregiver','family','doctor')),
  add column vital_thresholds jsonb not null default '{}'::jsonb;

create function public.validate_patient_thresholds() returns trigger language plpgsql set search_path=public,pg_temp as $$
declare k text; v jsonb; n numeric; lower_limit numeric; upper_limit numeric;
begin
  if jsonb_typeof(new.vital_thresholds) is distinct from 'object' then raise exception 'Threshold settings must be an object';end if;
  for k,v in select * from jsonb_each(new.vital_thresholds) loop
    if k not in ('heartRateLow','heartRateHigh','oxygenLow','oxygenCritical','sleepHoursLow','skinTemperatureChangeC','hrvLow','stressHigh','stepsHigh') then raise exception 'Unsupported threshold: %',k;end if;
    if v='null'::jsonb and k in ('hrvLow','stressHigh','stepsHigh') then continue;end if;
    if jsonb_typeof(v)<>'number' then raise exception 'Threshold % must be numeric',k;end if;
    n:=v::text::numeric;
    lower_limit:=case k when 'heartRateHigh' then 2 when 'oxygenLow' then 2 when 'skinTemperatureChangeC' then 0.1 when 'sleepHoursLow' then 0 when 'stressHigh' then 0 else 1 end;
    upper_limit:=case k when 'heartRateLow' then 349 when 'heartRateHigh' then 350 when 'oxygenLow' then 100 when 'oxygenCritical' then 99 when 'sleepHoursLow' then 24 when 'skinTemperatureChangeC' then 10 when 'hrvLow' then 500 when 'stressHigh' then 100 when 'stepsHigh' then 200000 end;
    if n<lower_limit or n>upper_limit or (k='stepsHigh' and n<>trunc(n)) then raise exception 'Threshold % out of range',k;end if;
  end loop;
  if coalesce((new.vital_thresholds->>'heartRateLow')::numeric,50)>=coalesce((new.vital_thresholds->>'heartRateHigh')::numeric,110) then raise exception 'Invalid heart rate range';end if;
  if coalesce((new.vital_thresholds->>'oxygenCritical')::numeric,92)>=coalesce((new.vital_thresholds->>'oxygenLow')::numeric,95) then raise exception 'Critical oxygen threshold must be below warning threshold';end if;
  return new;
end $$;
create trigger validate_patient_thresholds before insert or update of vital_thresholds on public.elderly_profiles for each row execute function public.validate_patient_thresholds();

create or replace function public.persist_vital_review() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare owner_id uuid; patient text; rule_name text; rules text[]; unsafe boolean; value float8; threshold float8;
  headline text; description text; severity text; prior public.care_vital_rule_state;
  alert_id uuid; v_event_key text; baseline float8; deviation float8; reference_count integer; historical boolean; settings jsonb;
begin
  if new.source is distinct from 'galaxy_watch' or new.is_superseded then return new; end if;
  select e.caregiver_id,e.full_name,e.vital_thresholds into owner_id,patient,settings from public.elderly_profiles e join public.user_access a on a.user_id=e.caregiver_id
    where e.elderly_id=new.elderly_id and a.role='caregiver' and a.status='active';
  if owner_id is null then return new; end if;
  historical:=new.measurement_origin='samsung_health' and new.watch_metric='spo2_percent' and new.recorded_at<now()-interval '2 minutes';
  if new.recorded_at>now()+interval '5 minutes' then return new; end if;
  if (new.watch_metric='sleep_hours' or historical) and new.recorded_at<now()-interval '24 hours' then return new; end if;
  if new.watch_metric<>'sleep_hours' and not coalesce(historical,false) and new.recorded_at<now()-interval '2 minutes' then return new; end if;
  rules:=case new.watch_metric when 'heart_rate_bpm' then array['heart_low','heart_high'] when 'spo2_percent' then array['oxygen_low']
    when 'sleep_hours' then array['sleep_short'] when 'skin_temp_celsius' then array['skin_change'] when 'hrv_rmssd_ms' then array['hrv_low','stress_high'] when 'steps_count' then array['steps_high'] else array[]::text[] end;
  foreach rule_name in array rules loop
    baseline:=null; deviation:=null; reference_count:=0; severity:='warning';
    case rule_name
      when 'heart_low' then value:=new.heart_rate_bpm;threshold:=coalesce((settings->>'heartRateLow')::float8,50);unsafe:=value>=1 and value<threshold;headline:='Heart rate below review threshold';
      when 'heart_high' then value:=new.heart_rate_bpm;threshold:=coalesce((settings->>'heartRateHigh')::float8,110);unsafe:=value>threshold and value<=350;headline:='Heart rate above review threshold';
      when 'oxygen_low' then value:=new.spo2_percent;threshold:=coalesce((settings->>'oxygenLow')::float8,95);unsafe:=value>=1 and value<threshold;headline:=case when historical then 'Recorded oxygen below review threshold' else 'Blood oxygen below review threshold' end;
      when 'sleep_short' then value:=new.sleep_hours;threshold:=coalesce((settings->>'sleepHoursLow')::float8,5);unsafe:=value>0 and value<threshold;headline:='Short recorded sleep session';
      when 'skin_change' then
        value:=new.skin_temp_celsius;threshold:=coalesce((settings->>'skinTemperatureChangeC')::float8,0.8);headline:='Wrist temperature differs from recent baseline';
        select avg(v),stddev_pop(v),count(*) into baseline,deviation,reference_count from (
          select skin_temp_celsius v from public.vital_sign_logs where elderly_id=new.elderly_id and watch_device_id=new.watch_device_id and not is_superseded
            and skin_temp_celsius is not null and recorded_at<new.recorded_at and recorded_at>=new.recorded_at-interval '24 hours'
          order by recorded_at desc limit 7
        ) b;
        unsafe:=reference_count>=5 and deviation>0 and abs(value-baseline)>=threshold and abs(value-baseline)>=2*deviation;
      when 'hrv_low' then value:=new.hrv_rmssd_ms;threshold:=(settings->>'hrvLow')::float8;unsafe:=threshold is not null and value>0 and value<threshold;headline:='HRV below patient review threshold';
      when 'stress_high' then value:=new.stress_score;threshold:=(settings->>'stressHigh')::float8;unsafe:=threshold is not null and value>threshold;headline:='Experimental stress estimate above patient threshold';
      when 'steps_high' then value:=new.steps_count;threshold:=(settings->>'stepsHigh')::float8;unsafe:=threshold is not null and value>threshold;headline:='Monitored daily steps above patient activity limit';
    end case;
    if value is null then continue; end if;
    if rule_name='oxygen_low' and value<=coalesce((settings->>'oxygenCritical')::float8,92) then severity:='critical';headline:='Blood oxygen needs prompt confirmation';end if;
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
    description:=case rule_name when 'heart_low' then patient||': recorded heart rate '||value||' BPM, below '||threshold||' BPM.'
      when 'heart_high' then patient||': recorded heart rate '||value||' BPM, above '||threshold||' BPM.'
      when 'oxygen_low' then patient||': recorded SpO₂ '||round(value::numeric,1)||'%, below '||threshold||'%.'
      when 'sleep_short' then patient||': recorded sleep session '||round(value::numeric,2)||' hours, below the '||threshold||'-hour patient review threshold.'
      when 'hrv_low' then patient||': recorded HRV '||value||' ms, below '||threshold||' ms. Compare during similar quiet periods.'
      when 'stress_high' then patient||': experimental stress estimate '||value||', above '||threshold||'. Not a diagnosis.'
      when 'steps_high' then patient||': recorded monitored daily steps '||value||', above the configured activity limit of '||threshold||'. Follow the agreed mobility plan.'
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
revoke all on function public.persist_vital_review() from public,anon,authenticated;

create function public.reset_changed_patient_rules() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if old.vital_thresholds is distinct from new.vital_thresholds then
    update public.care_vital_rule_state set active=false,notified_at=null where elderly_id=new.elderly_id;
  end if;
  return new;
end $$;
create trigger reset_changed_patient_rules after update of vital_thresholds on public.elderly_profiles for each row execute function public.reset_changed_patient_rules();
revoke all on function public.reset_changed_patient_rules() from public,anon,authenticated;

-- Save receipt state across logins and devices without marking an alert resolved/read.
alter table public.caregiver_notifications add column foreground_presented_at timestamptz;
create function public.claim_foreground_notice(p_notice uuid) returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if not public.is_active_caregiver() then return false;end if;
  update public.caregiver_notifications set foreground_presented_at=now()
    where id=p_notice and caregiver_id=auth.uid() and not is_read and foreground_presented_at is null;
  return found;
end $$;
revoke all on function public.claim_foreground_notice(uuid) from public,anon;
grant execute on function public.claim_foreground_notice(uuid) to authenticated;

create or replace function public.register_care_push(p_token text,p_timezone text) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare old_owner uuid; registered_owner uuid:=auth.uid();
begin
  if not public.is_active_caregiver() then raise exception 'Active caregiver required'; end if;
  if p_token is null or length(p_token)>256 or p_token !~ '^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$' then raise exception 'Invalid notification token'; end if;
  if not exists(select 1 from pg_timezone_names where name=p_timezone) then raise exception 'Invalid timezone'; end if;
  select caregiver_id into old_owner from public.caregiver_push_tokens where token=p_token;
  insert into public.caregiver_push_tokens(token,caregiver_id,updated_at) values(p_token,registered_owner,now())
    on conflict(token) do update set caregiver_id=excluded.caregiver_id,updated_at=now();
  if old_owner is distinct from registered_owner then
    insert into public.caregiver_notifications(caregiver_id,elderly_id,notification_type,title,body,data,channel,delivery_status,event_key)
      select registered_owner,e.elderly_id,'system','Background notifications enabled','This phone is registered for care reminders and health alerts.',
        jsonb_build_object('care_kind','system','url','/alerts?tab=Notifications'),'in_app','sent','registration:'||md5(p_token)
      from public.elderly_profiles e where e.caregiver_id=registered_owner order by e.created_at limit 1
      on conflict(caregiver_id,event_key) where event_key is not null do nothing;
  end if;
  return jsonb_build_object('registered',true);
end $$;

-- Uncertainty-aware confirmation uses raw fixes independently of map smoothing.
alter table public.patient_safe_zone_state add column last_latitude float8,add column last_longitude float8,
  add column last_accuracy_m float8,add column last_source text;
create or replace function public.evaluate_watch_safe_zone() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare zone public.patient_safe_zones; previous public.patient_safe_zone_state; target text; gap boolean; distance float8; boundary_margin float8;
  v_count integer; v_since timestamptz; event_id uuid; alert_id uuid; patient text; headline text; copy text; h float8; displacement float8; elapsed_seconds float8;
begin
  select z.* into zone from public.patient_safe_zones z join public.elderly_profiles e on e.elderly_id=z.elderly_id and e.caregiver_id=z.caregiver_id
    join public.user_access u on u.user_id=z.caregiver_id and u.role='caregiver' and u.status='active'
    where z.elderly_id=new.elderly_id and z.enabled for update of z;
  if not found then return new; end if;
  insert into public.patient_safe_zone_state(elderly_id) values(new.elderly_id) on conflict do nothing;
  select * into previous from public.patient_safe_zone_state where elderly_id=new.elderly_id for update;
  -- A device clock in the future must not advance the ordering watermark.
  if new.measured_at>now()+interval '10 seconds' then return new; end if;
  -- Evaluate the same stream displayed on the map, including phone-assisted estimates.
  if new.location_source not in ('watch_gps','fused','network') then return new; end if;
  if new.measured_at<=coalesce(previous.last_point_at,'-infinity') then return new; end if;
  update public.patient_safe_zone_state set last_point_at=new.measured_at,checked_at=now() where elderly_id=new.elderly_id;
  if new.accuracy_m is null or new.accuracy_m<0 or new.accuracy_m>least(50,greatest(5,zone.radius_m/2)) or new.location_source='network' or new.measured_at<now()-interval '90 seconds'
    or not exists(select 1 from public.wearable_live_state s where s.device_id=new.device_id and s.elderly_id=new.elderly_id and s.monitoring and s.status_at>now()-interval '2 minutes') then
    update public.patient_safe_zone_state set candidate=null,candidate_count=0,candidate_since=null,last_check='Waiting for fresh location with usable accuracy' where elderly_id=new.elderly_id;
    return new;
  end if;
  h:=sin(radians(new.latitude-zone.latitude)/2)^2+cos(radians(zone.latitude))*cos(radians(new.latitude))*sin(radians(new.longitude-zone.longitude)/2)^2;
  distance:=6371000*2*atan2(sqrt(greatest(0,least(1,h))),sqrt(greatest(0,1-h)));
  -- Require the full uncertainty radius and a margin beyond the boundary.
  -- A near-boundary estimate cannot prove that a stationary wearer has left.
  boundary_margin:=greatest(10.0,2.0*new.accuracy_m);
  if distance>zone.radius_m+boundary_margin then target:='outside';
  elsif distance+greatest(3.0,new.accuracy_m)<zone.radius_m then target:='inside'; end if;
  if previous.last_latitude is not null and previous.device_id=new.device_id then
    h:=sin(radians(new.latitude-previous.last_latitude)/2)^2+cos(radians(previous.last_latitude))*cos(radians(new.latitude))*sin(radians(new.longitude-previous.last_longitude)/2)^2;
    displacement:=6371000*2*atan2(sqrt(greatest(0,least(1,h))),sqrt(greatest(0,1-h)));
    elapsed_seconds:=greatest(1,extract(epoch from new.measured_at-previous.last_fix_at));
    if displacement>greatest(30,elapsed_seconds*7+new.accuracy_m+coalesce(previous.last_accuracy_m,0)) then target:=null;end if;
  end if;
  if previous.device_id is distinct from new.device_id then
    previous.status:='unknown';previous.candidate:=null;previous.candidate_count:=0;previous.candidate_since:=null;
    update public.patient_safe_zone_state set status='unknown',confirmed_at=null where elderly_id=new.elderly_id;
  end if;
  gap:=new.measured_at-coalesce(previous.last_fix_at,new.measured_at)>interval '2 minutes' or previous.last_source is distinct from new.location_source;
  v_count:=case when target is not null and target=previous.candidate and not gap then previous.candidate_count+1 else 1 end;
  v_since:=case when target is not null and target=previous.candidate and not gap then previous.candidate_since else new.measured_at end;
  update public.patient_safe_zone_state set device_id=new.device_id,last_fix_at=new.measured_at,distance_m=distance,last_latitude=new.latitude,last_longitude=new.longitude,last_accuracy_m=new.accuracy_m,last_source=new.location_source,candidate=target,
    candidate_count=case when target is null then 0 else v_count end,candidate_since=case when target is null then null else v_since end,
    last_check=case when target is null then 'Near the boundary; waiting for a clearer position' else 'Confirming '||target||' position ('||least(v_count,4)::text||'/4 fixes; '||least(30,greatest(0,floor(extract(epoch from new.measured_at-v_since))))::text||'/30 seconds)' end where elderly_id=new.elderly_id;
  if target is null or target=previous.status or v_count<4 or new.measured_at-v_since<interval '30 seconds' then return new; end if;
  update public.patient_safe_zone_state set status=target,confirmed_at=new.measured_at,last_check='Confirmed '||target||' safe zone' where elderly_id=new.elderly_id;
  -- Establishing an initial inside position is not a return event.
  if target='inside' and previous.status<>'outside' then return new; end if;
  select full_name into patient from public.elderly_profiles where elderly_id=new.elderly_id;
  headline:=case when target='outside' then 'Location estimate outside safe zone: ' else 'Location estimate returned to safe zone: ' end||zone.name;
  copy:=patient||case when target='outside' then ' was recorded outside ' else ' was recorded back inside ' end||zone.name||'. Estimated distance from center: '||round(distance)::text||' m. Source: '||case new.location_source when 'watch_gps' then 'watch satellite GPS' when 'fused' then 'fused location (may use paired phone)' else 'network location' end||'; reported accuracy +/-'||round(new.accuracy_m)::text||' m. Repeated estimates over at least 30 seconds beyond the accuracy margin. Check the person and location; this is not proof of their position.';
  if target='outside' then
    insert into public.health_alerts(elderly_id,alert_type,severity,title,message,ai_generated)
      values(new.elderly_id,'safe_zone_exit','warning',headline,copy,false) returning id into alert_id;
    update public.patient_safe_zone_state set last_alert_id=alert_id where elderly_id=new.elderly_id;
  end if;
  insert into public.safe_zone_events(elderly_id,zone_revision,zone_name,direction,distance_m,accuracy_m,measured_at,alert_id)
    values(new.elderly_id,zone.revision,zone.name,target,distance,new.accuracy_m,new.measured_at,alert_id) returning id into event_id;
  insert into public.caregiver_notifications(caregiver_id,elderly_id,alert_id,notification_type,title,body,data,channel,delivery_status,event_key)
    values(zone.caregiver_id,new.elderly_id,alert_id,case when target='outside' then 'health_alert' else 'system' end,headline,copy,
      jsonb_build_object('care_kind',case when target='outside' then 'vital' else 'system' end,'url','/location','zone_revision',zone.revision,'zone_direction',target,'safe_zone_event_id',event_id,'measured_at',new.measured_at,'location_source',new.location_source,'accuracy_m',new.accuracy_m,'estimated_crossing',true),
      'in_app','sent','safe-zone:'||event_id) on conflict(caregiver_id,event_key) where event_key is not null do nothing;
  return new;
end $$;
revoke all on function public.evaluate_watch_safe_zone() from public,anon,authenticated;
