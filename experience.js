const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer=matchMedia('(hover: hover) and (pointer: fine)').matches;

const worlds={
  'ashen-gate':{
    name:'The Ashen Gate',
    genre:'Dark fantasy · 6–10 hours',
    art:'/assets/worlds/ashen-gate.webp',
    accent:'#ff9b61',
    premise:'The final gate is closing. Someone outside knows your name—and carries proof that the city was built on a lie.',
    danger:'Ash plague moves through the refugees while the gate mechanism begins its final cycle. Every person admitted changes who will survive inside.',
    atmosphere:'Ash falls beyond the wall',
    characters:[
      ['Captain Ilyan Rook','Severe commander buying time for an evacuation'],
      ['Sable Vey','Your returned sister, carrying forbidden proof'],
      ['Archivist Meret','Keeper of the names erased from history']
    ]
  },
  'neon-midnight':{
    name:'Neon After Midnight',
    genre:'Noir science-fiction · 6–10 hours',
    art:'/assets/worlds/neon-after-midnight.webp',
    accent:'#5ff4ff',
    premise:'A train arrives seven years late. Every passenger remembers a future that has not happened—including yours.',
    danger:'Vanta Security is sealing Platform Nine. The passengers will be erased unless you establish that their memories—and their personhood—are real.',
    atmosphere:'Rain strikes Platform Nine',
    characters:[
      ['Inspector Orin Kade','Controlled pursuer whose daughter is on the train'],
      ['Nia-7','Synthetic passenger carrying seven lost memories'],
      ['Roan Mercer','A man who remembers becoming an assassin']
    ]
  },
  'last-expedition':{
    name:'The Last Expedition',
    genre:'Lost-world exploration · 6–10 hours',
    art:'/assets/worlds/last-expedition.webp',
    accent:'#63e2c6',
    premise:'Your missing expedition broadcasts one final message from beneath an ocean that should not exist.',
    danger:'Containment charges are counting down while something beneath the drowned observatory reconstructs the missing explorers from memory.',
    atmosphere:'The deep answers in your voice',
    characters:[
      ['Commander Voss','Containment leader guarding your erased order'],
      ['Tala Quill','Field biologist who may be an ocean-made copy'],
      ['Ren Sol Echo','A second version of you who wants Earth forgotten']
    ]
  }
};

const soundButton=document.createElement('button');
soundButton.id='soundToggle';
soundButton.className='secondary';
soundButton.type='button';
soundButton.setAttribute('aria-pressed','false');
soundButton.setAttribute('aria-label','Turn cinematic soundscape on');
soundButton.innerHTML='<span class="sound-wave" aria-hidden="true"><i></i><i></i><i></i></span><span class="label">Soundscape</span>';
document.querySelector('body > header')?.append(soundButton);

const style=document.createElement('style');
style.textContent=`
  #soundToggle{flex:0;display:inline-flex;align-items:center;gap:8px;background:#161a28;color:#f5f0ff;border:1px solid #635a8b;padding:9px 13px;box-shadow:0 0 24px #725cff18}
  #soundToggle[aria-pressed="true"]{border-color:var(--world-accent-2,#71e8ff);color:var(--world-accent-2,#bff6ff);box-shadow:0 0 28px var(--world-glow,#71e8ff2b)}
  #soundToggle .sound-wave{display:inline-flex;align-items:center;gap:2px;height:13px}
  #soundToggle i{display:block;width:2px;height:4px;background:currentColor;border-radius:4px}
  #soundToggle[aria-pressed="true"] i{animation:soundbar .8s ease-in-out infinite alternate}
  #soundToggle[aria-pressed="true"] i:nth-child(2){animation-delay:-.35s}
  #soundToggle[aria-pressed="true"] i:nth-child(3){animation-delay:-.6s}
  #atmosphere{position:fixed;inset:0;z-index:-1;pointer-events:none;opacity:.68}
  .world-card>div,.world-card>h2,.world-card>p,.world-card>span{transform:translateZ(14px)}
  @keyframes soundbar{to{height:13px}}
  @media(prefers-reduced-motion:reduce){#soundToggle i{animation:none!important}.world-card{transform:none!important}}
  @media(max-width:680px){#soundToggle{padding:8px 10px}#soundToggle .label{display:none}}
`;
document.head.append(style);

