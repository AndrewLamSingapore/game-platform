-- Game Systems v2 hardening: backfill, actor-scoped idempotency, quest integrity, atomic invite claims.
update public.campaign_entities e
set state=jsonb_set(coalesce(e.state,'{}'::jsonb),'{controlled_by}',to_jsonb(c.owner_id::text),true)
from public.campaigns c
where e.campaign_id=c.id and e.entity_type='PC' and not (coalesce(e.state,'{}'::jsonb) ? 'controlled_by');

insert into public.character_stats(entity_id,campaign_id)
select e.id,e.campaign_id from public.campaign_entities e
where e.entity_type in('PC','NPC')
on conflict(entity_id) do nothing;

insert into public.npc_agendas(entity_id,campaign_id,agenda,disposition)
select e.id,e.campaign_id,'observe',0 from public.campaign_entities e
where e.entity_type='NPC'
on conflict(entity_id) do nothing;

drop policy if exists audit_actor_select on public.game_audit_log;
create policy audit_actor_select on public.game_audit_log for select to authenticated
using(public.is_campaign_member(campaign_id) and envelope #>> '{actor,id}' = auth.uid()::text);

create or replace function public.validate_quest_edge_campaign()
returns trigger language plpgsql set search_path=public as $$
declare from_campaign uuid; to_campaign uuid;
begin
  select campaign_id into from_campaign from public.campaign_quests where id=new.from_quest_id;
  select campaign_id into to_campaign from public.campaign_quests where id=new.to_quest_id;
  if from_campaign is null or to_campaign is null or from_campaign<>new.campaign_id or to_campaign<>new.campaign_id then
    raise exception 'quest_edge_campaign_mismatch';
  end if;
  return new;
end $$;
drop trigger if exists quest_edge_campaign_guard on public.quest_edges;
create trigger quest_edge_campaign_guard before insert or update on public.quest_edges for each row execute function public.validate_quest_edge_campaign();

create or replace function public.claim_campaign_invite(p_code_digest text,p_user_id uuid)
returns table(campaign_id uuid, member_role text)
language plpgsql security definer set search_path=public as $$
declare v public.campaign_invites%rowtype; existing_role text;
begin
  select * into v from public.campaign_invites where code_digest=p_code_digest for update;
  if not found or v.revoked_at is not null then raise exception 'invalid_invite'; end if;
  if v.expires_at is not null and v.expires_at<now() then raise exception 'invite_expired'; end if;
  select role into existing_role from public.campaign_members where campaign_members.campaign_id=v.campaign_id and user_id=p_user_id and status='ACTIVE';
  if existing_role is not null then return query select v.campaign_id,existing_role; return; end if;
  if v.uses>=v.max_uses then raise exception 'invite_exhausted'; end if;
  insert into public.campaign_members(campaign_id,user_id,role,status,joined_at)
  values(v.campaign_id,p_user_id,v.role,'ACTIVE',now())
  on conflict(campaign_id,user_id) do update set role=excluded.role,status='ACTIVE',joined_at=now();
  update public.campaign_invites set uses=uses+1 where id=v.id;
  return query select v.campaign_id,v.role;
end $$;
revoke all on function public.claim_campaign_invite(text,uuid) from public;
grant execute on function public.claim_campaign_invite(text,uuid) to service_role;
