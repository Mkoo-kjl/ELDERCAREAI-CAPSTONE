-- pg_net sends after commit. The regular cron worker remains the retry path.
create function public.request_care_push_dispatch() returns bigint language plpgsql security definer set search_path=public,pg_temp as $$
declare endpoint text; worker_key text; request_id bigint;
begin
  if current_setting('eldercare.push_dispatch_queued',true)='true' then return null; end if;
  select decrypted_secret into endpoint from vault.decrypted_secrets where name='eldercare_project_url';
  select decrypted_secret into worker_key from vault.decrypted_secrets where name='eldercare_care_worker_key';
  if endpoint is null or worker_key is null then return null; end if;
  perform set_config('eldercare.push_dispatch_queued','true',true);
  select net.http_post(url:=endpoint||'/functions/v1/care-notification-worker',
    headers:=jsonb_build_object('Content-Type','application/json','x-worker-key',worker_key),
    body:='{}'::jsonb,timeout_milliseconds:=15000) into request_id;
  return request_id;
exception when others then
  -- A push transport problem must not roll back measured vitals or saved care data.
  raise warning 'Care push dispatch deferred to cron (SQLSTATE %)',sqlstate;
  return null;
end $$;
revoke all on function public.request_care_push_dispatch() from public,anon,authenticated;
grant execute on function public.request_care_push_dispatch() to service_role;

create function public.wake_care_push_worker() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if exists(select 1 from new_push_jobs) then perform public.request_care_push_dispatch(); end if;
  return null;
end $$;
revoke all on function public.wake_care_push_worker() from public,anon,authenticated;
create trigger wake_care_push_worker after insert on public.care_push_jobs
  referencing new table as new_push_jobs for each statement execute function public.wake_care_push_worker();

do $$ declare table_name text; begin
  foreach table_name in array array['health_alerts','appointments','caregiver_notes'] loop
    if not exists(select 1 from pg_publication_tables p where p.pubname='supabase_realtime' and p.schemaname='public' and p.tablename=table_name) then
      execute format('alter publication supabase_realtime add table public.%I',table_name);
    end if;
  end loop;
end $$;
