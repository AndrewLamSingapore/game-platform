import{createClient}from'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
const db=createClient('https://vtrfgckzpjgtmqsnumur.supabase.co','sb_publishable_zsgA314WZue1tlu_Kt-SDQ_UopdKMNs');
const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
const stage=document.querySelector('#cinematicStage'),video=document.querySelector('#cinematicVideo'),placeholder=document.querySelector('#cinematicPlaceholder'),statusText=document.querySelector('#cinematicStatus'),progress=document.querySelector('#cinematicProgress'),generate=document.querySelector('#generateCinematic'),replay=document.querySelector('#replayCinematic'),sound=document.querySelector('#cinematicSound');
let scene=null,job=null,pollTimer=null,pollCount=0;
const pivotal=detail=>detail.sourceTurn===0||detail.sourceTurn===1||detail.sourceTurn%4===0||/(reveals?|discovers?|betray|attack|escape|dies?|truth|final|cannot be restored|changes course|hostile|collaps)/i.test(detail.lastNarrative||'');
const label={RESERVED:'Preparing the cinematic brief…',QUEUED:'Cinematic queued…',PROCESSING:'Rendering this pivotal moment…',READY:'AI cinematic ready',FAILED:'This cinematic could not be rendered.'};

function stopPolling(){clearTimeout(pollTimer);pollTimer=null;}
function setBusy(value){stage?.setAttribute('aria-busy',String(value));if(generate)generate.disabled=value;}
function render(){
  if(!stage||!scene)return;
  const eligible=pivotal(scene);
  stage.hidden=!eligible&&!job;
  if(stage.hidden)return;
  const state=job?.status||'AVAILABLE';
  statusText.textContent=job?label[state]||'Cinematic moment':'Pivotal moment detected';
  progress.value=job?.progress||0;
  progress.hidden=!job||['READY','FAILED'].includes(state);
  generate.hidden=Boolean(job);
  placeholder.hidden=state==='READY';
  video.hidden=state!=='READY';
  replay.hidden=state!=='READY';
  sound.hidden=state!=='READY';
  setBusy(['RESERVED','QUEUED','PROCESSING'].includes(state));
  if(state==='READY'&&job.output_url&&video.src!==job.output_url){video.src=job.output_url;video.muted=true;sound.textContent='Sound off';if(!reduceMotion)video.play().catch(()=>{});}
  if(state==='FAILED')placeholder.querySelector('p').textContent='The story continues in text. Another pivotal scene can become a cinematic later.';
}

async function token(){const{data}=await db.auth.getSession();return data.session?.access_token||'';}
async function call(action,payload={}){
  const accessToken=await token();if(!accessToken)throw new Error('Guest session unavailable.');
  const response=await fetch('/api/cinematic',{method:'POST',headers:{Authorization:`Bearer ${accessToken}`,'Content-Type':'application/json'},body:JSON.stringify({action,...payload})});
  const body=await response.json().catch(()=>({}));if(!response.ok)throw new Error(body.message||'Cinematic request failed.');return body;
}
async function findJob(){const{data}=await db.from('cinematic_jobs').select('id,campaign_id,source_turn,scene_key,status,progress,duration_seconds,model,output_url,media_type,error_code').eq('campaign_id',scene.campaignId).eq('source_turn',scene.sourceTurn).maybeSingle();return data||null;}
async function load(detail){
  const key=`${detail.campaignId}:${detail.sourceTurn}`;if(scene?.key===key)return;
  stopPolling();scene={...detail,key};job=await findJob().catch(()=>null);pollCount=0;render();if(job&&['RESERVED','QUEUED','PROCESSING'].includes(job.status))schedulePoll(1200);
}
async function begin(){
  if(!scene||job)return;setBusy(true);statusText.textContent='Creating the cinematic brief…';
  try{const result=await call('start',{campaign_id:scene.campaignId,source_turn:scene.sourceTurn});job=result.job;render();if(job&&['RESERVED','QUEUED','PROCESSING'].includes(job.status))schedulePoll(2500);}catch(error){statusText.textContent=error.message;setBusy(false);}
}
async function poll(){
  if(!job||document.hidden)return schedulePoll(5000);
  try{const result=await call('status',{job_id:job.id});job=result.job;pollCount+=1;render();if(job&&['RESERVED','QUEUED','PROCESSING'].includes(job.status)&&pollCount<100)schedulePoll(6000);}catch{pollCount+=1;if(pollCount<100)schedulePoll(9000);}
}
function schedulePoll(delay){stopPolling();pollTimer=setTimeout(poll,delay);}
generate?.addEventListener('click',begin);
replay?.addEventListener('click',()=>{video.currentTime=0;video.play().catch(()=>{});});
sound?.addEventListener('click',()=>{video.muted=!video.muted;sound.textContent=video.muted?'Sound off':'Sound on';sound.setAttribute('aria-pressed',String(!video.muted));});
document.addEventListener('game:scene-ready',event=>load(event.detail));
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&job&&['RESERVED','QUEUED','PROCESSING'].includes(job.status))schedulePoll(200);});
