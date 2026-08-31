import {createHash} from 'node:crypto';
import {gateway,experimental_startVideo as startVideo,experimental_getVideoStatus as getVideoStatus} from 'ai';

const SUPABASE_URL='https://vtrfgckzpjgtmqsnumur.supabase.co';
const SUPABASE_KEY='sb_publishable_zsgA314WZue1tlu_Kt-SDQ_UopdKMNs';
const MODEL=process.env.CINEMATIC_VIDEO_MODEL||'google/veo-3.1-lite-generate-preview';
const clean=(value,max=800)=>String(value??'').replace(/\s+/g,' ').trim().slice(0,max);
const dbHeaders=auth=>({apikey:SUPABASE_KEY,Authorization:auth,'Content-Type':'application/json',Accept:'application/json'});
const one=value=>Array.isArray(value)?value[0]:value;

async function supabase(path,auth,options={}){
  const response=await fetch(`${SUPABASE_URL}${path}`,{...options,headers:{...dbHeaders(auth),...(options.headers||{})}});
  const body=await response.json().catch(()=>({}));
  if(!response.ok){const error=new Error(clean(body?.message||body?.error||'database_request_failed',240));error.status=response.status;error.code=body?.code;throw error;}
  return body;
}

async function authenticate(auth){
  if(!auth.startsWith('Bearer ')){const error=new Error('unauthorized');error.status=401;throw error;}
  return supabase('/auth/v1/user',auth);
}

async function campaignContext(campaignId,auth,userId){
  const id=encodeURIComponent(campaignId);
  const [members,campaigns,turns,npcs,quests]=await Promise.all([
    supabase(`/rest/v1/campaign_members?campaign_id=eq.${id}&user_id=eq.${encodeURIComponent(userId)}&status=eq.ACTIVE&select=role&limit=1`,auth),
    supabase(`/rest/v1/campaigns?id=eq.${id}&select=id,title,world_state&limit=1`,auth),
    supabase(`/rest/v1/game_turns?campaign_id=eq.${id}&speaker=eq.GM&select=turn_no,content&order=turn_no.desc&limit=1`,auth),
    supabase(`/rest/v1/campaign_entities?campaign_id=eq.${id}&kind=eq.NPC&select=name,state&limit=4`,auth),
    supabase(`/rest/v1/campaign_quests?campaign_id=eq.${id}&status=eq.OPEN&select=title,objective&limit=2`,auth)
  ]);
  const role=members?.[0]?.role;
  if(!['OWNER','GM','PLAYER'].includes(role)){const error=new Error('campaign_access_denied');error.status=403;throw error;}
  const campaign=campaigns?.[0];
  if(!campaign){const error=new Error('campaign_not_found');error.status=404;throw error;}
  return{campaign,lastTurn:turns?.[0]||null,npcs:npcs||[],quests:quests||[]};
}

function makePrompt({campaign,lastTurn,npcs,quests}){
  const state=campaign.world_state||{};
  const consequence=clean(lastTurn?.content||state.opening_label||state.premise||'The world opens on a consequential choice.',620);
  const characters=npcs.map(n=>`${clean(n.name,60)} (${clean(n.state?.archetype||'watchful character',80)})`).join(', ');
  const objectives=quests.map(q=>`${clean(q.title,80)}: ${clean(q.objective?.text,120)}`).join('; ');
  return clean(`Create a four-second cinematic establishing shot for an original fictional role-playing game. World: ${clean(campaign.title,120)}. Genre: ${clean(state.genre,120)}. Location: ${clean(state.location,160)}. Current consequence: ${consequence}. ${characters?`Characters in the world: ${characters}.`:''} ${objectives?`Active objective: ${objectives}.`:''} One coherent action, strong environmental motion, cinematic lighting, restrained camera movement, readable silhouettes, no dialogue, no captions, no logos, no interface, no real people, no copyrighted characters.`,1500);
}

