-- Template generated with Supabase CLI 2.121.0 migration new independent_fresh_baseline.
-- Only staged copies use this identity. Never add it to an existing production ledger.
-- The CLI runs one migration transaction; reject a populated target before original SQL.
do $fresh$
begin
  if to_regprocedure('auth.uid()') is null then
    raise exception 'Fresh Game baseline requires the Supabase auth.uid() identity function';
  end if;
  if exists (
    select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname in ('public','private') and c.relkind in ('r','p','v','m','f','S')
      and not exists(select 1 from pg_depend d where d.classid='pg_class'::regclass and d.objid=c.oid and d.deptype='e')
  ) or exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname in ('public','private')
      and not exists(select 1 from pg_depend d where d.classid='pg_proc'::regclass and d.objid=p.oid and d.deptype='e')
  ) then
    raise exception 'Fresh Game baseline requires an empty public application schema (including private helpers)';
  end if;
  if to_regclass('supabase_migrations.schema_migrations') is not null then
    if exists(select 1 from supabase_migrations.schema_migrations) then
      raise exception 'Fresh Game baseline requires an empty migration ledger';
    end if;
  end if;
end
$fresh$;