const currentWorld=()=>document.body.dataset.world||'ashen-gate';
let audio=null;
let master=null;
let musicTimer=null;
let ambientNodes=[];
let voices=[];

function tone(freq,start,duration,type='sine',volume=.018,target=master){
  if(!audio||!target)return;
  const oscillator=audio.createOscillator();
  const gain=audio.createGain();
  oscillator.type=type;
  oscillator.frequency.setValueAtTime(freq,start);
  gain.gain.setValueAtTime(.0001,start);
  gain.gain.exponentialRampToValueAtTime(volume,start+.08);
  gain.gain.exponentialRampToValueAtTime(.0001,start+duration);
  oscillator.connect(gain).connect(target);
  oscillator.start(start);
  oscillator.stop(start+duration+.05);
  voices.push(oscillator);
  oscillator.onended=()=>voices=voices.filter(item=>item!==oscillator);
}

function noiseSource(filterType,frequency,volume){
  const frames=audio.sampleRate*2;
  const buffer=audio.createBuffer(1,frames,audio.sampleRate);
  const samples=buffer.getChannelData(0);
  for(let index=0;index<frames;index+=1)samples[index]=Math.random()*2-1;
  const source=audio.createBufferSource();
  const filter=audio.createBiquadFilter();
  const gain=audio.createGain();
  source.buffer=buffer;
  source.loop=true;
  filter.type=filterType;
  filter.frequency.value=frequency;
  filter.Q.value=.45;
  gain.gain.value=volume;
  source.connect(filter).connect(gain).connect(master);
  source.start();
  ambientNodes.push(source,filter,gain);
}

function drone(frequency,volume,type='sine',movement=.08){
  const oscillator=audio.createOscillator();
  const gain=audio.createGain();
  const lfo=audio.createOscillator();
  const lfoGain=audio.createGain();
  oscillator.type=type;
  oscillator.frequency.value=frequency;
  gain.gain.value=volume;
  lfo.frequency.value=movement;
  lfoGain.gain.value=frequency*.035;
  lfo.connect(lfoGain).connect(oscillator.frequency);
  oscillator.connect(gain).connect(master);
  oscillator.start();
  lfo.start();
  ambientNodes.push(oscillator,gain,lfo,lfoGain);
}

function clearAmbient(){
  ambientNodes.forEach(node=>{try{if(typeof node.stop==='function')node.stop()}catch{}try{node.disconnect()}catch{}});
  ambientNodes=[];
}

function rebuildAmbient(){
  if(!audio||soundButton.getAttribute('aria-pressed')!=='true')return;
  clearAmbient();
  const world=currentWorld();
  if(world==='neon-midnight'){
    noiseSource('highpass',2400,.009);
    drone(58,.012,'triangle',.11);
    drone(116,.004,'sine',.16);
  }else if(world==='last-expedition'){
    noiseSource('lowpass',420,.013);
    drone(43,.018,'sine',.055);
    drone(86,.006,'sine',.07);
  }else{
    noiseSource('bandpass',360,.014);
    drone(36.7,.019,'sine',.045);
    drone(73.4,.006,'triangle',.06);
  }
}

function phrase(){
  if(!audio)return;
  const now=audio.currentTime+.04;
  const world=currentWorld();
  if(world==='neon-midnight'){
    [110,165,220,330].forEach((frequency,index)=>tone(frequency,now+index*.42,.5,index%2?'triangle':'sine',.014));
  }else if(world==='last-expedition'){
    tone(659.25,now,.9,'sine',.014);
    tone(329.63,now+.12,1.8,'sine',.008);
  }else{
    tone(73.42,now,3.4,'sine',.022);
    tone(110,now+.8,2.6,'triangle',.012);
    tone(293.66,now+2.1,1.7,'sine',.009);
  }
}

