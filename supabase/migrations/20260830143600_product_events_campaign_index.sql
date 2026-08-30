-- Cover campaign foreign-key deletes and campaign-scoped funnel analysis.
create index if not exists product_events_campaign_created_idx
  on public.product_events(campaign_id, created_at desc);
