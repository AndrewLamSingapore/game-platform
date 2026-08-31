-- Advisor-driven hardening for the competitive runtime.
create index if not exists competitive_matches_campaign_idx on public.competitive_matches(campaign_id) where campaign_id is not null;
create index if not exists competitive_risk_match_idx on public.competitive_risk_flags(match_id);

drop policy if exists competitive_risk_flags_deny_all on public.competitive_risk_flags;
create policy competitive_risk_flags_deny_all on public.competitive_risk_flags
as restrictive for all to authenticated using(false) with check(false);
