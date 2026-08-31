-- Runtime loop connecting the existing GM reasoner to Living Characters.
create or replace function public.sync_living_npc_agenda()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $function$
declare mood text;
begin
  mood := case when new.disposition >= 50 then 'devoted' when new.disposition >= 20 then 'hopeful'
    when new.disposition <= -50 then 'hostile' when new.disposition <= -20 then 'guarded' else 'neutral' end;
  update public.npcs set current_objective=new.agenda,
    emotional_state=jsonb_build_object('mood',mood,'intensity',abs(new.disposition),'last_intent',new.state->>'last_intent'),
    updated_at=now() where id=new.entity_id;
  return new;
end $function$;
revoke execute on function public.sync_living_npc_agenda() from public,anon,authenticated;
drop trigger if exists npc_agendas_sync_living on public.npc_agendas;
create trigger npc_agendas_sync_living after insert or update on public.npc_agendas
for each row execute function public.sync_living_npc_agenda();

create or replace function public.record_living_character_turn()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $function$
declare
  player_turn record;
  n record;
  intent text;
  relationship_delta integer;
  target_user uuid;
begin
  if new.speaker <> 'GM' or new.turn_no <= 0 then return new; end if;
  select * into player_turn from public.game_turns
    where campaign_id=new.campaign_id and turn_no=new.turn_no and speaker='PLAYER'
    order by created_at desc limit 1;
  if not found then return new; end if;
  target_user := nullif(player_turn.metadata->>'user_id','')::uuid;
  relationship_delta := case
    when player_turn.content ~* '(help|protect|save|heal|warn|free|rescue|comfort|support)' then 3
    when player_turn.content ~* '(attack|betray|threaten|steal|kill|destroy|deceive|abandon)' then -4
    else 0 end;

  for n in select p.*,a.state as agenda_state,a.disposition from public.npcs p
    left join public.npc_agendas a on a.entity_id=p.id
    where p.campaign_id=new.campaign_id and p.status='ACTIVE'
  loop
    intent := coalesce(n.agenda_state->>'last_intent','observe');
    insert into public.npc_memory(campaign_id,npc_id,memory_type,content,metadata,importance,decay_weight,occurred_at)
    values(new.campaign_id,n.id,'EVENT',
      'Player action: '||left(player_turn.content,500)||' Outcome: '||left(new.content,700),
      jsonb_build_object('turn_no',new.turn_no,'player_action',player_turn.content,'gm_outcome',new.content),
      case when relationship_delta<>0 then 0.8 else 0.5 end,
      case when relationship_delta<>0 then 1 else 0.75 end,new.created_at);

    insert into public.npc_action_log(campaign_id,npc_id,tick_id,proposed_action,validation_status,validation_reason,outcome)
    values(new.campaign_id,n.id,new.turn_no,
      jsonb_build_object('intent',intent,'objective',coalesce(n.current_objective,n.base_objective),'target_type','WORLD'),
      'APPROVED','Intent was bounded by the server-authoritative world state.',
      jsonb_build_object('observed_player_action',player_turn.content,'world_outcome',new.content))
    on conflict(campaign_id,npc_id,tick_id) do nothing;

    if target_user is not null then
      insert into public.npc_relationships(campaign_id,npc_id,target_type,target_id,score,trust,fear,respect,last_updated)
      values(new.campaign_id,n.id,'PLAYER',target_user,relationship_delta,
        greatest(-100,least(100,relationship_delta)),case when relationship_delta<0 then abs(relationship_delta) else 0 end,
        case when relationship_delta>0 then relationship_delta else 0 end,now())
      on conflict(campaign_id,npc_id,target_type,target_id) do update set
        score=greatest(-100,least(100,public.npc_relationships.score+relationship_delta)),
        trust=greatest(-100,least(100,public.npc_relationships.trust+relationship_delta)),
        fear=greatest(0,least(100,public.npc_relationships.fear+case when relationship_delta<0 then abs(relationship_delta) else -1 end)),
        respect=greatest(-100,least(100,public.npc_relationships.respect+case when relationship_delta>0 then relationship_delta else 0 end)),
        last_updated=now();
    end if;
  end loop;
  return new;
end $function$;
revoke execute on function public.record_living_character_turn() from public,anon,authenticated;
drop trigger if exists game_turns_record_living_characters on public.game_turns;
create trigger game_turns_record_living_characters after insert on public.game_turns
for each row execute function public.record_living_character_turn();
