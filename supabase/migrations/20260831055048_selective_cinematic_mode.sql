-- Selective Cinematic Mode: one durable AI-video job per pivotal scene.
create table public.cinematic_jobs(
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete cascade,
  source_turn integer not null check(source_turn >= 0),
  scene_key text not null check(char_length(scene_key) between 1 and 160),
  prompt_fingerprint text not null check(char_length(prompt_fingerprint) between 32 and 128),
  provider text not null default 'vercel-ai-gateway',
  model text not null default 'google/veo-3.1-lite-generate-001',
  status text not null default 'RESERVED' check(status in('RESERVED','QUEUED','PROCESSING','READY','FAILED')),
  operation jsonb,
  output_url text,
  media_type text,
  progress smallint not null default 5 check(progress between 0 and 100),
  duration_seconds smallint not null default 4 check(duration_seconds between 2 and 15),
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  unique(campaign_id,source_turn)
);
create index cinematic_jobs_requester_day_idx on public.cinematic_jobs(requested_by,created_at desc);
create index cinematic_jobs_campaign_day_idx on public.cinematic_jobs(campaign_id,created_at desc);
alter table public.cinematic_jobs enable row level security;
alter table public.cinematic_jobs force row level security;
revoke all on table public.cinematic_jobs from public,anon,authenticated;
grant select on table public.cinematic_jobs to authenticated;
grant select,insert,update,delete on table public.cinematic_jobs to service_role;
create policy cinematic_jobs_member_select on public.cinematic_jobs for select to authenticated
using(private.is_campaign_member(campaign_id));

create or replace function public.reserve_cinematic_job(
  p_campaign_id uuid,
  p_source_turn integer,
  p_scene_key text,
  p_prompt_fingerprint text
) returns jsonb language plpgsql security definer set search_path=public,private,pg_temp as $function$
declare
  v_user uuid := auth.uid();
  v_job public.cinematic_jobs;
  v_count integer;
begin
  if v_user is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if p_source_turn < 0 or char_length(trim(p_scene_key)) not between 1 and 160
    or char_length(trim(p_prompt_fingerprint)) not between 32 and 128 then
    raise exception 'invalid_cinematic_request' using errcode='22023';
  end if;
  if not private.is_campaign_member(p_campaign_id) then
    raise exception 'campaign_access_denied' using errcode='42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_campaign_id::text||':'||p_source_turn::text,0));
  select * into v_job from public.cinematic_jobs
    where campaign_id=p_campaign_id and source_turn=p_source_turn;
  if found then
    return jsonb_build_object('created',false,'job',to_jsonb(v_job)-'operation');
  end if;

  select count(*) into v_count from public.cinematic_jobs
    where requested_by=v_user and created_at >= date_trunc('day',now());
  if v_count >= 3 then
    raise sqlstate 'PGRST' using
      message='{"code":"cinematic_daily_limit","message":"Today''s cinematic limit has been reached."}',
      detail='{"status":429,"status_text":"Too Many Requests"}';
  end if;
  select count(*) into v_count from public.cinematic_jobs
    where campaign_id=p_campaign_id and created_at >= date_trunc('day',now());
  if v_count >= 8 then
    raise sqlstate 'PGRST' using
      message='{"code":"campaign_cinematic_limit","message":"This world''s cinematic limit has been reached for today."}',
      detail='{"status":429,"status_text":"Too Many Requests"}';
  end if;

  insert into public.cinematic_jobs(campaign_id,requested_by,source_turn,scene_key,prompt_fingerprint)
  values(p_campaign_id,v_user,p_source_turn,left(trim(p_scene_key),160),left(trim(p_prompt_fingerprint),128))
  returning * into v_job;
  return jsonb_build_object('created',true,'job',to_jsonb(v_job)-'operation');
end $function$;
revoke all on function public.reserve_cinematic_job(uuid,integer,text,text) from public,anon;
grant execute on function public.reserve_cinematic_job(uuid,integer,text,text) to authenticated,service_role;

create or replace function public.transition_cinematic_job(
  p_job_id uuid,
  p_status text,
  p_operation jsonb default null,
  p_output_url text default null,
  p_media_type text default null,
  p_error_code text default null
) returns public.cinematic_jobs language plpgsql security definer set search_path=public,private,pg_temp as $function$
declare
  v_user uuid := auth.uid();
  v_job public.cinematic_jobs;
  v_allowed boolean := false;
begin
  if v_user is null then raise exception 'authentication_required' using errcode='42501'; end if;
  select * into v_job from public.cinematic_jobs where id=p_job_id for update;
  if not found or v_job.requested_by<>v_user or not private.is_campaign_member(v_job.campaign_id) then
    raise exception 'cinematic_job_access_denied' using errcode='42501';
  end if;
  v_allowed := case v_job.status
    when 'RESERVED' then p_status in('QUEUED','FAILED')
    when 'QUEUED' then p_status in('PROCESSING','READY','FAILED')
    when 'PROCESSING' then p_status in('PROCESSING','READY','FAILED')
    when 'READY' then p_status='READY'
    when 'FAILED' then p_status='FAILED'
    else false end;
  if not v_allowed then raise exception 'invalid_cinematic_transition' using errcode='22023'; end if;
  if p_status='QUEUED' and coalesce(p_operation,'null'::jsonb)='null'::jsonb then
    raise exception 'cinematic_operation_required' using errcode='22023';
  end if;
  if p_status='READY' and (p_output_url is null or p_output_url !~ '^https://') then
    raise exception 'secure_cinematic_url_required' using errcode='22023';
  end if;
  update public.cinematic_jobs set
    status=p_status,
    operation=case when p_operation is not null then p_operation else operation end,
    output_url=case when p_status='READY' then left(p_output_url,4096) else output_url end,
    media_type=case when p_status='READY' then left(coalesce(p_media_type,'video/mp4'),100) else media_type end,
    progress=case p_status when 'QUEUED' then 15 when 'PROCESSING' then greatest(progress,55) when 'READY' then 100 when 'FAILED' then 100 else progress end,
    error_code=case when p_status='FAILED' then left(regexp_replace(coalesce(p_error_code,'generation_failed'),'[^a-zA-Z0-9_-]','','g'),80) else null end,
    completed_at=case when p_status in('READY','FAILED') then now() else completed_at end,
    updated_at=now()
  where id=p_job_id returning * into v_job;
  return v_job;
end $function$;
revoke all on function public.transition_cinematic_job(uuid,text,jsonb,text,text,text) from public,anon;
grant execute on function public.transition_cinematic_job(uuid,text,jsonb,text,text,text) to authenticated,service_role;
