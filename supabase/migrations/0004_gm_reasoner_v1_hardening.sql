-- Production hardening applied after GM Reasoner v1 deployment.
create index if not exists faction_relations_campaign_idx on public.faction_relations(campaign_id);
create index if not exists game_moderation_user_created_idx on public.game_moderation_events(user_id,created_at desc);
create index if not exists campaign_memory_type_created_idx on public.campaign_memory(campaign_id,memory_type,created_at desc);
create index if not exists game_rule_checks_session_idx on public.game_rule_checks(session_id) where session_id is not null;
create index if not exists game_turns_campaign_idx on public.game_turns(campaign_id);

-- State derived by GM Reasoner is server-authoritative. Players may read their own
-- campaign state through RLS but cannot write these derived stores directly.
revoke insert, update, delete on public.faction_relations from anon, authenticated;
revoke insert, update, delete on public.game_rule_checks from anon, authenticated;
revoke insert, update, delete on public.game_moderation_events from anon, authenticated;
revoke insert, update, delete on public.campaign_quests from anon, authenticated;
grant select on public.faction_relations to authenticated;
grant select on public.game_rule_checks to authenticated;
grant select on public.game_moderation_events to authenticated;
grant select on public.campaign_quests to authenticated;
