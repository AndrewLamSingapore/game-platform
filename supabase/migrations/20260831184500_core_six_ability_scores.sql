alter table public.character_stats
  add column if not exists strength smallint not null default 10 check (strength between 1 and 30),
  add column if not exists dexterity smallint not null default 10 check (dexterity between 1 and 30),
  add column if not exists constitution smallint not null default 10 check (constitution between 1 and 30),
  add column if not exists wisdom smallint not null default 10 check (wisdom between 1 and 30),
  add column if not exists charisma smallint not null default 10 check (charisma between 1 and 30);
