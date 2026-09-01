create table if not exists public.portfolio_event_outbox (
  event_id text primary key,
  event_json jsonb not null,
  status text not null default 'PENDING' check (status in ('PENDING','RETRY','DELIVERED','DEAD')),
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  last_error text,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.portfolio_event_outbox enable row level security;
revoke all on table public.portfolio_event_outbox from anon, authenticated;
grant all on table public.portfolio_event_outbox to service_role;

create index if not exists portfolio_event_outbox_delivery_idx
  on public.portfolio_event_outbox (status, next_attempt_at)
  where status in ('PENDING','RETRY');

comment on table public.portfolio_event_outbox is
  'Server-only durable Portfolio Event delivery queue. RLS is fail-closed for user roles.';
