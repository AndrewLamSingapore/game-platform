-- Living Worlds turn-integrity hardening (2026-09-22).
--
-- The edge functions and tests/schema-contract.test.mjs treat the canonical
-- columns of game_audit_log as: actor_type, action, policy_state,
-- execution_status, verification_status, outcome_status, envelope and
-- decision_record. Migration 0001 instead created action_type and decision, so
-- a database rebuilt from this repository alone would not match the live schema
-- that the functions and contract test already rely on.
--
-- This migration is additive: it adds the canonical columns to a database that
-- predates them and relaxes the legacy column only if it is present. No data is
-- removed.
--
-- STATUS: NOT APPLIED. This migration has not been executed against the live
-- Supabase project; see the pull-request evidence section.

alter table public.game_audit_log add column if not exists actor_type text not null default 'USER';
alter table public.game_audit_log add column if not exists action text not null default 'gm.turn';
alter table public.game_audit_log add column if not exists execution_status text not null default 'PENDING';
alter table public.game_audit_log add column if not exists verification_status text not null default 'PENDING';
alter table public.game_audit_log add column if not exists outcome_status text not null default 'PENDING';
alter table public.game_audit_log add column if not exists decision_record jsonb not null default '{}'::jsonb;

-- The turn path reserves an idempotency row before the turn is resolved, so the
-- legacy NOT NULL column (when it exists) must accept an insert that carries the
-- canonical action instead.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'game_audit_log'
      and column_name = 'action_type'
  ) then
    execute 'alter table public.game_audit_log alter column action_type drop not null';
    execute 'alter table public.game_audit_log alter column action_type set default ''gm.turn''';
  end if;
end
$$;

alter table public.game_audit_log alter column policy_state set default 'PENDING';

comment on column public.game_audit_log.decision_record is
  'Reserved turn rows carry {reason: turn_reserved}; completed rows carry the resolved TurnResult.';
