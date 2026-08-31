const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
const stage=document.querySelector('#cinematicStage'),vignette=document.querySelector('#cinematicVignette'),placeholder=document.querySelector('#cinematicPlaceholder'),statusText=document.querySelector('#cinematicStatus'),progress=document.querySelector('#cinematicProgress'),generate=document.querySelector('#generateCinematic'),replay=document.querySelector('#replayCinematic');
let scene=null,runTimer=null,progressTimer=null,directAnimations=[];const playedThisPage=new Set();
const pivotal=detail=>detail.sourceTurn===0||detail.sourceTurn===1||detail.sourceTurn%4===0||/(reveals?|discovers?|betray|attack|escape|dies?|truth|final|cannot be restored|changes course|hostile|collaps)/i.test(detail.lastNarrative||'');
const clean=(value,max=220)=>String(value??'').replace(/\s+/g,' ').trim().slice(0,max);
const memoryKey=detail=>`gp-cinematic:${detail.campaignId}:${detail.sourceTurn}`;
const remembered=detail=>{try{return localStorage.getItem(memoryKey(detail))==='1'}catch{return false}};
const remember=detail=>{try{localStorage.setItem(memoryKey(detail),'1')}catch{}};
function setBusy(value){stage?.setAttribute('aria-busy',String(value));if(generate)generate.disabled=value}
function prepare(detail){
  const world=detail.worldState||{},cards=[...document.querySelectorAll('#peoplePresent .presence-card')].slice(0,4),portraits=document.querySelector('#cinematicPortraits');
  const description=clean(detail.lastNarrative||world.opening_label||world.premise||'A pivotal moment changes the world.',260);
  vignette.setAttribute('aria-label',`Visual cinematic. ${clean(world.location||world.genre||'The world',100)}. ${description}`);
  if(portraits){portraits.replaceChildren(...cards.map((card,index)=>{const portrait=document.createElement('span'),avatar=card.querySelector('.presence-avatar'),initials=avatar?.querySelector('.presence-initials')?.textContent||'?',hue=card.style.getPropertyValue('--person-hue')||String(40+index*74),image=avatar?.style.getPropertyValue('--portrait-image'),x=avatar?.style.getPropertyValue('--portrait-x'),y=avatar?.style.getPropertyValue('--portrait-y');portrait.style.setProperty('--portrait-hue',hue);portrait.textContent=initials;if(image){portrait.classList.add('has-portrait');portrait.style.setProperty('--portrait-image',image);portrait.style.setProperty('--portrait-x',x||'50%');portrait.style.setProperty('--portrait-y',y||'38%')}return portrait}));if(!portraits.children.length){const art=getComputedStyle(document.body).getPropertyValue('--world-art');['THE','WORLD','REMEMBERS'].forEach((label,index)=>{const portrait=document.createElement('span');portrait.textContent=label;portrait.style.setProperty('--portrait-hue',String(42+index*100));if(art){portrait.classList.add('has-portrait');portrait.style.setProperty('--portrait-image',art);portrait.style.setProperty('--portrait-x',`${18+index*32}%`)}portraits.append(portrait)})}}
}
function cancelAnimations(){directAnimations.forEach(animation=>{try{animation.cancel()}catch{}});directAnimations=[]}
function animate(el,frames,options){if(!el)return;const animation=el.animate(frames,options);directAnimations.push(animation)}
function animateSequence(duration){
  cancelAnimations();const shots=[...vignette.querySelectorAll('.cinematic-shot')],arts=[...vignette.querySelectorAll('.shot-art')],grain=vignette.querySelector('.cinematic-grain');
  if(reduceMotion){shots.forEach((shot,index)=>animate(shot,[{opacity:0},{opacity:1,offset:.2},{opacity:1,offset:.78},{opacity:index===2?1:0}],{duration,delay:index*700,fill:'both',easing:'ease-out'}));return}
  animate(shots[0],[{opacity:0},{opacity:1,offset:.06},{opacity:1,offset:.28},{opacity:0,offset:.38},{opacity:0}],{duration,fill:'both'});
  animate(shots[1],[{opacity:0},{opacity:0,offset:.27},{opacity:1,offset:.36},{opacity:1,offset:.65},{opacity:0,offset:.74},{opacity:0}],{duration,fill:'both'});
  animate(shots[2],[{opacity:0},{opacity:0,offset:.65},{opacity:1,offset:.76},{opacity:1}],{duration,fill:'both'});
  animate(arts[0],[{transform:'scale(1.22) translate(-3%,2%)'},{transform:'scale(1.05) translate(1%,-1%)'}],{duration:duration*.38,fill:'both',easing:'cubic-bezier(.16,.78,.2,1)'});
  animate(arts[1],[{transform:'scale(1.04) translate(2%,-1%)'},{transform:'scale(1.2) translate(-2%,1%)'}],{duration:duration*.48,delay:duration*.27,fill:'both',easing:'cubic-bezier(.2,.7,.25,1)'});
  animate(shots[0].querySelector('.shot-prism'),[{opacity:0,transform:'translateX(-70%) skewX(-18deg)'},{opacity:.72,transform:'translateX(10%) skewX(-18deg)',offset:.5},{opacity:0,transform:'translateX(80%) skewX(-18deg)'}],{duration:duration*.38,fill:'both'});
  animate(shots[1].querySelector('.shot-impact'),[{opacity:0,transform:'scale(.08)'},{opacity:.88,transform:'scale(1.05)',offset:.42},{opacity:0,transform:'scale(1.7)'}],{duration:duration*.47,delay:duration*.27,fill:'both',easing:'cubic-bezier(.2,.75,.2,1)'});
  [...shots[2].querySelectorAll('.cinematic-portraits span')].forEach((portrait,index)=>animate(portrait,[{opacity:0,transform:'translateY(38px) scale(.72)'},{opacity:1,transform:'translateY(0) scale(1)',offset:.62},{opacity:.9,transform:'translateY(-4px) scale(1.04)'}],{duration:duration*.3,delay:duration*(.68+index*.035),fill:'both',easing:'cubic-bezier(.16,.8,.22,1)'}));
  animate(shots[2].querySelector('.shot-sigil'),[{opacity:0,transform:'scale(.2) rotate(-90deg)'},{opacity:.8,transform:'scale(1.3) rotate(20deg)',offset:.55},{opacity:.32,transform:'scale(1) rotate(0)'}],{duration:duration*.34,delay:duration*.66,fill:'both'});
  animate(grain,[{transform:'translate(0,0)'},{transform:'translate(-3%,2%)'},{transform:'translate(2%,-3%)'},{transform:'translate(-1%,1%)'}],{duration:420,iterations:Infinity});
  animate(vignette,[{filter:'brightness(.08)'},{filter:'brightness(1.28)',offset:.07},{filter:'brightness(.92)',offset:.34},{filter:'brightness(1.2)',offset:.39},{filter:'brightness(.9)',offset:.7},{filter:'brightness(.72)'}],{duration,fill:'both'});
}
function showReady(){prepare(scene);placeholder.hidden=true;vignette.hidden=false;generate.hidden=true;replay.hidden=false;progress.hidden=true;statusText.textContent='Living cinematic ready';setBusy(false)}
function render(){if(!stage||!scene)return;const eligible=pivotal(scene),ready=remembered(scene);stage.hidden=!eligible&&!ready;if(stage.hidden)return;prepare(scene);if(ready){showReady();if(!playedThisPage.has(scene.key)){playedThisPage.add(scene.key);setTimeout(play,180)}return}vignette.hidden=true;placeholder.hidden=false;generate.hidden=false;replay.hidden=true;progress.hidden=true;statusText.textContent='Pivotal moment detected';setBusy(false)}
function play(){
  if(!scene)return;playedThisPage.add(scene.key);clearTimeout(runTimer);clearInterval(progressTimer);prepare(scene);placeholder.hidden=true;vignette.hidden=false;generate.hidden=true;replay.hidden=true;progress.hidden=false;progress.value=0;const duration=reduceMotion?2800:7600;statusText.textContent=reduceMotion?'Reduced-motion cinematic playing…':'Living cinematic playing…';setBusy(true);vignette.classList.remove('is-playing');void vignette.offsetWidth;vignette.classList.add('is-playing');animateSequence(duration);
  const started=performance.now();progressTimer=setInterval(()=>{progress.value=Math.min(100,((performance.now()-started)/duration)*100)},80);
  runTimer=setTimeout(()=>{clearInterval(progressTimer);progress.value=100;statusText.textContent='Living cinematic remembered';replay.hidden=false;progress.hidden=true;setBusy(false);remember(scene)},duration+100);
}
function load(detail){const key=`${detail.campaignId}:${detail.sourceTurn}`;if(scene?.key===key)return;scene={...detail,key};render()}
generate?.addEventListener('click',play);replay?.addEventListener('click',play);document.addEventListener('game:scene-ready',event=>load(event.detail));
