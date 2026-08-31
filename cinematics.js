const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
const stage=document.querySelector('#cinematicStage'),vignette=document.querySelector('#cinematicVignette'),placeholder=document.querySelector('#cinematicPlaceholder'),statusText=document.querySelector('#cinematicStatus'),progress=document.querySelector('#cinematicProgress'),generate=document.querySelector('#generateCinematic'),replay=document.querySelector('#replayCinematic'),locationText=document.querySelector('#cinematicLocation'),momentText=document.querySelector('#cinematicMoment'),turnText=document.querySelector('#cinematicTurn');
let scene=null,runTimer=null,progressTimer=null;const playedThisPage=new Set();
const pivotal=detail=>detail.sourceTurn===0||detail.sourceTurn===1||detail.sourceTurn%4===0||/(reveals?|discovers?|betray|attack|escape|dies?|truth|final|cannot be restored|changes course|hostile|collaps)/i.test(detail.lastNarrative||'');
const clean=(value,max=220)=>String(value??'').replace(/\s+/g,' ').trim().slice(0,max);
const memoryKey=detail=>`gp-cinematic:${detail.campaignId}:${detail.sourceTurn}`;
const remembered=detail=>{try{return localStorage.getItem(memoryKey(detail))==='1'}catch{return false}};
const remember=detail=>{try{localStorage.setItem(memoryKey(detail),'1')}catch{}};
let directAnimations=[];
function animateDirect(duration){directAnimations.forEach(item=>item.cancel());directAnimations=[];const art=vignette.querySelector('.vignette-art'),light=vignette.querySelector('.vignette-light'),copy=vignette.querySelector('.vignette-copy');if(reduceMotion){directAnimations.push(vignette.animate([{opacity:.45},{opacity:1}],{duration,fill:'both',easing:'ease-out'}),copy.animate([{opacity:0},{opacity:1}],{duration,fill:'both'}));return}directAnimations.push(art.animate([{transform:'scale(1.18) translate(-2%,1%)'},{transform:'scale(1.04) translate(.5%,-.5%)'}],{duration,fill:'both',easing:'cubic-bezier(.18,.76,.24,1)'}),light.animate([{opacity:0},{opacity:.72,offset:.28},{opacity:.18}],{duration,fill:'both'}),copy.animate([{opacity:0,transform:'translateY(24px)'},{opacity:1,transform:'none',offset:.32},{opacity:.72,transform:'translateY(-5px)'}],{duration,fill:'both',easing:'ease-out'}),vignette.animate([{filter:'brightness(.18)'},{filter:'brightness(1.25)',offset:.14},{filter:'brightness(1)',offset:.78},{filter:'brightness(.72)'}],{duration,fill:'both'}))}
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
  if(!stage||!scene)return;const eligible=pivotal(scene),ready=remembered(scene);
  stage.hidden=!eligible&&!ready;if(stage.hidden)return;prepare(scene);
  if(ready){showReady();if(!playedThisPage.has(scene.key)){playedThisPage.add(scene.key);setTimeout(play,180)}return}
  vignette.hidden=true;placeholder.hidden=false;generate.hidden=false;replay.hidden=true;progress.hidden=true;statusText.textContent='Pivotal moment detected';setBusy(false);
}
function play(){
  if(!scene)return;playedThisPage.add(scene.key);clearTimeout(runTimer);clearInterval(progressTimer);prepare(scene);placeholder.hidden=true;vignette.hidden=false;generate.hidden=true;replay.hidden=true;progress.hidden=false;progress.value=0;const duration=reduceMotion?1400:4000;statusText.textContent=reduceMotion?'Reduced-motion cinematic playing…':'The world is remembering…';setBusy(true);
  vignette.classList.remove('is-playing');void vignette.offsetWidth;vignette.classList.add('is-playing');animateDirect(duration);
  const started=performance.now();progressTimer=setInterval(()=>{progress.value=Math.min(100,((performance.now()-started)/duration)*100)},80);
  runTimer=setTimeout(()=>{clearInterval(progressTimer);progress.value=100;statusText.textContent='Living cinematic remembered';replay.hidden=false;progress.hidden=true;setBusy(false);remember(scene)},duration+80);
}
function load(detail){const key=`${detail.campaignId}:${detail.sourceTurn}`;if(scene?.key===key)return;scene={...detail,key};render()}
generate?.addEventListener('click',play);replay?.addEventListener('click',play);
document.addEventListener('game:scene-ready',event=>load(event.detail));