async function rpc(name,args,auth){return supabase(`/rest/v1/rpc/${name}`,auth,{method:'POST',body:JSON.stringify(args)});}
const publicJob=job=>job?{id:job.id,campaign_id:job.campaign_id,source_turn:job.source_turn,scene_key:job.scene_key,status:job.status,progress:job.progress,duration_seconds:job.duration_seconds,model:job.model,output_url:job.status==='READY'?job.output_url:null,media_type:job.status==='READY'?job.media_type:null,error_code:job.status==='FAILED'?job.error_code:null}:null;
const errorCode=error=>error?.statusCode===402||error?.status===402?'budget_limit':error?.statusCode===429||error?.status===429?'rate_limited':error?.statusCode===401||error?.status===401?'gateway_auth_unavailable':'generation_failed';

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST')return res.status(405).json({error:'method_not_allowed'});
  const auth=req.headers.authorization||'';
  try{
    const user=await authenticate(auth);
    const body=typeof req.body==='string'?JSON.parse(req.body):req.body||{};
    const action=clean(body.action,20);
    if(action==='start'){
      const campaignId=clean(body.campaign_id,80);
      if(!/^[0-9a-f-]{36}$/i.test(campaignId))return res.status(400).json({error:'invalid_campaign_id'});
      const context=await campaignContext(campaignId,auth,user.id);
      const sourceTurn=Math.max(0,Number(context.lastTurn?.turn_no)||0);
      if(Number(body.source_turn)!==sourceTurn)return res.status(409).json({error:'scene_advanced',source_turn:sourceTurn});
      const prompt=makePrompt(context);
      const fingerprint=createHash('sha256').update(prompt).digest('hex');
      const starter=clean(context.campaign.world_state?.starter_id||'custom',80).replace(/[^a-z0-9-]/gi,'-').toLowerCase();
      const reserved=await rpc('reserve_cinematic_job',{p_campaign_id:campaignId,p_source_turn:sourceTurn,p_scene_key:`${starter}:turn-${sourceTurn}`,p_prompt_fingerprint:fingerprint},auth);
      let reservedJob=reserved?.job;
      if(!reserved?.created&&reservedJob?.status==='FAILED'){
        reservedJob=one(await rpc('retry_cinematic_job',{p_job_id:reservedJob.id},auth));
      }else if(!reserved?.created){
        return res.status(200).json({job:publicJob(reservedJob),cached:true});
      }
      try{
        const started=await startVideo({model:gateway.video(MODEL),prompt,duration:4,aspectRatio:'16:9',generateAudio:false,maxRetries:1,providerOptions:{gateway:{user:user.id,tags:['feature:selective-cinematic','product:game-platform']}}});
        const queued=one(await rpc('transition_cinematic_job',{p_job_id:reservedJob.id,p_status:'QUEUED',p_operation:started.operation},auth));
        return res.status(202).json({job:publicJob(queued),cached:false});
      }catch(error){
        await rpc('transition_cinematic_job',{p_job_id:reservedJob.id,p_status:'FAILED',p_error_code:errorCode(error)},auth).catch(()=>{});
        throw error;
      }
    }
    if(action==='status'){
      const jobId=clean(body.job_id,80);
      if(!/^[0-9a-f-]{36}$/i.test(jobId))return res.status(400).json({error:'invalid_job_id'});
      const jobs=await supabase(`/rest/v1/cinematic_jobs?id=eq.${encodeURIComponent(jobId)}&select=*&limit=1`,auth);
      let job=jobs?.[0];
      if(!job)return res.status(404).json({error:'cinematic_job_not_found'});
      if(['READY','FAILED'].includes(job.status))return res.status(200).json({job:publicJob(job),cached:true});
      if(!job.operation)return res.status(200).json({job:publicJob(job)});
      const result=await getVideoStatus(gateway.video(job.model||MODEL),{operation:job.operation,maxRetries:1});
      if(result.status==='pending'){
        job=one(await rpc('transition_cinematic_job',{p_job_id:job.id,p_status:'PROCESSING'},auth));
        return res.status(200).json({job:publicJob(job)});
      }
      if(result.status==='error'){
        job=one(await rpc('transition_cinematic_job',{p_job_id:job.id,p_status:'FAILED',p_error_code:'provider_failed'},auth));
        return res.status(200).json({job:publicJob(job)});
      }
      const generated=result.videos?.find(item=>item?.type==='url'&&/^https:\/\//i.test(item.url));
      if(!generated){job=one(await rpc('transition_cinematic_job',{p_job_id:job.id,p_status:'FAILED',p_error_code:'unsupported_video_result'},auth));return res.status(200).json({job:publicJob(job)});}
      job=one(await rpc('transition_cinematic_job',{p_job_id:job.id,p_status:'READY',p_output_url:generated.url,p_media_type:generated.mediaType||'video/mp4'},auth));
      return res.status(200).json({job:publicJob(job)});
    }
    return res.status(400).json({error:'unsupported_action'});
  }catch(error){
    const status=Number(error?.status||error?.statusCode)||500;
    return res.status(status>=400&&status<600?status:500).json({error:errorCode(error),message:status===429?'Cinematic limit reached. Try again tomorrow.':'The cinematic could not be prepared right now.'});
  }
}
