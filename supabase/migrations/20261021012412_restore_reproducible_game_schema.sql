-- Forward-compatible repair for schema facts missing from the historical files.
-- Preserve every historical migration and all row data. Apply atomically.
-- Fresh recovery also runs this after 0001, before later files reference kind/title.
do $repair$
declare
  mapping record;
  has_legacy boolean;
  has_canonical boolean;
begin
  for mapping in select * from (values
    ('campaigns', 'name', 'title'),
    ('campaign_entities', 'entity_type', 'kind')
  ) as columns_to_reconcile(table_name, legacy_name, canonical_name)
  loop
    select exists(select 1 from information_schema.columns c where c.table_schema='public'
      and c.table_name=mapping.table_name and c.column_name=mapping.legacy_name),
      exists(select 1 from information_schema.columns c where c.table_schema='public'
      and c.table_name=mapping.table_name and c.column_name=mapping.canonical_name)
      into has_legacy, has_canonical;
    if has_legacy and has_canonical then
      raise exception 'Ambiguous game schema: %.% and % both exist; reconcile explicitly before applying',
        mapping.table_name, mapping.legacy_name, mapping.canonical_name using errcode='55000';
    elsif has_legacy then
      execute format('alter table public.%I rename column %I to %I',
        mapping.table_name, mapping.legacy_name, mapping.canonical_name);
    elsif not has_canonical then
      raise exception 'Missing game schema: %.%', mapping.table_name, mapping.canonical_name using errcode='55000';
    end if;
  end loop;
end
$repair$;

alter table public.campaigns add column if not exists updated_at timestamptz not null default now();
alter table public.campaign_entities add column if not exists updated_at timestamptz not null default now();
alter table public.game_events add column if not exists correlation_id text;

-- gm-turn persists SOCIAL memory. Extend only the existing one-column type check;
-- retain any other accepted memory types and every other constraint.
do $memory$
declare
  old_check text;
  accepts_social boolean;
begin
  select pg_get_expr(c.conbin,c.conrelid) into old_check from pg_constraint c
    where c.conrelid='public.campaign_memory'::regclass and c.contype='c'
    and c.conname='campaign_memory_memory_type_check'
    and c.conkey=array[(select a.attnum from pg_attribute a
      where a.attrelid='public.campaign_memory'::regclass and a.attname='memory_type')];
  if old_check is not null then
    execute format('select (%s) from (select ''SOCIAL''::text as memory_type) candidate',old_check) into accepts_social;
    if not coalesce(accepts_social,false) then
      alter table public.campaign_memory drop constraint campaign_memory_memory_type_check;
      execute format('alter table public.campaign_memory add constraint campaign_memory_memory_type_check check ((%s) or memory_type=''SOCIAL'')',old_check);
    end if;
  end if;
end
$memory$;
-- Canonical Action Envelopes use actor_id. Keep the historical actor.id read
-- compatible, while still requiring current campaign membership and actor identity.
-- The early fresh-recovery application precedes this helper; the final pass owns
-- this policy repair after all historical access-control migrations have run.
do $audit$
begin
  if to_regprocedure('private.is_campaign_member(uuid)') is not null then
    drop policy if exists audit_actor_select on public.game_audit_log;
    create policy audit_actor_select on public.game_audit_log for select to authenticated
      using(private.is_campaign_member(campaign_id) and
        coalesce(envelope->>'actor_id',envelope #>> '{actor,id}')=(select auth.uid())::text);
  end if;
end
$audit$;