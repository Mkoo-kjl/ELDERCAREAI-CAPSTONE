-- Preserve the experimental score WITH the HRV event that produced it.
alter table public.vital_sign_logs add column if not exists stress_score integer check(stress_score between 0 and 100);
alter table public.vital_sign_logs add column if not exists stress_baseline_rmssd double precision;
alter table public.vital_sign_logs add column if not exists stress_reference_count integer;
alter table public.vital_sign_logs add column if not exists stress_model_version text;
alter table public.vital_sign_logs add column if not exists is_superseded boolean not null default false;
create or replace function public.update_watch_stress_index() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare bucket timestamptz; baseline double precision; reference_count integer; score integer;
begin
  if new.watch_metric is distinct from 'hrv_rmssd_ms' or new.watch_device_id is null or new.hrv_rmssd_ms is null then return new; end if;
  bucket:=to_timestamp(floor(extract(epoch from new.watch_measured_at)/300)*300);
  if new.hrv_rmssd_ms>0 then
    insert into public.watch_hrv_reference_buckets values(new.watch_device_id,bucket,new.hrv_rmssd_ms,1)
      on conflict(device_id,bucket_at) do update set total=watch_hrv_reference_buckets.total+excluded.total,samples=watch_hrv_reference_buckets.samples+1;
  end if;
  select percentile_cont(0.5) within group(order by total/samples),count(*) into baseline,reference_count
    from public.watch_hrv_reference_buckets where device_id=new.watch_device_id and bucket_at<bucket
      and bucket_at>=new.watch_measured_at-interval '7 days';
  if reference_count>=12 and baseline>0 and new.hrv_rmssd_ms>0 then
    score:=greatest(0,least(100,round(50+50*ln(baseline/new.hrv_rmssd_ms)/ln(2.0))::integer));
  end if;
  update public.vital_sign_logs set stress_score=score,stress_baseline_rmssd=baseline,
    stress_reference_count=reference_count,stress_model_version='hrv-relative-v1' where id=new.id;
  update public.wearable_live_state set stress_score=score,stress_baseline_rmssd=baseline,stress_reference_count=reference_count
    where device_id=new.watch_device_id and new.watch_measured_at>=coalesce(hrv_measured_at,'-infinity');
  return new;
end $$;

-- Index each metric independently. Sparse rows contain only the metric actually measured.
do $$ declare metric text; begin
  foreach metric in array array['heart_rate_bpm','spo2_percent','hrv_rmssd_ms','skin_temp_celsius','steps_count','sleep_hours','stress_score'] loop
    execute format('create index vital_history_%1$s on public.vital_sign_logs(elderly_id,%1$I,recorded_at) where source=''galaxy_watch'' and %1$I is not null',metric);
  end loop;
end $$;

