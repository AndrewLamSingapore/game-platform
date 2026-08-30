create policy campaign_owner_select
on public.campaigns
for select
to authenticated
using ((select auth.uid()) = owner_id);
