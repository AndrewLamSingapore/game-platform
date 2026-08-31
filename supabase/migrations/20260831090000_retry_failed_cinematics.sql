alter table public.cinematic_jobs
  add column if not exists retry_count smallint not null default 0
  check (retry_count between 0 and 1);

create or replace function public.retry_cinematic_job(p_job_id uuid)
returns public.cinematic_jobs
language plpgsql
security definer
set search_path=public,private,pg_temp
as $function$
declare
  v_user uuid := auth.uid();
  v_job public.cinematic_jobs;
begin
  if v_user is null then
    raise exception 'authentication_required' using errcode='42501';
  end if;

  select * into v_job
  from public.cinematic_jobs
  where id=p_job_id
  for update;

  if not found or v_job.requested_by<>v_user
    or not private.is_campaign_member(v_job.campaign_id) then
    raise exception 'cinematic_job_access_denied' using errcode='42501';
  end if;
  if v_job.status<>'FAILED' then
    raise exception 'cinematic_job_not_failed' using errcode='22023';
  end if;
  if v_job.retry_count>=1 then
    raise sqlstate 'PGRST' using
      message='{"code":"cinematic_retry_used","message":"This scene has already used its retry."}',
      detail='{"status":429,"status_text":"Too Many Requests"}';
  end if;

  update public.cinematic_jobs set
    status='RESERVED',
    progress=0,
    operation=null,
    output_url=null,
    media_type=null,
    error_code=null,
    completed_at=null,
    retry_count=retry_count+1,
    updated_at=now()
  where id=p_job_id
  returning * into v_job;
  return v_job;
end $function$;

revoke all on function public.retry_cinematic_job(uuid) from public,anon;
grant execute on function public.retry_cinematic_job(uuid) to authenticated,service_role;
