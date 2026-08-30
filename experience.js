const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;

const style=document.createElement('style');
style.textContent=`
  #soundToggle{flex:0;display:inline-flex;align-items:center;gap:8px;background:#161a28;color:#f5f0ff;border:1px solid #635a8b;padding:9px 13px;box-shadow:0 0 24px #725cff18}
  #soundToggle[aria-pressed="true"]{border-color:#71e8ff;color:#bff6ff;box-shadow:0 0 28px #71e8ff2b}
  #soundToggle .sound-wave{display:inline-flex;align-items:center;gap:2px;height:13px}
  #soundToggle i{display:block;width:2px;height:4px;background:currentColor;border-radius:4px}
  #soundToggle[aria-pressed="true"] i{animation:soundbar .8s ease-in-out infinite alternate}
  #soundToggle[aria-pressed="true"] i:nth-child(2){animation-delay:-.35s}#soundToggle[aria-pressed="true"] i:nth-child(3){animation-delay:-.6s}
  #atmosphere{position:fixed;inset:0;z-index:-1;pointer-events:none;opacity:.65}
  .world-card{transform-style:preserve-3d;will-change:transform;--mx:50%;--my:50%}
  .world-card:after{background:radial-gradient(circle at var(--mx) var(--my),#ffffff1c,transparent 28%),linear-gradient(to top,#090b12 8%,#090b12a8 48%,transparent)}
  .world-card>div,.world-card>h2,.world-card>p,.world-card>span{transform:translateZ(14px)}
  .story-panel{position:relative;overflow:hidden}
  .story-panel:before{content:"";position:absolute;inset:-40%;pointer-events:none;background:conic-gradient(from 180deg,transparent,#8d73ff12,transparent 28%,#55e7ff0d,transparent 60%);animation:storyAura 18s linear infinite}
  .story-panel>*{position:relative}
  .turn.gm:last-of-type{animation:consequenceIn .85s cubic-bezier(.16,1,.3,1) both}
  .choice{position:relative;overflow:hidden}.choice:after{content:"";position:absolute;inset:0;translate:-105% 0;background:linear-gradient(100deg,transparent,#ffffff12,transparent);transition:translate .55s ease}.choice:hover:after{translate:105% 0}
  body[data-world="neon-midnight"]{--violet:#ff6df0;--cyan:#5ff4ff}body[data-world="last-expedition"]{--violet:#8ee7c0;--cyan:#c9fff0}body[data-world="ashen-gate"]{--violet:#ff9c69;--cyan:#ffd18a}
  @keyframes soundbar{to{height:13px}}@keyframes storyAura{to{rotate:360deg}}@keyframes consequenceIn{from{opacity:0;transform:translateY(18px);filter:blur(6px)}to{opacity:1;transform:none;filter:none}}
  @media(prefers-reduced-motion:reduce){.story-panel:before,#soundToggle i,.turn.gm:last-of-type{animation:none!important}.world-card{transform:none!important}}
  @media(max-width:680px){#soundToggle{padding:8px 10px}#soundToggle .label{display:none}}
`;
document.head.append(style);

const button=document.createElement('button');
button.id='soundToggle';button.className='secondary';button.type='button';button.setAttribute('aria-pressed','false');
button.setAttribute('aria-label','Turn cinematic soundtrack on');
button.innerHTML='<span class="sound-wave" aria-hidden="true"><i></i><i></i><i></i></span><span class="label">Soundtrack</span>';
document.querySelector('header')?.append(button);

