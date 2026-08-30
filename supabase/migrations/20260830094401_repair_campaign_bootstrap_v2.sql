create or replace function public.bootstrap_campaign_v2()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  insert into public.campaign_members(campaign_id,user_id,role,status)
  values(new.id,new.owner_id,'OWNER','ACTIVE')
  on conflict do nothing;

  insert into public.campaign_rulesets(campaign_id,ruleset_id,config,updated_at)
  values(new.id,'core-v1','{"dice":"d20","base_hp":10,"critical_hit":20,"critical_fail":1,"round_seconds":6,"turn_minutes":10,"max_inventory_slots":20}'::jsonb,now())
  on conflict do nothing;

  insert into public.world_clocks(campaign_id,day,hour,minute,tick_version,updated_at)
  values(new.id,1,8,0,0,now())
  on conflict do nothing;

  return new;
end
$function$;
