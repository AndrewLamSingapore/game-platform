import {createCinematicController} from './src/cinematic-client.js';
const stage=document.querySelector('#cinematicStage'),video=document.querySelector('#cinematicVideo'),placeholder=document.querySelector('#cinematicPlaceholder'),statusText=document.querySelector('#cinematicStatus'),progress=document.querySelector('#cinematicProgress'),generate=document.querySelector('#generateCinematic'),replay=document.querySelector('#replayCinematic');
const pivotal=detail=>detail.sourceTurn===0||detail.sourceTurn===1||detail.sourceTurn%4===0||/(reveals?|discovers?|betray|attack|escape|dies?|truth|final|hostile|collaps)/i.test(detail.lastNarrative||'');
let scene=null;
const controller=createCinematicController({
 request:async body=>{
  const token=await window.gameCinematicSession?.();
  if(!token)throw Error('Guest access is not ready. Please try again.');
  const response=await fetch('/api/cinematic',{method:'POST',signal:AbortSignal.timeout(28000),headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(body)});
  const data=await response.json();
  if(!response.ok)throw Error(data.message||'The cinematic is unavailable right now.');
  return data.job;
 },
 update:state=>{
  if(!stage||!scene)return;
  const busy=state.phase==='generating';
  stage.setAttribute('aria-busy',String(busy));generate.disabled=busy;
  generate.hidden=state.phase==='ready';replay.hidden=state.phase!=='ready';
  generate.textContent=state.phase==='waiting'?'Check cinematic':state.phase==='error'?'Try cinematic again':'Generate cinematic';
  statusText.textContent=state.message;
  progress.hidden=!busy;if(busy)progress.removeAttribute('value');
  if(state.url){video.src=state.url;video.hidden=false;placeholder.hidden=true;}
  else{video.pause();video.removeAttribute('src');video.hidden=true;placeholder.hidden=false;}
 }
});
function load(detail){
 const key=`${detail.campaignId}:${detail.sourceTurn}`;if(scene?.key===key)return;
 scene={...detail,key};stage.hidden=!pivotal(scene);controller.load(scene);
}
generate?.addEventListener('click',()=>controller.start());
replay?.addEventListener('click',()=>{video.currentTime=0;video.play().catch(()=>{statusText.textContent='Press play on the video to replay.';});});
video?.addEventListener('error',()=>{statusText.textContent='This video could not load. Your game can continue.';});
document.addEventListener('game:scene-ready',event=>load(event.detail));
// Stop polling and playback when leaving a campaign; no automatic paid generation.
document.querySelector('#back')?.addEventListener('click',()=>{scene=null;controller.load(null);video.pause();stage.hidden=true;});
