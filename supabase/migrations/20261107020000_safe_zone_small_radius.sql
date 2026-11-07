-- Add small zones on explicit request. Existing centers and radii are preserved.
-- The existing scaled GPS margin and half-radius accuracy limit also apply to 10/20 m zones.
alter table public.patient_safe_zones drop constraint patient_safe_zones_radius_m_check;
alter table public.patient_safe_zones add constraint patient_safe_zones_radius_m_check
  check(radius_m between 10 and 5000);

create or replace function public.save_patient_safe_zone(p_elderly uuid,p_name text,p_latitude float8,p_longitude float8,p_radius integer,p_enabled boolean)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare saved public.patient_safe_zones;
begin
  if not public.is_active_caregiver() or not exists(select 1 from public.elderly_profiles where elderly_id=p_elderly and caregiver_id=auth.uid()) then raise exception 'Patient access denied'; end if;
  if p_name is null or length(btrim(p_name)) not between 1 and 80 or p_latitude is null or p_longitude is null or p_radius is null or p_enabled is null
    or not(p_latitude between -90 and 90 and p_longitude between -180 and 180 and p_radius between 10 and 5000) then raise exception 'Choose a valid name, center and radius (10–5000 meters)'; end if;
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

