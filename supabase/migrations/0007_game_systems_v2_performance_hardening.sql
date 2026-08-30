-- Performance hardening after Supabase advisor review.
create index if not exists campaign_invites_created_by_idx on public.campaign_invites(created_by);
create index if not exists quest_edges_to_quest_idx on public.quest_edges(to_quest_id);

drop policy if exists campaign_members_self_select on public.campaign_members;
drop policy if exists campaign_members_manager_select on public.campaign_members;
create policy campaign_members_select on public.campaign_members for select to authenticated using(user_id=(select auth.uid()) or private.is_campaign_manager(campaign_id));

drop policy if exists audit_actor_select on public.game_audit_log;
create policy audit_actor_select on public.game_audit_log for select to authenticated using(private.is_campaign_member(campaign_id) and envelope #>> '{actor,id}' = (select auth.uid())::text);

drop policy if exists campaign_owner on public.campaigns;
create policy campaign_owner_insert on public.campaigns for insert to authenticated with check(owner_id=(select auth.uid()));
create policy campaign_owner_update on public.campaigns for update to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
create policy campaign_owner_delete on public.campaigns for delete to authenticated using(owner_id=(select auth.uid()));

drop policy if exists entity_owner on public.campaign_entities;
create policy entity_owner_insert on public.campaign_entities for insert to authenticated with check(exists(select 1 from public.campaigns c where c.id=campaign_entities.campaign_id and c.owner_id=(select auth.uid())));
create policy entity_owner_update on public.campaign_entities for update to authenticated using(exists(select 1 from public.campaigns c where c.id=campaign_entities.campaign_id and c.owner_id=(select auth.uid()))) with check(exists(select 1 from public.campaigns c where c.id=campaign_entities.campaign_id and c.owner_id=(select auth.uid())));
create policy entity_owner_delete on public.campaign_entities for delete to authenticated using(exists(select 1 from public.campaigns c where c.id=campaign_entities.campaign_id and c.owner_id=(select auth.uid())));

drop policy if exists memory_owner on public.campaign_memory;
create policy memory_owner_insert on public.campaign_memory for insert to authenticated with check(exists(select 1 from public.campaigns c where c.id=campaign_memory.campaign_id and c.owner_id=(select auth.uid())));
create policy memory_owner_update on public.campaign_memory for update to authenticated using(exists(select 1 from public.campaigns c where c.id=campaign_memory.campaign_id and c.owner_id=(select auth.uid()))) with check(exists(select 1 from public.campaigns c where c.id=campaign_memory.campaign_id and c.owner_id=(select auth.uid())));
create policy memory_owner_delete on public.campaign_memory for delete to authenticated using(exists(select 1 from public.campaigns c where c.id=campaign_memory.campaign_id and c.owner_id=(select auth.uid())));

drop policy if exists quests_owner on public.campaign_quests;
create policy quests_owner_insert on public.campaign_quests for insert to authenticated with check(exists(select 1 from public.campaigns c where c.id=campaign_quests.campaign_id and c.owner_id=(select auth.uid())));
create policy quests_owner_update on public.campaign_quests for update to authenticated using(exists(select 1 from public.campaigns c where c.id=campaign_quests.campaign_id and c.owner_id=(select auth.uid()))) with check(exists(select 1 from public.campaigns c where c.id=campaign_quests.campaign_id and c.owner_id=(select auth.uid())));
create policy quests_owner_delete on public.campaign_quests for delete to authenticated using(exists(select 1 from public.campaigns c where c.id=campaign_quests.campaign_id and c.owner_id=(select auth.uid())));

drop policy if exists sessions_owner on public.game_sessions;
create policy sessions_owner_insert on public.game_sessions for insert to authenticated with check(exists(select 1 from public.campaigns c where c.id=game_sessions.campaign_id and c.owner_id=(select auth.uid())));
create policy sessions_owner_update on public.game_sessions for update to authenticated using(exists(select 1 from public.campaigns c where c.id=game_sessions.campaign_id and c.owner_id=(select auth.uid()))) with check(exists(select 1 from public.campaigns c where c.id=game_sessions.campaign_id and c.owner_id=(select auth.uid())));
create policy sessions_owner_delete on public.game_sessions for delete to authenticated using(exists(select 1 from public.campaigns c where c.id=game_sessions.campaign_id and c.owner_id=(select auth.uid())));

drop policy if exists factions_owner on public.faction_relations;
drop policy if exists audit_owner on public.game_audit_log;
drop policy if exists checks_owner on public.game_rule_checks;
drop policy if exists turns_owner on public.game_turns;
