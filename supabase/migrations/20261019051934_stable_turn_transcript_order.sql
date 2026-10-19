-- One RLS-preserving snapshot replaces the 18-request post-turn refresh.
create or replace function public.game_campaign_snapshot(p_campaign_id uuid) returns jsonb language sql stable security invoker set search_path='' as $$
select jsonb_build_object('panels',jsonb_build_array(
jsonb_build_object('data',(select coalesce(jsonb_agg(to_jsonb(rows)),'[]'::jsonb) from (select * from public.campaign_members where campaign_id=p_campaign_id) rows)),
jsonb_build_object('data',(select coalesce(jsonb_agg(to_jsonb(rows)),'[]'::jsonb) from (select * from public.campaign_entities where campaign_id=p_campaign_id order by updated_at asc) rows)),
jsonb_build_object('data',(select coalesce(jsonb_agg(to_jsonb(rows)),'[]'::jsonb) from (select * from public.character_stats where campaign_id=p_campaign_id) rows)),
jsonb_build_object('data',(select coalesce(jsonb_agg(to_jsonb(rows)),'[]'::jsonb) from (select * from public.inventory_items where campaign_id=p_campaign_id order by created_at asc) rows)),
jsonb_build_object('data',(select coalesce(jsonb_agg(to_jsonb(rows)),'[]'::jsonb) from (select * from public.game_turns where campaign_id=p_campaign_id order by created_at desc,id desc limit 120) rows)),
jsonb_build_object('data',(select coalesce(jsonb_agg(to_jsonb(rows)),'[]'::jsonb) from (select * from public.campaign_memory where campaign_id=p_campaign_id order by created_at desc limit 18) rows)),
jsonb_build_object('data',(select coalesce(jsonb_agg(to_jsonb(rows)),'[]'::jsonb) from (select * from public.campaign_quests where campaign_id=p_campaign_id order by created_at desc limit 30) rows)),
jsonb_build_object('data',(select coalesce(jsonb_agg(to_jsonb(rows)),'[]'::jsonb) from (select * from public.quest_edges where campaign_id=p_campaign_id) rows)),
jsonb_build_object('data',(select coalesce(jsonb_agg(to_jsonb(rows)),'[]'::jsonb) from (select * from public.faction_relations where campaign_id=p_campaign_id order by score desc limit 20) rows)),
jsonb_build_object('data',(select coalesce(jsonb_agg(to_jsonb(rows)),'[]'::jsonb) from (select * from public.game_rule_checks where campaign_id=p_campaign_id order by created_at desc limit 12) rows)),
jsonb_build_object('data',(select coalesce(jsonb_agg(to_jsonb(rows)),'[]'::jsonb) from (select * from public.npc_agendas where campaign_id=p_campaign_id) rows)),
jsonb_build_object('data',(select to_jsonb(rows) from (select * from public.world_clocks where campaign_id=p_campaign_id limit 1) rows)),
jsonb_build_object('data',(select to_jsonb(rows) from (select * from public.campaign_rulesets where campaign_id=p_campaign_id limit 1) rows)),
jsonb_build_object('data',(select coalesce(jsonb_agg(to_jsonb(rows)),'[]'::jsonb) from (select * from public.combat_encounters where campaign_id=p_campaign_id order by started_at desc limit 10) rows)),
jsonb_build_object('data',(select coalesce(jsonb_agg(to_jsonb(rows)),'[]'::jsonb) from (select * from public.npcs where campaign_id=p_campaign_id) rows)),
jsonb_build_object('data',(select coalesce(jsonb_agg(to_jsonb(rows)),'[]'::jsonb) from (select * from public.npc_memory where campaign_id=p_campaign_id order by created_at desc limit 80) rows)),
jsonb_build_object('data',(select coalesce(jsonb_agg(to_jsonb(rows)),'[]'::jsonb) from (select * from public.npc_relationships where campaign_id=p_campaign_id) rows)),
jsonb_build_object('data',(select coalesce(jsonb_agg(to_jsonb(rows)),'[]'::jsonb) from (select * from public.npc_action_log where campaign_id=p_campaign_id order by tick_id desc limit 80) rows))), 'participants',(select coalesce(jsonb_agg(to_jsonb(rows)),'[]'::jsonb) from (select p.* from public.combat_participants p join public.combat_encounters e on e.id=p.encounter_id where e.campaign_id=p_campaign_id order by e.started_at desc limit 200) rows))
$$;
revoke all on function public.game_campaign_snapshot(uuid) from public,anon;
grant execute on function public.game_campaign_snapshot(uuid) to authenticated;
