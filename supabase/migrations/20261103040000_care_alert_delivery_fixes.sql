-- Avoid a PL/pgSQL variable/column collision when persisting a threshold alert.
-- Revalidate token ownership before claiming queued pushes after sign-out/account changes.
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
    if rule_name in ('sleep_short','oxygen_low') and (rule_name='sleep_short' or historical) then
      if not coalesce(unsafe,false) then continue; end if;
      v_event_key:='recorded:'||rule_name||':'||coalesce(new.source_device_id,new.watch_device_id::text)||':'||coalesce(new.source_group_key,new.id::text);
      if exists(select 1 from public.caregiver_notifications n where n.caregiver_id=owner_id and n.event_key=v_event_key) then continue; end if;
    else
      insert into public.care_vital_rule_state(elderly_id,rule) values(new.elderly_id,rule_name) on conflict do nothing;
      select * into prior from public.care_vital_rule_state where elderly_id=new.elderly_id and care_vital_rule_state.rule=rule_name for update;
      if new.recorded_at<=coalesce(prior.measured_at,'-infinity') then continue; end if;
      update public.care_vital_rule_state set active=coalesce(unsafe,false),measured_at=new.recorded_at where elderly_id=new.elderly_id and care_vital_rule_state.rule=rule_name;
      if not coalesce(unsafe,false) or (prior.active and prior.notified_at>now()-interval '1 hour') then continue; end if;
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
create or replace function public.claim_care_push(p_limit integer default 50) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
  update public.care_push_jobs j set status='expired',error='Reminder no longer current'
    where j.status in ('pending','processing') and (not public.care_push_is_current(j.notification_id) or not exists (
      select 1 from public.caregiver_push_tokens t join public.caregiver_notifications n on n.id=j.notification_id
        where t.token=j.token and t.caregiver_id=n.caregiver_id and t.updated_at>now()-interval '90 days'));
  with picked as (select id from public.care_push_jobs j where ((status='pending' and next_attempt_at<=now()) or (status='processing' and leased_until<now()))
      and attempts<12 order by created_at for update skip locked limit greatest(1,least(p_limit,100))),
    claimed as (update public.care_push_jobs j set status='processing',lease_id=gen_random_uuid(),leased_until=now()+interval '90 seconds',attempts=attempts+1
      from picked p where j.id=p.id returning j.*)
  select coalesce(jsonb_agg(to_jsonb(c)||jsonb_build_object('title',n.title,'body',n.body,'data',n.data,'kind',coalesce(n.data->>'care_kind',case when n.notification_type='emergency' then 'sos' else 'vital' end))),'[]'::jsonb)
    into result from claimed c join public.caregiver_notifications n on n.id=c.notification_id;
  return result;
end $$;
