do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'portfolio_event_outbox'
      and policyname = 'portfolio_event_outbox_deny_users'
  ) then
    create policy portfolio_event_outbox_deny_users
      on public.portfolio_event_outbox
      for all
      to anon, authenticated
      using (false)
      with check (false);
  end if;
end
$$;
