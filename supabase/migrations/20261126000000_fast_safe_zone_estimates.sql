-- Fast marker-based exit estimates; preserve ownership, freshness, jump filtering and event deduplication.
create or replace function public.evaluate_watch_safe_zone() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare zone public.patient_safe_zones; previous public.patient_safe_zone_state; target text; gap boolean; distance float8; required_count integer; required_seconds integer;
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
  if new.accuracy_m is null or new.accuracy_m<0 or new.accuracy_m>2000 or new.measured_at<now()-interval '90 seconds'
    or not exists(select 1 from public.wearable_live_state s where s.device_id=new.device_id and s.elderly_id=new.elderly_id and s.monitoring and s.status_at>now()-interval '2 minutes') then
    update public.patient_safe_zone_state set candidate=null,candidate_count=0,candidate_since=null,last_check='Waiting for fresh location with usable accuracy' where elderly_id=new.elderly_id;
    return new;
  end if;
  h:=sin(radians(new.latitude-zone.latitude)/2)^2+cos(radians(zone.latitude))*cos(radians(new.latitude))*sin(radians(new.longitude-zone.longitude)/2)^2;
  distance:=6371000*2*atan2(sqrt(greatest(0,least(1,h))),sqrt(greatest(0,1-h)));
  -- Alert on the displayed estimate, including fused/network uncertainty.
  -- A deeper, slower return prevents boundary jitter from repeatedly rearming exits.
  if distance>zone.radius_m then target:='outside';
  elsif distance<zone.radius_m-least(10.0,zone.radius_m*0.1) then target:='inside'; end if;
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
  gap:=new.measured_at-coalesce(previous.last_fix_at,new.measured_at)>interval '2 minutes';
  required_count:=case when target='outside' then 2 else 3 end;
  required_seconds:=case when target='outside' then 2 else 10 end;
  v_count:=case when target is not null and target=previous.candidate and not gap then previous.candidate_count+1 else 1 end;
  v_since:=case when target is not null and target=previous.candidate and not gap then previous.candidate_since else new.measured_at end;
  update public.patient_safe_zone_state set device_id=new.device_id,last_fix_at=new.measured_at,distance_m=distance,last_latitude=new.latitude,last_longitude=new.longitude,last_accuracy_m=new.accuracy_m,last_source=new.location_source,candidate=target,
    candidate_count=case when target is null then 0 else v_count end,candidate_since=case when target is null then null else v_since end,
    last_check=case when target is null then 'Near the boundary; waiting for a clearer position' else 'Confirming '||target||' position ('||least(v_count,required_count)::text||'/'||required_count::text||' fixes; '||least(required_seconds,greatest(0,floor(extract(epoch from new.measured_at-v_since))))::text||'/'||required_seconds::text||' seconds)' end where elderly_id=new.elderly_id;
  if target is null or target=previous.status or v_count<required_count or extract(epoch from new.measured_at-v_since)<required_seconds then return new; end if;
  update public.patient_safe_zone_state set status=target,confirmed_at=new.measured_at,last_check='Confirmed '||target||' safe zone' where elderly_id=new.elderly_id;
  -- Establishing an initial inside position is not a return event.
  if target='inside' and previous.status<>'outside' then return new; end if;
  select full_name into patient from public.elderly_profiles where elderly_id=new.elderly_id;
  headline:=case when target='outside' then 'Location estimate outside safe zone: ' else 'Location estimate returned to safe zone: ' end||zone.name;
  copy:=patient||case when target='outside' then ' was recorded outside ' else ' was recorded back inside ' end||zone.name||'. Estimated distance from center: '||round(distance)::text||' m. Source: '||case new.location_source when 'watch_gps' then 'watch satellite GPS' when 'fused' then 'fused location (may use paired phone)' else 'network location' end||'; reported accuracy +/-'||round(new.accuracy_m)::text||' m. Repeated location estimates crossed the saved boundary. Location uncertainty may exceed the zone radius. Check the person and location; this is not proof of their position.';
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