function schedulePhrase(){
  clearInterval(musicTimer);
  phrase();
  musicTimer=setInterval(phrase,currentWorld()==='neon-midnight'?4200:currentWorld()==='last-expedition'?7200:6100);
}

async function startSound(){
  if(!audio){
    audio=new AudioContext();
    master=audio.createGain();
    const filter=audio.createBiquadFilter();
    filter.type='lowpass';
    filter.frequency.value=2200;
    master.connect(filter).connect(audio.destination);
  }
  await audio.resume();
  master.gain.cancelScheduledValues(audio.currentTime);
  master.gain.setTargetAtTime(.8,audio.currentTime,.35);
  soundButton.setAttribute('aria-pressed','true');
  soundButton.setAttribute('aria-label','Turn cinematic soundscape off');
  rebuildAmbient();
  schedulePhrase();
}

function stopSound(){
  clearInterval(musicTimer);
  musicTimer=null;
  clearAmbient();
  voices.forEach(voice=>{try{voice.stop()}catch{}});
  voices=[];
  if(master&&audio)master.gain.setTargetAtTime(0,audio.currentTime,.18);
  soundButton.setAttribute('aria-pressed','false');
  soundButton.setAttribute('aria-label','Turn cinematic soundscape on');
}

soundButton.addEventListener('click',()=>soundButton.getAttribute('aria-pressed')==='true'?stopSound():startSound());
document.addEventListener('visibilitychange',()=>{if(!audio)return;if(document.hidden)audio.suspend();else if(soundButton.getAttribute('aria-pressed')==='true')audio.resume()});

function parseWorldState(){
  try{return JSON.parse(document.querySelector('#world')?.textContent||'{}')}catch{return{}}
}

function worldFromPage(){
  const state=parseWorldState();
  if(worlds[state.starter_id])return state.starter_id;
  const title=document.querySelector('#campaignTitle')?.textContent||'';
  if(title.includes('Neon'))return'neon-midnight';
  if(title.includes('Expedition'))return'last-expedition';
  if(title.includes('Ashen'))return'ashen-gate';
  return'';
}

function applyWorld(worldId){
  const previous=document.body.dataset.world||'';
  document.body.dataset.world=worldId||'';
  const data=worlds[worldId];
  const state=parseWorldState();
  const atmosphere=document.querySelector('#sceneAtmosphere');
  const location=document.querySelector('#sceneLocation');
  if(atmosphere)atmosphere.textContent=data?.atmosphere||'The world is listening';
  if(location)location.textContent=state.location||data?.genre.split(' · ')[0]||'Persistent world';
  if(previous!==worldId&&soundButton.getAttribute('aria-pressed')==='true'){
    rebuildAmbient();
    schedulePhrase();
  }
}

function identifyWorld(){applyWorld(worldFromPage())}
const campaignTitle=document.querySelector('#campaignTitle');
const worldState=document.querySelector('#world');
if(campaignTitle)new MutationObserver(identifyWorld).observe(campaignTitle,{childList:true,subtree:true});
if(worldState)new MutationObserver(identifyWorld).observe(worldState,{childList:true,subtree:true});
identifyWorld();

document.querySelectorAll('.world-card').forEach(card=>{
  if(reduceMotion||!finePointer)return;
  card.addEventListener('pointermove',event=>{
    if(event.pointerType==='touch')return;
    const rect=card.getBoundingClientRect();
    const x=(event.clientX-rect.left)/rect.width;
    const y=(event.clientY-rect.top)/rect.height;
    card.style.setProperty('--mx',`${x*100}%`);
    card.style.setProperty('--my',`${y*100}%`);
    card.style.transform=`perspective(850px) rotateX(${(0.5-y)*4}deg) rotateY(${(x-.5)*6}deg) translateY(-4px)`;
  });
  card.addEventListener('pointerleave',()=>{card.style.transform=''});
});

const preview=document.querySelector('#worldPreview');
const previewArt=preview?.querySelector('.preview-art');
const previewClose=preview?.querySelector('.preview-close');
const previewCancel=document.querySelector('#previewCancel');
const enterWorld=document.querySelector('#enterWorld');
let selectedCard=null;
let allowStarterAction=false;

