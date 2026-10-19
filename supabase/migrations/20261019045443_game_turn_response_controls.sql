-- Additive response-time and turn-integrity controls. Existing audit history is preserved.
alter table public.game_audit_log add column if not exists turn_guard boolean not null default false;
create unique index if not exists game_one_active_gm_turn on public.game_audit_log(campaign_id) where turn_guard;
create or replace function private.validate_game_turn_version() returns trigger language plpgsql security definer set search_path='' as $$
declare current_turn bigint;
begin
 if new.turn_guard then
  select coalesce((world_state->>'last_turn')::bigint,0) into current_turn from public.campaigns where id=new.campaign_id for update;
  if current_turn is distinct from (new.envelope->'context'->>'expected_turn')::bigint then
   raise exception 'stale_beat' using errcode='40001';
  end if;
 end if;
 return new;
end $$;
revoke all on function private.validate_game_turn_version() from public,anon,authenticated;
drop trigger if exists validate_game_turn_version on public.game_audit_log;
create trigger validate_game_turn_version before insert on public.game_audit_log for each row execute function private.validate_game_turn_version();

create table if not exists public.game_narration_limits(bucket text primary key,window_start timestamptz not null,hits integer not null);
alter table public.game_narration_limits enable row level security;
alter table public.game_narration_limits force row level security;
revoke all on public.game_narration_limits from anon,authenticated;
create or replace function public.admit_game_narration(p_campaign_id uuid) returns boolean language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); bucket_key text; period text; cap integer; hits_now integer; window_now timestamptz;
begin
 if actor is null or not exists(select 1 from public.campaign_members where campaign_id=p_campaign_id and user_id=actor and status='ACTIVE' and role in('OWNER','GM','PLAYER')) then return false; end if;
 -- Global buckets first bound paid attempts across all instances and new identities.
 for bucket_key,period,cap in select * from (values
 ('global:minute','minute',100),('global:day','day',2000),
 ('user:minute:'||actor::text,'minute',10),('user:day:'||actor::text,'day',100),
 ('campaign:minute:'||p_campaign_id::text,'minute',20),('campaign:day:'||p_campaign_id::text,'day',200)) as limits(k,p,c)
 loop
  window_now:=date_trunc(period,now());
  insert into public.game_narration_limits(bucket,window_start,hits) values(bucket_key,window_now,1)
   on conflict(bucket) do update set hits=case when game_narration_limits.window_start=excluded.window_start then game_narration_limits.hits+1 else 1 end,window_start=excluded.window_start returning hits into hits_now;
  if hits_now>cap then return false; end if;
 end loop;
 return true;
end $$;
revoke all on function public.admit_game_narration(uuid) from public,anon;
grant execute on function public.admit_game_narration(uuid) to authenticated;

-- One RLS-preserving snapshot replaces the 18-request post-turn refresh.
create or replace function public.game_campaign_snapshot(p_campaign_id uuid) returns jsonb language sql stable security invoker set search_path='' as $$
select jsonb_build_object('panels',jsonb_build_array(
jsonb_build_object('data',(select coalesce(jsonb_agg(to_jsonb(rows)),'[]'::jsonb) from (select * from public.campaign_members where campaign_id=p_campaign_id) rows)),
jsonb_build_object('data',(select coalesce(jsonb_agg(to_jsonb(rows)),'[]'::jsonb) from (select * from public.campaign_entities where campaign_id=p_campaign_id order by updated_at asc) rows)),
jsonb_build_object('data',(select coalesce(jsonb_agg(to_jsonb(rows)),'[]'::jsonb) from (select * from public.character_stats where campaign_id=p_campaign_id) rows)),
jsonb_build_object('data',(select coalesce(jsonb_agg(to_jsonb(rows)),'[]'::jsonb) from (select * from public.inventory_items where campaign_id=p_campaign_id order by created_at asc) rows)),
jsonb_build_object('data',(select coalesce(jsonb_agg(to_jsonb(rows)),'[]'::jsonb) from (select * from public.game_turns where campaign_id=p_campaign_id order by created_at desc limit 120) rows)),
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
