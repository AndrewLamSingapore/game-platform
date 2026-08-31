create or replace function public.claim_next_game_turn(p_session_id uuid)
returns bigint
language sql
security invoker
set search_path = ''
as $$
  update public.game_sessions
  set turn_count = turn_count + 1,
      last_active_at = now()
  where id = p_session_id
    and status = 'ACTIVE'
  returning turn_count::bigint;
$$;

revoke all on function public.claim_next_game_turn(uuid) from public, anon, authenticated;
grant execute on function public.claim_next_game_turn(uuid) to service_role;