function closePreview(){
  preview?.close();
  if(document.querySelector('#play')?.hidden&&document.querySelector('#dashboard')&&!document.querySelector('#dashboard').hidden)applyWorld('');
}

function openPreview(card){
  selectedCard=card;
  const data=worlds[card.dataset.world];
  if(!data)return;
  applyWorld(card.dataset.world);
  preview.style.setProperty('--preview-accent',data.accent);
  previewArt.style.setProperty('--preview-art',`url("${data.art}")`);
  document.querySelector('#previewGenre').textContent=data.genre;
  document.querySelector('#previewTitle').textContent=data.name;
  document.querySelector('#previewPremise').textContent=data.premise;
  document.querySelector('#previewDanger').textContent=data.danger;
  const characters=document.querySelector('#previewCharacters');
  characters.replaceChildren(...data.characters.map(([name,description])=>{
    const item=document.createElement('div');
    item.className='preview-character';
    const strong=document.createElement('strong');
    const small=document.createElement('small');
    strong.textContent=name;
    small.textContent=description;
    item.append(strong,small);
    return item;
  }));
  preview.showModal();
}

document.addEventListener('click',event=>{
  const card=event.target.closest?.('.starter');
  if(!card||allowStarterAction)return;
  event.preventDefault();
  event.stopImmediatePropagation();
  openPreview(card);
},true);

previewClose?.addEventListener('click',closePreview);
previewCancel?.addEventListener('click',closePreview);
preview?.addEventListener('click',event=>{if(event.target===preview)closePreview()});

enterWorld?.addEventListener('click',()=>{
  if(!selectedCard)return;
  const data=worlds[selectedCard.dataset.world];
  preview.close();
  document.querySelector('#transitionTitle').textContent=data.name;
  document.querySelector('.world-transition').style.setProperty('--transition-art',`url("${data.art}")`);
  document.querySelector('.world-transition').setAttribute('aria-hidden','false');
  document.body.classList.add('world-entering');
  const delay=reduceMotion?0:850;
  setTimeout(()=>{
    allowStarterAction=true;
    selectedCard.click();
    allowStarterAction=false;
    setTimeout(()=>{
      document.body.classList.remove('world-entering');
      document.querySelector('.world-transition').setAttribute('aria-hidden','true');
    },reduceMotion?0:650);
  },delay);
});

function updatePeoplePresent(){
  const target=document.querySelector('#peoplePresent');
  const source=document.querySelector('#npcs');
  if(!target||!source)return;
  const candidates=[...source.querySelectorAll('.chip')].map(sourceCard=>{
    const name=sourceCard.querySelector('b')?.textContent?.trim()||'Unknown';
    const mood=sourceCard.querySelector('.pill')?.textContent?.trim()||'watchful';
    const details=[...sourceCard.querySelectorAll('.muted')].map(node=>node.textContent.trim()).filter(Boolean);
    const normalized=name.toLowerCase().replace(/[^a-z0-9 ]/g,'').replace(/\s+/g,' ').trim();
    const score=(mood.toLowerCase()==='neutral'?0:100)+name.length+(details[1]?.length||0);
    return{name,mood,details,normalized,score};
  });
  const characters=[];
  for(const candidate of candidates){
    const index=characters.findIndex(item=>item.normalized===candidate.normalized||item.normalized.startsWith(candidate.normalized+' ')||candidate.normalized.startsWith(item.normalized+' '));
    if(index<0)characters.push(candidate);
    else if(candidate.score>characters[index].score)characters[index]=candidate;
  }
  const visible=characters.slice(0,4);
  if(!visible.length){
    target.innerHTML='<div class="presence-empty">No one is close enough to read yet. The world is still moving beyond this scene.</div>';
    return;
  }
  target.replaceChildren(...visible.map(({name,mood,details})=>{
    const item=document.createElement('div');
    item.className='presence-card';
    const avatar=document.createElement('div');
    avatar.className='presence-avatar';
    avatar.setAttribute('aria-hidden','true');
    avatar.textContent=name.split(/\s+/).map(part=>part[0]).join('').slice(0,2).toUpperCase();
    const copy=document.createElement('div');
    const strong=document.createElement('b');
    const moodLine=document.createElement('div');
    const detail=document.createElement('div');
    strong.textContent=name;
    moodLine.className='presence-mood';
    moodLine.textContent=mood;
    detail.className='presence-detail';
    detail.textContent=details[1]||details[0]||'Watching what you choose.';
    copy.append(strong,moodLine,detail);
    item.append(avatar,copy);
    return item;
  }));
}

