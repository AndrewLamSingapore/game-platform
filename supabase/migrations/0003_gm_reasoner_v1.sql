create table if not exists public.campaign_quests(
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  title text not null,
  status text not null default 'OPEN' check(status in('OPEN','COMPLETED','FAILED','ABANDONED')),
  objective jsonb not null default '{}'::jsonb,
  source_turn bigint,
  resolved_turn bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists campaign_quests_campaign_status_idx on public.campaign_quests(campaign_id,status,created_at desc);

create table if not exists public.faction_relations(
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  faction_name text not null,
  score integer not null default 0 check(score between -100 and 100),
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key(campaign_id,faction_name)
);

create table if not exists public.game_rule_checks(
  id bigserial primary key,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  session_id uuid references public.game_sessions(id) on delete set null,
  turn_no bigint not null,
  skill text not null,
  dc integer not null check(dc between 2 and 30),
  roll integer not null check(roll between 1 and 20),
  modifier integer not null default 0,
  total integer not null,
  success boolean not null,
  critical text check(critical in('SUCCESS','FAILURE') or critical is null),
  created_at timestamptz not null default now()
);
create index if not exists game_rule_checks_campaign_turn_idx on public.game_rule_checks(campaign_id,turn_no desc);

create table if not exists public.game_moderation_events(
  id bigserial primary key,
  campaign_id uuid references public.campaigns(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  category text not null,
  decision text not null check(decision in('ALLOW','BLOCK','REWRITE')),
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists game_moderation_campaign_created_idx on public.game_moderation_events(campaign_id,created_at desc);

alter table public.campaign_quests enable row level security; alter table public.campaign_quests force row level security;
alter table public.faction_relations enable row level security; alter table public.faction_relations force row level security;
alter table public.game_rule_checks enable row level security; alter table public.game_rule_checks force row level security;
alter table public.game_moderation_events enable row level security; alter table public.game_moderation_events force row level security;

create policy quests_owner on public.campaign_quests for all to authenticated using(exists(select 1 from public.campaigns c where c.id=campaign_id and c.owner_id=(select auth.uid()))) with check(exists(select 1 from public.campaigns c where c.id=campaign_id and c.owner_id=(select auth.uid())));
create policy factions_owner on public.faction_relations for select to authenticated using(exists(select 1 from public.campaigns c where c.id=campaign_id and c.owner_id=(select auth.uid())));
create policy checks_owner on public.game_rule_checks for select to authenticated using(exists(select 1 from public.campaigns c where c.id=campaign_id and c.owner_id=(select auth.uid())));
create policy moderation_owner on public.game_moderation_events for select to authenticated using(user_id=(select auth.uid()));
