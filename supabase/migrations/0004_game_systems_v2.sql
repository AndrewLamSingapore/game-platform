-- Game Systems v2: multiplayer membership, rulesets, inventory, combat, NPC autonomy, quest graph, world clock.
create extension if not exists pgcrypto;

create table if not exists public.campaign_members(
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check(role in('OWNER','GM','PLAYER','SPECTATOR')) default 'PLAYER',
  status text not null check(status in('ACTIVE','LEFT','BANNED')) default 'ACTIVE',
  joined_at timestamptz not null default now(),
  primary key(campaign_id,user_id)
);
create index if not exists campaign_members_user_idx on public.campaign_members(user_id,campaign_id) where status='ACTIVE';

insert into public.campaign_members(campaign_id,user_id,role,status)
select id,owner_id,'OWNER','ACTIVE' from public.campaigns
on conflict(campaign_id,user_id) do update set role='OWNER',status='ACTIVE';

create or replace function public.is_campaign_member(p_campaign_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.campaign_members m where m.campaign_id=p_campaign_id and m.user_id=auth.uid() and m.status='ACTIVE');
$$;
create or replace function public.campaign_role(p_campaign_id uuid)
returns text language sql stable security definer set search_path=public as $$
  select m.role from public.campaign_members m where m.campaign_id=p_campaign_id and m.user_id=auth.uid() and m.status='ACTIVE' limit 1;
$$;
revoke all on function public.is_campaign_member(uuid) from public;
revoke all on function public.campaign_role(uuid) from public;
grant execute on function public.is_campaign_member(uuid), public.campaign_role(uuid) to authenticated;