const npcSource=document.querySelector('#npcs');
if(npcSource)new MutationObserver(updatePeoplePresent).observe(npcSource,{childList:true,subtree:true});
updatePeoplePresent();

if(!reduceMotion){
  const canvas=document.createElement('canvas');
  canvas.id='atmosphere';
  document.body.prepend(canvas);
  const context=canvas.getContext('2d');
  let particles=[];
  function resize(){
    const density=Math.min(devicePixelRatio,2);
    canvas.width=innerWidth*density;
    canvas.height=innerHeight*density;
    canvas.style.width=`${innerWidth}px`;
    canvas.style.height=`${innerHeight}px`;
    context.setTransform(density,0,0,density,0,0);
    particles=Array.from({length:Math.min(90,Math.floor(innerWidth/14))},()=>({
      x:Math.random()*innerWidth,
      y:Math.random()*innerHeight,
      radius:Math.random()*1.8+.35,
      speed:Math.random()*1.8+.45,
      drift:Math.random()*.5-.25,
      alpha:Math.random()*.42+.08
    }));
  }
  function draw(time){
    context.clearRect(0,0,innerWidth,innerHeight);
    const world=currentWorld();
    if(world==='neon-midnight'){
      context.strokeStyle='rgba(95,244,255,.18)';
      context.lineWidth=1;
      for(const particle of particles){
        particle.y+=particle.speed*3.2;
        particle.x+=particle.drift;
        if(particle.y>innerHeight){particle.y=-18;particle.x=Math.random()*innerWidth}
        context.globalAlpha=particle.alpha;
        context.beginPath();
        context.moveTo(particle.x,particle.y);
        context.lineTo(particle.x-particle.drift*6,particle.y+14+particle.speed*4);
        context.stroke();
      }
    }else if(world==='last-expedition'){
      for(const particle of particles){
        particle.y-=particle.speed*.38;
        particle.x+=Math.sin((time/900)+particle.y*.01)*.12;
        if(particle.y<0){particle.y=innerHeight+8;particle.x=Math.random()*innerWidth}
        context.globalAlpha=particle.alpha;
        context.strokeStyle='rgba(142,231,192,.42)';
        context.beginPath();
        context.arc(particle.x,particle.y,particle.radius+1.2,0,Math.PI*2);
        context.stroke();
      }
      const phase=(time%7000)/7000;
      context.globalAlpha=(1-phase)*.16;
      context.strokeStyle='rgb(201,255,240)';
      context.lineWidth=1;
      context.beginPath();
      context.arc(innerWidth*.5,innerHeight*.55,phase*Math.max(innerWidth,innerHeight)*.62,0,Math.PI*2);
      context.stroke();
    }else{
      for(const particle of particles){
        particle.y+=particle.speed*.46;
        particle.x+=particle.drift+.12;
        if(particle.y>innerHeight){particle.y=-8;particle.x=Math.random()*innerWidth}
        context.globalAlpha=particle.alpha;
        context.fillStyle=particle.alpha>.32?'rgb(255,155,97)':'rgb(176,164,153)';
        context.beginPath();
        context.arc(particle.x,particle.y,particle.radius,0,Math.PI*2);
        context.fill();
      }
    }
    context.globalAlpha=1;
    requestAnimationFrame(draw);
  }
  addEventListener('resize',resize,{passive:true});
  resize();
  requestAnimationFrame(draw);
}
