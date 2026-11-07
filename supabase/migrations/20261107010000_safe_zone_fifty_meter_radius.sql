-- Support 50-meter zones without changing any saved centers or radii.
alter table public.patient_safe_zones drop constraint patient_safe_zones_radius_m_check;
alter table public.patient_safe_zones add constraint patient_safe_zones_radius_m_check
  check(radius_m between 50 and 5000);

create or replace function public.save_patient_safe_zone(p_elderly uuid,p_name text,p_latitude float8,p_longitude float8,p_radius integer,p_enabled boolean)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare saved public.patient_safe_zones;
begin
  if not public.is_active_caregiver() or not exists(select 1 from public.elderly_profiles where elderly_id=p_elderly and caregiver_id=auth.uid()) then raise exception 'Patient access denied'; end if;
  if p_name is null or length(btrim(p_name)) not between 1 and 80 or p_latitude is null or p_longitude is null or p_radius is null or p_enabled is null
    or not(p_latitude between -90 and 90 and p_longitude between -180 and 180 and p_radius between 50 and 5000) then raise exception 'Choose a valid name, center and radius (50–5000 meters)'; end if;
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

create or replace function public.evaluate_watch_safe_zone() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare zone public.patient_safe_zones; previous public.patient_safe_zone_state; target text; gap boolean; distance float8; boundary_margin float8;
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
  -- Keep existing margins for zones >=100 m; scale down for the new 50 m minimum.
  boundary_margin:=least(25.0,zone.radius_m/4.0);
  if distance-new.accuracy_m>zone.radius_m+boundary_margin then target:='outside';
  elsif distance+new.accuracy_m<zone.radius_m-boundary_margin then target:='inside'; end if;
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
