-- Post-deployment security hardening for Game Systems v2.
-- Moves RLS membership helpers out of the exposed public API schema, removes recursive manager policies,
-- restricts definer-only bootstrap/invite functions, and retains campaign_role/is_campaign_member only as safe invoker shims.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

create or replace function private.is_campaign_member(p_campaign_id uuid)
returns boolean language sql stable security definer set search_path=public,private as $$
  select exists(select 1 from public.campaign_members m where m.campaign_id=p_campaign_id and m.user_id=auth.uid() and m.status='ACTIVE');
$$;
revoke all on function private.is_campaign_member(uuid) from public, anon;
grant execute on function private.is_campaign_member(uuid) to authenticated, service_role;

create or replace function private.is_campaign_manager(p_campaign_id uuid)
returns boolean language sql stable security definer set search_path=public,private as $$
  select exists(select 1 from public.campaign_members m where m.campaign_id=p_campaign_id and m.user_id=auth.uid() and m.status='ACTIVE' and m.role in('OWNER','GM'));
$$;
revoke all on function private.is_campaign_manager(uuid) from public, anon;
grant execute on function private.is_campaign_manager(uuid) to authenticated, service_role;

drop policy if exists campaign_members_select on public.campaign_members;
drop policy if exists campaign_members_self_select on public.campaign_members;
drop policy if exists campaign_members_manager_select on public.campaign_members;
create policy campaign_members_self_select on public.campaign_members for select to authenticated using(user_id=auth.uid());
create policy campaign_members_manager_select on public.campaign_members for select to authenticated using(private.is_campaign_manager(campaign_id));

drop policy if exists campaigns_member_select on public.campaigns;
create policy campaigns_member_select on public.campaigns for select to authenticated using(private.is_campaign_member(id));
drop policy if exists entities_member_select on public.campaign_entities;
create policy entities_member_select on public.campaign_entities for select to authenticated using(private.is_campaign_member(campaign_id));
drop policy if exists memory_member_select on public.campaign_memory;
create policy memory_member_select on public.campaign_memory for select to authenticated using(private.is_campaign_member(campaign_id));
drop policy if exists sessions_member_select on public.game_sessions;
create policy sessions_member_select on public.game_sessions for select to authenticated using(private.is_campaign_member(campaign_id));
drop policy if exists turns_member_select on public.game_turns;
create policy turns_member_select on public.game_turns for select to authenticated using(private.is_campaign_member(campaign_id));
drop policy if exists quests_member_select on public.campaign_quests;
create policy quests_member_select on public.campaign_quests for select to authenticated using(private.is_campaign_member(campaign_id));
drop policy if exists factions_member_select on public.faction_relations;
create policy factions_member_select on public.faction_relations for select to authenticated using(private.is_campaign_member(campaign_id));
drop policy if exists checks_member_select on public.game_rule_checks;
create policy checks_member_select on public.game_rule_checks for select to authenticated using(private.is_campaign_member(campaign_id));
drop policy if exists campaign_invites_manage_select on public.campaign_invites;
create policy campaign_invites_manage_select on public.campaign_invites for select to authenticated using(private.is_campaign_manager(campaign_id));
drop policy if exists campaign_rulesets_select on public.campaign_rulesets;
create policy campaign_rulesets_select on public.campaign_rulesets for select to authenticated using(private.is_campaign_member(campaign_id));
drop policy if exists character_stats_select on public.character_stats;
create policy character_stats_select on public.character_stats for select to authenticated using(private.is_campaign_member(campaign_id));
drop policy if exists inventory_items_select on public.inventory_items;
create policy inventory_items_select on public.inventory_items for select to authenticated using(private.is_campaign_member(campaign_id));
drop policy if exists combat_encounters_select on public.combat_encounters;
create policy combat_encounters_select on public.combat_encounters for select to authenticated using(private.is_campaign_member(campaign_id));
drop policy if exists combat_participants_select on public.combat_participants;
create policy combat_participants_select on public.combat_participants for select to authenticated using(exists(select 1 from public.combat_encounters e where e.id=encounter_id and private.is_campaign_member(e.campaign_id)));
drop policy if exists npc_agendas_select on public.npc_agendas;
create policy npc_agendas_select on public.npc_agendas for select to authenticated using(private.is_campaign_member(campaign_id));
drop policy if exists world_clocks_select on public.world_clocks;
create policy world_clocks_select on public.world_clocks for select to authenticated using(private.is_campaign_member(campaign_id));
drop policy if exists quest_edges_select on public.quest_edges;
create policy quest_edges_select on public.quest_edges for select to authenticated using(private.is_campaign_member(campaign_id));
drop policy if exists audit_actor_select on public.game_audit_log;
create policy audit_actor_select on public.game_audit_log for select to authenticated using(private.is_campaign_member(campaign_id) and envelope #>> '{actor,id}' = auth.uid()::text);

revoke execute on function public.bootstrap_campaign_v2() from public, anon, authenticated;
revoke execute on function public.claim_campaign_invite(text,uuid) from public, anon, authenticated;

create or replace function public.campaign_role(p_campaign_id uuid)
returns text language sql stable security invoker set search_path=public as $$
  select m.role from public.campaign_members m where m.campaign_id=p_campaign_id and m.user_id=auth.uid() and m.status='ACTIVE' limit 1;
$$;
revoke all on function public.campaign_role(uuid) from public, anon;
grant execute on function public.campaign_role(uuid) to authenticated, service_role;

create or replace function public.is_campaign_member(p_campaign_id uuid)
returns boolean language sql stable security invoker set search_path=public as $$
  select exists(select 1 from public.campaign_members m where m.campaign_id=p_campaign_id and m.user_id=auth.uid() and m.status='ACTIVE');
$$;
revoke all on function public.is_campaign_member(uuid) from public, anon;
grant execute on function public.is_campaign_member(uuid) to authenticated, service_role;