create table if not exists public.campaign_invites(
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  code_digest text not null unique,
  role text not null check(role in('GM','PLAYER','SPECTATOR')) default 'PLAYER',
  created_by uuid not null references auth.users(id),
  expires_at timestamptz,
  max_uses integer not null default 1 check(max_uses between 1 and 100),
  uses integer not null default 0 check(uses>=0),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists campaign_invites_campaign_idx on public.campaign_invites(campaign_id,created_at desc);

create table if not exists public.campaign_rulesets(
  campaign_id uuid primary key references public.campaigns(id) on delete cascade,
  ruleset_id text not null default 'core-v1',
  config jsonb not null default '{"dice":"d20","base_hp":10,"critical_hit":20,"critical_fail":1,"round_seconds":6,"turn_minutes":10,"max_inventory_slots":20}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.character_stats(
  entity_id uuid primary key references public.campaign_entities(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  level integer not null default 1 check(level between 1 and 20),
  hp integer not null default 10 check(hp>=0),
  max_hp integer not null default 10 check(max_hp>0),
  armor integer not null default 10,
  attack integer not null default 2,
  speed integer not null default 30,
  conditions jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
create index if not exists character_stats_campaign_idx on public.character_stats(campaign_id);

create table if not exists public.inventory_items(
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  owner_entity_id uuid references public.campaign_entities(id) on delete cascade,
  name text not null,
  item_type text not null default 'MISC',
  quantity integer not null default 1 check(quantity between 0 and 9999),
  equipped_slot text check(equipped_slot is null or equipped_slot in('HEAD','BODY','MAIN_HAND','OFF_HAND','ACCESSORY')),
  state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists inventory_campaign_owner_idx on public.inventory_items(campaign_id,owner_entity_id);
create unique index if not exists inventory_one_slot_idx on public.inventory_items(owner_entity_id,equipped_slot) where equipped_slot is not null;

create table if not exists public.combat_encounters(
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  status text not null check(status in('ACTIVE','COMPLETED','ABORTED')) default 'ACTIVE',
  round_no integer not null default 1 check(round_no>0),
  current_turn integer not null default 0 check(current_turn>=0),
  state jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);
create index if not exists combat_encounters_campaign_idx on public.combat_encounters(campaign_id,status);

create table if not exists public.combat_participants(
  encounter_id uuid not null references public.combat_encounters(id) on delete cascade,
  entity_id uuid not null references public.campaign_entities(id) on delete cascade,
  initiative integer not null default 0,
  side text not null default 'NEUTRAL',
  active boolean not null default true,
  state jsonb not null default '{}'::jsonb,
  primary key(encounter_id,entity_id)
);
create index if not exists combat_participants_entity_idx on public.combat_participants(entity_id);

create table if not exists public.npc_agendas(
  entity_id uuid primary key references public.campaign_entities(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  agenda text not null default 'observe',
  disposition integer not null default 0 check(disposition between -100 and 100),
  next_action_at timestamptz,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create index if not exists npc_agendas_campaign_idx on public.npc_agendas(campaign_id,next_action_at);

create table if not exists public.world_clocks(
  campaign_id uuid primary key references public.campaigns(id) on delete cascade,
  day integer not null default 1 check(day>0),
  hour integer not null default 8 check(hour between 0 and 23),
  minute integer not null default 0 check(minute between 0 and 59),
  tick_version bigint not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.quest_edges(
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  from_quest_id uuid not null references public.campaign_quests(id) on delete cascade,
  to_quest_id uuid not null references public.campaign_quests(id) on delete cascade,
  edge_type text not null check(edge_type in('UNLOCKS','REQUIRES','BLOCKS','BRANCHES_TO')) default 'UNLOCKS',
  state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check(from_quest_id<>to_quest_id),
  unique(from_quest_id,to_quest_id,edge_type)
);
create index if not exists quest_edges_campaign_idx on public.quest_edges(campaign_id);

insert into public.campaign_rulesets(campaign_id) select id from public.campaigns on conflict do nothing;
insert into public.world_clocks(campaign_id) select id from public.campaigns on conflict do nothing;

create or replace function public.bootstrap_campaign_v2()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.campaign_members(campaign_id,user_id,role,status) values(new.id,new.owner_id,'OWNER','ACTIVE') on conflict do nothing;
  insert into public.campaign_rulesets(campaign_id) values(new.id,'core-v1','{"dice":"d20","base_hp":10,"critical_hit":20,"critical_fail":1,"round_seconds":6,"turn_minutes":10,"max_inventory_slots":20}'::jsonb,now()) on conflict do nothing;
  insert into public.world_clocks(campaign_id) values(new.id,1,8,0,0,now()) on conflict do nothing;
  return new;
end $$;
drop trigger if exists campaigns_bootstrap_v2 on public.campaigns;
create trigger campaigns_bootstrap_v2 after insert on public.campaigns for each row execute function public.bootstrap_campaign_v2();

alter table public.campaign_members enable row level security; alter table public.campaign_members force row level security;
alter table public.campaign_invites enable row level security; alter table public.campaign_invites force row level security;
alter table public.campaign_rulesets enable row level security; alter table public.campaign_rulesets force row level security;
alter table public.character_stats enable row level security; alter table public.character_stats force row level security;
alter table public.inventory_items enable row level security; alter table public.inventory_items force row level security;
alter table public.combat_encounters enable row level security; alter table public.combat_encounters force row level security;
alter table public.combat_participants enable row level security; alter table public.combat_participants force row level security;
alter table public.npc_agendas enable row level security; alter table public.npc_agendas force row level security;
alter table public.world_clocks enable row level security; alter table public.world_clocks force row level security;
alter table public.quest_edges enable row level security; alter table public.quest_edges force row level security;

-- Existing owner policies remain; these permissive SELECT policies extend visibility to active members.
drop policy if exists campaigns_member_select on public.campaigns;
create policy campaigns_member_select on public.campaigns for select to authenticated using(public.is_campaign_member(id));
drop policy if exists entities_member_select on public.campaign_entities;
create policy entities_member_select on public.campaign_entities for select to authenticated using(public.is_campaign_member(campaign_id));
drop policy if exists memory_member_select on public.campaign_memory;
create policy memory_member_select on public.campaign_memory for select to authenticated using(public.is_campaign_member(campaign_id));
drop policy if exists sessions_member_select on public.game_sessions;
create policy sessions_member_select on public.game_sessions for select to authenticated using(public.is_campaign_member(campaign_id));
drop policy if exists turns_member_select on public.game_turns;
create policy turns_member_select on public.game_turns for select to authenticated using(public.is_campaign_member(campaign_id));
drop policy if exists quests_member_select on public.campaign_quests;
create policy quests_member_select on public.campaign_quests for select to authenticated using(public.is_campaign_member(campaign_id));
drop policy if exists factions_member_select on public.faction_relations;
create policy factions_member_select on public.faction_relations for select to authenticated using(public.is_campaign_member(campaign_id));
drop policy if exists checks_member_select on public.game_rule_checks;
create policy checks_member_select on public.game_rule_checks for select to authenticated using(public.is_campaign_member(campaign_id));

create policy campaign_members_select on public.campaign_members for select to authenticated using(public.is_campaign_member(campaign_id));
create policy campaign_invites_manage_select on public.campaign_invites for select to authenticated using(public.campaign_role(campaign_id) in('OWNER','GM'));
create policy campaign_rulesets_select on public.campaign_rulesets for select to authenticated using(public.is_campaign_member(campaign_id));
create policy character_stats_select on public.character_stats for select to authenticated using(public.is_campaign_member(campaign_id));
create policy inventory_items_select on public.inventory_items for select to authenticated using(public.is_campaign_member(campaign_id));
create policy combat_encounters_select on public.combat_encounters for select to authenticated using(public.is_campaign_member(campaign_id));
create policy combat_participants_select on public.combat_participants for select to authenticated using(exists(select 1 from public.combat_encounters e where e.id=encounter_id and public.is_campaign_member(e.campaign_id)));
create policy npc_agendas_select on public.npc_agendas for select to authenticated using(public.is_campaign_member(campaign_id));
create policy world_clocks_select on public.world_clocks for select to authenticated using(public.is_campaign_member(campaign_id));
create policy quest_edges_select on public.quest_edges for select to authenticated using(public.is_campaign_member(campaign_id));
