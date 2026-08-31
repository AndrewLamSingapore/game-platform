const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
const stage=document.querySelector('#cinematicStage'),vignette=document.querySelector('#cinematicVignette'),placeholder=document.querySelector('#cinematicPlaceholder'),statusText=document.querySelector('#cinematicStatus'),progress=document.querySelector('#cinematicProgress'),generate=document.querySelector('#generateCinematic'),replay=document.querySelector('#replayCinematic'),locationText=document.querySelector('#cinematicLocation'),momentText=document.querySelector('#cinematicMoment'),turnText=document.querySelector('#cinematicTurn');
let scene=null,runTimer=null,progressTimer=null;
const pivotal=detail=>detail.sourceTurn===0||detail.sourceTurn===1||detail.sourceTurn%4===0||/(reveals?|discovers?|betray|attack|escape|dies?|truth|final|cannot be restored|changes course|hostile|collaps)/i.test(detail.lastNarrative||'');
const clean=(value,max=220)=>String(value??'').replace(/\s+/g,' ').trim().slice(0,max);
const memoryKey=detail=>`gp-cinematic:${detail.campaignId}:${detail.sourceTurn}`;
function setBusy(value){stage?.setAttribute('aria-busy',String(value));if(generate)generate.disabled=value}
function prepare(detail){
  const world=detail.worldState||{};
  locationText.textContent=clean(world.location||world.genre||'A world at the turning point',100);
  momentText.textContent=clean(detail.lastNarrative||world.opening_label||world.premise||'The world remembers what happens next.',220);
  turnText.textContent=`TURN ${Math.max(0,Number(detail.sourceTurn)||0)} · LIVING SCENE`;
}
function showReady(){
  prepare(scene);placeholder.hidden=true;vignette.hidden=false;generate.hidden=true;replay.hidden=false;progress.hidden=true;statusText.textContent='Living cinematic ready';setBusy(false);
}
function render(){
  if(!stage||!scene)return;const eligible=pivotal(scene),ready=localStorage.getItem(memoryKey(scene))==='1';
  stage.hidden=!eligible&&!ready;if(stage.hidden)return;prepare(scene);
  if(ready)return showReady();
  vignette.hidden=true;placeholder.hidden=false;generate.hidden=false;replay.hidden=true;progress.hidden=true;statusText.textContent='Pivotal moment detected';setBusy(false);
}
function play(){
  if(!scene)return;clearTimeout(runTimer);clearInterval(progressTimer);prepare(scene);placeholder.hidden=true;vignette.hidden=false;generate.hidden=true;replay.hidden=true;progress.hidden=reduceMotion;progress.value=0;statusText.textContent='The world is remembering…';setBusy(true);
  vignette.classList.remove('is-playing');void vignette.offsetWidth;vignette.classList.add('is-playing');
  if(reduceMotion){localStorage.setItem(memoryKey(scene),'1');runTimer=setTimeout(showReady,900);return}
  const started=performance.now();progressTimer=setInterval(()=>{progress.value=Math.min(100,((performance.now()-started)/4000)*100)},80);
  runTimer=setTimeout(()=>{clearInterval(progressTimer);progress.value=100;localStorage.setItem(memoryKey(scene),'1');statusText.textContent='Living cinematic remembered';replay.hidden=false;progress.hidden=true;setBusy(false)},4000);
}
function load(detail){const key=`${detail.campaignId}:${detail.sourceTurn}`;if(scene?.key===key)return;scene={...detail,key};render()}
generate?.addEventListener('click',play);replay?.addEventListener('click',play);
document.addEventListener('game:scene-ready',event=>load(event.detail));
