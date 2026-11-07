-- Preserve v1 delivery for installed APKs while new APKs register audible v2 channels.
alter table public.caregiver_push_tokens add column notification_channel_version integer not null default 1
  check(notification_channel_version in (1,2));

create function public.register_care_push_v2(p_token text,p_timezone text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  perform public.register_care_push(p_token,p_timezone);
  update public.caregiver_push_tokens set notification_channel_version=2 where token=p_token and caregiver_id=auth.uid();
  return jsonb_build_object('registered',true,'channel_version',2);
end $$;
revoke all on function public.register_care_push_v2(text,text) from public,anon;
grant execute on function public.register_care_push_v2(text,text) to authenticated;

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
  select coalesce(jsonb_agg(to_jsonb(c)||jsonb_build_object('title',n.title,'body',n.body,'data',n.data,'channel_version',t.notification_channel_version,'kind',coalesce(n.data->>'care_kind',case when n.notification_type='emergency' then 'sos' else 'vital' end))),'[]'::jsonb)
    into result from claimed c join public.caregiver_notifications n on n.id=c.notification_id join public.caregiver_push_tokens t on t.token=c.token and t.caregiver_id=n.caregiver_id;
  return result;
end $$;
