create table public.prescription_imports(
  id uuid primary key,caregiver_id uuid not null references auth.users(id) on delete cascade,
  elderly_id uuid not null references public.elderly_profiles(elderly_id) on delete cascade,
  image_path text not null,request_fingerprint text not null,reviewed_at timestamptz not null default now()
);
alter table public.prescription_imports enable row level security;
revoke all on public.prescription_imports from anon,authenticated;
grant select on public.prescription_imports to authenticated;
create policy prescription_import_owner on public.prescription_imports for select to authenticated
  using(caregiver_id=auth.uid() and public.is_active_caregiver());
alter table public.medication_schedules add column prescription_import_id uuid references public.prescription_imports(id),
  add column prescription_item_index integer,add column prescription_date date;
create unique index prescription_group_item on public.medication_schedules(prescription_import_id,prescription_item_index);

-- One transaction saves every reviewed drug. A lost response may be retried safely.
create function public.save_prescription_group(p_elderly uuid,p_path text,p_request uuid,p_timezone text,p_medications jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare owner_id uuid:=auth.uid(); item jsonb; ordinal bigint; times text[]; clock text; frequency text;
  prior public.prescription_imports; result jsonb;
begin
  if not public.is_active_caregiver() or not exists(select 1 from public.elderly_profiles where elderly_id=p_elderly and caregiver_id=owner_id) then raise exception 'Patient not available';end if;
  if p_request is null or p_path is null or p_path not like owner_id::text||'/'||p_elderly::text||'/prescription-%' or p_path like '%..%'
    or not exists(select 1 from storage.objects where bucket_id='care-files' and name=p_path) then raise exception 'Private prescription image required';end if;
  if not exists(select 1 from pg_timezone_names where name=p_timezone) then raise exception 'Invalid timezone';end if;
  if jsonb_typeof(p_medications) is distinct from 'array' or jsonb_array_length(p_medications) not between 1 and 20 then raise exception 'Review 1 to 20 medications';end if;
  perform pg_advisory_xact_lock(hashtextextended(owner_id::text||p_request::text,0));
  select * into prior from public.prescription_imports where id=p_request;
  if found then
    if prior.caregiver_id<>owner_id or prior.elderly_id<>p_elderly or prior.image_path<>p_path or prior.request_fingerprint<>md5(p_medications::text||p_timezone) then raise exception 'This import has already been saved. Open Care to review it.';end if;
  else
    insert into public.prescription_imports(id,caregiver_id,elderly_id,image_path,request_fingerprint) values(p_request,owner_id,p_elderly,p_path,md5(p_medications::text||p_timezone));
    for item,ordinal in select value,ordinality from jsonb_array_elements(p_medications) with ordinality loop
      if jsonb_typeof(item) is distinct from 'object' or length(trim(coalesce(item->>'medication_name',''))) not between 1 and 200
        or length(coalesce(item->>'dosage',''))>500 or length(coalesce(item->>'instructions',''))>4000 or length(coalesce(item->>'prescribed_by',''))>200
        then raise exception 'Invalid medication fields';end if;
      frequency:=item->>'frequency';
      if frequency is null or frequency not in ('Daily','Twice daily','Weekly','Custom','As needed') then raise exception 'Unsupported schedule frequency';end if;
      if jsonb_typeof(item->'times_of_day') is distinct from 'array' then raise exception 'Review reminder times';end if;
      select coalesce(array_agg(t order by t),array[]::text[]) into times from jsonb_array_elements_text(item->'times_of_day') t;
      if cardinality(times)>12 or (frequency<>'As needed' and cardinality(times)=0) or (frequency='Twice daily' and cardinality(times)<>2)
        or (frequency='As needed' and cardinality(times)<>0) or cardinality(times)<>(select count(distinct t) from unnest(times) t) then raise exception 'Review distinct schedule times';end if;
      foreach clock in array times loop if clock is null or clock!~'^([01][0-9]|2[0-3]):[0-5][0-9]$' then raise exception 'Invalid clock time';end if;end loop;
      if coalesce(item->>'start_date','')!~'^\d{4}-\d{2}-\d{2}$' or (item->>'end_date')::date<(item->>'start_date')::date then raise exception 'Invalid treatment dates';end if;
      insert into public.medication_schedules(caregiver_id,elderly_id,medication_name,dosage,frequency,times_of_day,start_date,end_date,prescribed_by,instructions,
        timezone,reminder_enabled,is_active,prescription_path,prescription_reviewed_at,prescription_import_id,prescription_item_index,prescription_date,color_tag)
      values(owner_id,p_elderly,trim(item->>'medication_name'),nullif(item->>'dosage',''),frequency,times,(item->>'start_date')::date,(item->>'end_date')::date,
        nullif(item->>'prescribed_by',''),nullif(item->>'instructions',''),p_timezone,frequency<>'As needed',true,p_path,now(),p_request,ordinal-1,(item->>'prescription_date')::date,'#397F88');
    end loop;
  end if;
  select jsonb_agg(jsonb_build_object('id',id,'item_index',prescription_item_index) order by prescription_item_index) into result
    from public.medication_schedules where prescription_import_id=p_request and caregiver_id=owner_id;
  return result;
end $$;
revoke all on function public.save_prescription_group(uuid,text,uuid,text,jsonb) from public,anon;
grant execute on function public.save_prescription_group(uuid,text,uuid,text,jsonb) to authenticated;

-- HRV-derived stress is populated by an update after its original sensor insert.
create trigger persist_stress_patient_review after update of stress_score on public.vital_sign_logs
  for each row when(old.stress_score is distinct from new.stress_score) execute function public.persist_vital_review();