let audio=null,master=null,timer=null,voices=[];
const stopMusic=()=>{clearInterval(timer);timer=null;voices.forEach(v=>{try{v.stop()}catch{}});voices=[];if(master)master.gain.setTargetAtTime(0,audio.currentTime,.18);button.setAttribute('aria-pressed','false');button.setAttribute('aria-label','Turn cinematic soundtrack on')};
const world=()=>document.body.dataset.world||'ashen-gate';
function tone(freq,start,duration,type='sine',volume=.025){
  const osc=audio.createOscillator(),gain=audio.createGain();osc.type=type;osc.frequency.setValueAtTime(freq,start);gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(volume,start+.08);gain.gain.exponentialRampToValueAtTime(.0001,start+duration);osc.connect(gain).connect(master);osc.start(start);osc.stop(start+duration+.05);voices.push(osc);osc.onended=()=>voices=voices.filter(v=>v!==osc);
}
function phrase(){
  const now=audio.currentTime+.04,w=world();
  if(w==='neon-midnight'){
    [110,165,220,330].forEach((f,i)=>tone(f,now+i*.42,.5,i%2?'triangle':'sine',.018));tone(55,now,2.1,'sawtooth',.012);
  }else if(w==='last-expedition'){
    [146.83,220,293.66,440].forEach((f,i)=>tone(f,now+i*.7,2.5,'sine',.018-i*.002));
  }else{
    tone(73.42,now,3.6,'sine',.028);tone(110,now+.8,2.8,'triangle',.016);tone(293.66,now+2.2,1.8,'sine',.012);
  }
}
async function startMusic(){
  if(!audio){audio=new AudioContext();master=audio.createGain();const filter=audio.createBiquadFilter();filter.type='lowpass';filter.frequency.value=1800;master.connect(filter).connect(audio.destination)}
  await audio.resume();master.gain.cancelScheduledValues(audio.currentTime);master.gain.setTargetAtTime(.82,audio.currentTime,.35);button.setAttribute('aria-pressed','true');button.setAttribute('aria-label','Turn cinematic soundtrack off');phrase();timer=setInterval(phrase,world()==='neon-midnight'?3200:5600);
}
button.addEventListener('click',()=>button.getAttribute('aria-pressed')==='true'?stopMusic():startMusic());

function identifyWorld(){
  const title=document.querySelector('#campaignTitle')?.textContent||'';
  document.body.dataset.world=title.includes('Neon')?'neon-midnight':title.includes('Expedition')?'last-expedition':title.includes('Ashen')?'ashen-gate':'';
}
new MutationObserver(identifyWorld).observe(document.querySelector('#campaignTitle'),{childList:true,subtree:true});identifyWorld();

document.querySelectorAll('.world-card').forEach(card=>{
  if(reduceMotion)return;
  card.addEventListener('pointermove',e=>{const r=card.getBoundingClientRect(),x=(e.clientX-r.left)/r.width,y=(e.clientY-r.top)/r.height;card.style.setProperty('--mx',`${x*100}%`);card.style.setProperty('--my',`${y*100}%`);card.style.transform=`perspective(850px) rotateX(${(0.5-y)*5}deg) rotateY(${(x-.5)*7}deg) translateY(-3px)`});
  card.addEventListener('pointerleave',()=>card.style.transform='');
});

if(!reduceMotion){
  const canvas=document.createElement('canvas');canvas.id='atmosphere';document.body.prepend(canvas);const ctx=canvas.getContext('2d');let motes=[];
  function resize(){const d=Math.min(devicePixelRatio,2);canvas.width=innerWidth*d;canvas.height=innerHeight*d;canvas.style.width=`${innerWidth}px`;canvas.style.height=`${innerHeight}px`;ctx.setTransform(d,0,0,d,0,0);motes=Array.from({length:Math.min(85,Math.floor(innerWidth/16))},()=>({x:Math.random()*innerWidth,y:Math.random()*innerHeight,r:Math.random()*1.7+.3,v:Math.random()*.16+.04,a:Math.random()*.45+.08}))}
  function draw(){ctx.clearRect(0,0,innerWidth,innerHeight);const palette=world()==='neon-midnight'?'113,232,255':world()==='last-expedition'?'142,231,192':'255,178,111';for(const p of motes){p.y-=p.v;if(p.y<0){p.y=innerHeight;p.x=Math.random()*innerWidth}ctx.beginPath();ctx.fillStyle=`rgba(${palette},${p.a})`;ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill()}requestAnimationFrame(draw)}
  addEventListener('resize',resize,{passive:true});resize();draw();
}
