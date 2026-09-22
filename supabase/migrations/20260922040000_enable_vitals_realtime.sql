-- Let authenticated caregivers receive RLS-filtered changes when the server
-- writes a new synchronized vital row. The app still retains its one-minute
-- foreground poll as a fallback when realtime is unavailable.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'vital_sign_logs'
  ) then
    alter publication supabase_realtime add table public.vital_sign_logs;
  end if;
end $$;