-- Elle calls this with the authenticated caregiver ID derived by its Edge Function.
-- Aggregation covers ALL matching rows, not a small prompt sample or a REST page limit.
create or replace function public.watch_vital_history(
  p_caregiver uuid,p_elderly uuid,p_zone text,p_range text,p_start date,p_end date,
  p_metric text,p_threshold double precision,p_comparison text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare first_at timestamptz; until_at timestamptz; local_today date; metric text; amount bigint;
  lowest double precision; highest double precision; average double precision; latest jsonb; peak jsonb;
  metrics jsonb:='{}'; threshold_result jsonb; matched bigint; match_first timestamptz; match_last timestamptz; comparison text;
begin
  if not exists(select 1 from public.elderly_profiles e join public.user_access a on a.user_id=e.caregiver_id and a.role='caregiver' and a.status='active'
    where e.elderly_id=p_elderly and e.caregiver_id=p_caregiver) then raise exception 'Patient access denied'; end if;
  if not exists(select 1 from pg_timezone_names where name=p_zone) then raise exception 'Invalid timezone'; end if;
  local_today:=(now() at time zone p_zone)::date;
  if p_range='today' then first_at:=local_today::timestamp at time zone p_zone; until_at:=(local_today+1)::timestamp at time zone p_zone;
  elsif p_range='yesterday' then first_at:=(local_today-1)::timestamp at time zone p_zone; until_at:=local_today::timestamp at time zone p_zone;
  elsif p_range='last_7_days' then first_at:=(local_today-6)::timestamp at time zone p_zone; until_at:=(local_today+1)::timestamp at time zone p_zone;
  elsif p_range='last_30_days' then first_at:=(local_today-29)::timestamp at time zone p_zone; until_at:=(local_today+1)::timestamp at time zone p_zone;
  elsif p_range='this_week' then first_at:=(local_today-(extract(isodow from local_today)::integer-1))::timestamp at time zone p_zone; until_at:=(local_today+1)::timestamp at time zone p_zone;
  elsif p_range='last_week' then first_at:=(local_today-(extract(isodow from local_today)::integer-1)-7)::timestamp at time zone p_zone; until_at:=(local_today-(extract(isodow from local_today)::integer-1))::timestamp at time zone p_zone;
  elsif p_range='this_month' then first_at:=date_trunc('month',local_today::timestamp) at time zone p_zone; until_at:=(local_today+1)::timestamp at time zone p_zone;
  elsif p_range='last_month' then first_at:=(date_trunc('month',local_today::timestamp)-interval '1 month') at time zone p_zone; until_at:=date_trunc('month',local_today::timestamp) at time zone p_zone;
  elsif p_range='dates' then
    if p_start is null or p_end is null or p_end<p_start then raise exception 'Invalid date interval'; end if;
    first_at:=p_start::timestamp at time zone p_zone; until_at:=(p_end+1)::timestamp at time zone p_zone;
  elsif p_range<>'all' then raise exception 'Unsupported history interval'; end if;
  comparison:=case p_comparison when 'gte' then '>=' when 'gt' then '>' when 'lte' then '<=' when 'lt' then '<' when 'eq' then '=' end;
  if comparison is null then raise exception 'Invalid comparison'; end if;
  foreach metric in array array['heart_rate_bpm','spo2_percent','hrv_rmssd_ms','skin_temp_celsius','steps_count','sleep_hours','stress_score'] loop
    execute format('select count(*),min(%1$I),max(%1$I),avg(%1$I) from public.vital_sign_logs where elderly_id=$1 and source=''galaxy_watch'' and not is_superseded and %1$I is not null and ($2 is null or recorded_at>=$2) and ($3 is null or recorded_at<$3)',metric)
      into amount,lowest,highest,average using p_elderly,first_at,until_at;
    execute format('select jsonb_build_object(''value'',%1$I,''measured_at'',recorded_at) from public.vital_sign_logs where elderly_id=$1 and source=''galaxy_watch'' and not is_superseded and %1$I is not null and ($2 is null or recorded_at>=$2) and ($3 is null or recorded_at<$3) order by recorded_at desc,id desc limit 1',metric)
      into latest using p_elderly,first_at,until_at;
    execute format('select jsonb_build_object(''value'',%1$I,''measured_at'',recorded_at) from public.vital_sign_logs where elderly_id=$1 and source=''galaxy_watch'' and not is_superseded and %1$I is not null and ($2 is null or recorded_at>=$2) and ($3 is null or recorded_at<$3) order by %1$I desc,recorded_at,id limit 1',metric)
      into peak using p_elderly,first_at,until_at;
    metrics:=metrics||jsonb_build_object(metric,jsonb_build_object('count',amount,'min',lowest,'max',highest,'mean',average,'latest',latest,'peak',peak));
    if metric=p_metric and p_threshold is not null then
      if p_threshold in ('Infinity'::float8,'-Infinity'::float8,'NaN'::float8) then raise exception 'Invalid threshold'; end if;
      execute format('select count(*),min(recorded_at),max(recorded_at) from public.vital_sign_logs where elderly_id=$1 and source=''galaxy_watch'' and not is_superseded and %1$I %2$s $4 and ($2 is null or recorded_at>=$2) and ($3 is null or recorded_at<$3)',metric,comparison)
        into matched,match_first,match_last using p_elderly,first_at,until_at,p_threshold;
      threshold_result:=jsonb_build_object('metric',metric,'value',p_threshold,'comparison',p_comparison,'count',matched,'first_at',match_first,'last_at',match_last);
    end if;
  end loop;
  return jsonb_build_object('source','galaxy_watch','scope',p_range,'timezone',p_zone,'from',first_at,'until',until_at,'generated_at',now(),
    'metrics',metrics,'threshold',threshold_result,'coverage_notice','Saved valid measurements only. Missing readings and monitoring gaps do not establish that an event never occurred. Counts are samples, not separate episodes.',
    'current_collection',(select jsonb_build_object('monitoring',monitoring,'received_at',received_at,'sensor_status',sensor_status) from public.wearable_live_state where elderly_id=p_elderly));
end $$;
revoke all on function public.watch_vital_history(uuid,uuid,text,text,date,date,text,double precision,text) from public,anon,authenticated;
grant execute on function public.watch_vital_history(uuid,uuid,text,text,date,date,text,double precision,text) to service_role;
