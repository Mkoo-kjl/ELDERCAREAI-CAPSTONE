-- Schema metadata only. No patient records, tokens or credential values.
with relations as (
  select c.oid,c.relname,c.relkind,c.relrowsecurity,c.relforcerowsecurity,c.reloptions,
    obj_description(c.oid,'pg_class') as comment
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind in ('r','p','v','m')
)
select jsonb_build_object(
  'captured_at',now(),
  'latest_migration',(select max(version) from supabase_migrations.schema_migrations),
  'relations',coalesce((select jsonb_agg(jsonb_build_object(
    'name',r.relname,'kind',r.relkind,'rls',r.relrowsecurity,'force_rls',r.relforcerowsecurity,
    'options',r.reloptions,'comment',r.comment,
    'columns',(select jsonb_agg(jsonb_build_object(
      'name',a.attname,'ordinal',a.attnum,'type',format_type(a.atttypid,a.atttypmod),
      'nullable',not a.attnotnull,'default',pg_get_expr(d.adbin,d.adrelid),
      'identity',a.attidentity,'generated',a.attgenerated,'comment',col_description(a.attrelid,a.attnum)
    ) order by a.attnum) from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
      where a.attrelid=r.oid and a.attnum>0 and not a.attisdropped),
    'constraints',coalesce((select jsonb_agg(jsonb_build_object(
      'name',co.conname,'kind',co.contype,'definition',pg_get_constraintdef(co.oid,true),
      'columns',(select jsonb_agg(a.attname order by k.ordinality) from unnest(co.conkey) with ordinality k(num,ordinality) join pg_attribute a on a.attrelid=co.conrelid and a.attnum=k.num),
      'ref_schema',(select n.nspname from pg_class rc join pg_namespace n on n.oid=rc.relnamespace where rc.oid=co.confrelid),
      'ref_table',(select rc.relname from pg_class rc where rc.oid=co.confrelid),
      'ref_columns',(select jsonb_agg(a.attname order by k.ordinality) from unnest(co.confkey) with ordinality k(num,ordinality) join pg_attribute a on a.attrelid=co.confrelid and a.attnum=k.num)
    ) order by co.contype,co.conname) from pg_constraint co where co.conrelid=r.oid),'[]'::jsonb),
    'indexes',coalesce((select jsonb_agg(jsonb_build_object('name',indexname,'definition',indexdef) order by indexname) from pg_indexes ix where ix.schemaname='public' and ix.tablename=r.relname),'[]'::jsonb),
    'policies',coalesce((select jsonb_agg(jsonb_build_object('name',p.policyname,'command',p.cmd,'roles',p.roles,'using',p.qual,'check',p.with_check) order by p.policyname) from pg_policies p where p.schemaname='public' and p.tablename=r.relname),'[]'::jsonb),
    'triggers',coalesce((select jsonb_agg(jsonb_build_object('name',t.tgname,'definition',pg_get_triggerdef(t.oid,true)) order by t.tgname) from pg_trigger t where t.tgrelid=r.oid and not t.tgisinternal),'[]'::jsonb),
    'client_select',has_table_privilege('authenticated',r.oid,'select'),
    'client_insert',has_table_privilege('authenticated',r.oid,'insert'),
    'client_update',has_table_privilege('authenticated',r.oid,'update'),
    'client_delete',has_table_privilege('authenticated',r.oid,'delete'),
    'realtime',exists(select 1 from pg_publication_tables p where p.pubname='supabase_realtime' and p.schemaname='public' and p.tablename=r.relname)
  ) order by r.relname) from relations r),'[]'::jsonb),
  'functions',coalesce((select jsonb_agg(jsonb_build_object(
    'name',p.proname,'arguments',pg_get_function_identity_arguments(p.oid),'result',pg_get_function_result(p.oid),
    'security_definer',p.prosecdef,'client_execute',has_function_privilege('authenticated',p.oid,'execute'),
    'service_execute',has_function_privilege('service_role',p.oid,'execute')
  ) order by p.proname) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind='f'),'[]'::jsonb)
) as dictionary;
