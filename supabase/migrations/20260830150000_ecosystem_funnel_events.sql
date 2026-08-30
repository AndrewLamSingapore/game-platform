alter table public.product_events drop constraint if exists product_events_event_name_check;
alter table public.product_events add constraint product_events_event_name_check check (event_name in (
  'game_platform_loaded','starter_world_viewed','starter_world_selected','campaign_created',
  'first_decision_completed','second_turn_completed','return_visit',
  'ecosystem_link_clicked','ecosystem_referral_received'
));
