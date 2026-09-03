const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer=matchMedia('(hover: hover) and (pointer: fine)').matches;

const worlds={
  'ashen-gate':{
    name:'The Ashen Gate',
    genre:'Dark fantasy · 6–10 hours',
    art:'/assets/worlds/ashen-gate-cast.webp',
    accent:'#ff9b61',
    premise:'The final gate is closing. Someone outside knows your name—and carries proof that the city was built on a lie.',
    danger:'Ash plague moves through the refugees while the gate mechanism begins its final cycle. Every person admitted changes who will survive inside.',
    atmosphere:'Ash falls beyond the wall',
    characters:[
      ['Captain Ilyan Rook','Severe commander buying time for an evacuation',19],
      ['Sable Vey','Your returned sister, carrying forbidden proof',41],
      ['Archivist Meret','Keeper of the names erased from history',61],
      ['Councillor Orr','A charming architect of controlled truth',82]
    ]
  },
  'neon-midnight':{
    name:'Neon After Midnight',
    genre:'Noir science-fiction · 6–10 hours',
    art:'/assets/worlds/neon-midnight-cast.webp',
    accent:'#5ff4ff',
    premise:'A train arrives seven years late. Every passenger remembers a future that has not happened—including yours.',
    danger:'Vanta Security is sealing Platform Nine. The passengers will be erased unless you establish that their memories—and their personhood—are real.',
    atmosphere:'Rain strikes Platform Nine',
    characters:[
      ['Inspector Orin Kade','Controlled pursuer whose daughter is on the train',28],
      ['Nia-7','Synthetic passenger carrying seven lost memories',50],
      ['Roan Mercer','A man who remembers becoming an assassin',72]
    ]
  },
  'last-expedition':{
    name:'The Last Expedition',
    genre:'Lost-world exploration · 6–10 hours',
    art:'/assets/worlds/last-expedition-cast.webp',
    accent:'#63e2c6',
    premise:'Your missing expedition broadcasts one final message from beneath an ocean that should not exist.',
    danger:'Containment charges are counting down while something beneath the drowned observatory reconstructs the missing explorers from memory.',
    atmosphere:'The deep answers in your voice',
    characters:[
      ['Commander Voss','Containment leader guarding your erased order',24],
      ['Tala Quill','Field biologist who may be an ocean-made copy',50],
      ['Ren Sol Echo','A second version of you who wants Earth forgotten',77]
    ]
  }
};

const portraitIndex=new Map();
Object.values(worlds).forEach(world=>world.characters.forEach(([name,,x])=>portraitIndex.set(name.toLowerCase(),{art:world.art,x,y:27})));
window.gameCharacterPortrait=name=>portraitIndex.get(String(name||'').toLowerCase())||null;

const soundButton=document.createElement('button');
soundButton.id='soundToggle';
soundButton.className='secondary';
soundButton.type='button';
soundButton.setAttribute('aria-pressed','false');
soundButton.setAttribute('aria-label','Turn cinematic soundscape on');
soundButton.innerHTML='<span class="sound-wave" aria-hidden="true"><i></i><i></i><i></i></span><span class="label">SOUND READY</span>';
const soundStatus=document.createElement('span');
soundStatus.id='soundStatus';
soundStatus.setAttribute('role','status');
soundStatus.setAttribute('aria-live','polite');
soundStatus.textContent='Sound is ready. Select it to begin playback.';
document.querySelector('body > header')?.append(soundButton,soundStatus);

const style=document.createElement('style');
style.textContent=`
  #soundToggle{flex:0;display:inline-flex;align-items:center;gap:8px;background:#161a28;color:#f5f0ff;border:1px solid #635a8b;padding:9px 13px;box-shadow:0 0 24px #725cff18}
  #soundToggle[aria-pressed="true"]{border-color:var(--world-accent-2,#71e8ff);color:var(--world-accent-2,#bff6ff);box-shadow:0 0 28px var(--world-glow,#71e8ff2b)}
  #soundToggle .sound-wave{display:inline-flex;align-items:center;gap:2px;height:13px}
  #soundToggle i{display:block;width:2px;height:4px;background:currentColor;border-radius:4px}
  #soundToggle[aria-pressed="true"] i{animation:soundbar .8s ease-in-out infinite alternate}
  #soundToggle[aria-pressed="true"] i:nth-child(2){animation-delay:-.35s}
  #soundToggle[aria-pressed="true"] i:nth-child(3){animation-delay:-.6s}
  #soundStatus{position:fixed;right:1rem;top:4.5rem;z-index:80;display:none;max-width:min(25rem,calc(100vw - 2rem));padding:.7rem .9rem;border:1px solid #ff8d8d73;border-radius:10px;background:#481313f5;color:#ffd2d2;font-size:.82rem;line-height:1.35;box-shadow:0 12px 32px #0007}
  #soundStatus.is-error{display:block}
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
    noiseSource('highpass',1800,.05);
    drone(196,.11,'triangle',.11);
    drone(392,.045,'sine',.16);
  }else if(world==='last-expedition'){
    noiseSource('lowpass',1100,.055);
    drone(174.61,.11,'sine',.055);
    drone(261.63,.05,'sine',.07);
  }else{
    noiseSource('bandpass',850,.055);
    drone(196,.12,'triangle',.045);
    drone(293.66,.05,'sine',.06);
  }
}

function audibilityCue(){
  const now=audio.currentTime+.03;
  [523.25,659.25,783.99].forEach((frequency,index)=>tone(frequency,now+index*.22,.38,'sine',.14));
}

function phrase(){
  if(!audio)return;
  const now=audio.currentTime+.04;
  const world=currentWorld();
  if(world==='neon-midnight'){
    [220,330,440,659.25].forEach((frequency,index)=>tone(frequency,now+index*.42,.6,index%2?'triangle':'sine',.07));
  }else if(world==='last-expedition'){
    tone(659.25,now,1.1,'sine',.075);
    tone(329.63,now+.12,2,'sine',.045);
  }else{
    tone(196,now,3.4,'triangle',.08);
    tone(293.66,now+.8,2.6,'triangle',.055);
    tone(440,now+2.1,1.7,'sine',.04);
  }
}

function schedulePhrase(){
  clearInterval(musicTimer);
  phrase();
  musicTimer=setInterval(phrase,currentWorld()==='neon-midnight'?4200:currentWorld()==='last-expedition'?7200:6100);
}

async function startSound(){
  soundStatus.classList.remove('is-error');
  try{
    const AudioContextClass=window.AudioContext||window.webkitAudioContext;
    if(!AudioContextClass)throw new Error('Web Audio is not supported by this browser.');
    if(!audio){
      audio=new AudioContextClass();
      master=audio.createGain();
      const filter=audio.createBiquadFilter();
      filter.type='lowpass';
      filter.frequency.value=3200;
      master.connect(filter).connect(audio.destination);
    }
    await audio.resume();
    if(audio.state!=='running')throw new Error('The browser did not allow audio playback.');
    master.gain.cancelScheduledValues(audio.currentTime);
    master.gain.setValueAtTime(.85,audio.currentTime);
    soundButton.setAttribute('aria-pressed','true');
    soundButton.setAttribute('aria-label','Turn cinematic soundscape off');
    soundButton.querySelector('.label').textContent='PLAYING';
    soundStatus.textContent='Cinematic soundscape is playing.';
    rebuildAmbient();
    audibilityCue();
    schedulePhrase();
  }catch(error){
    stopSound();
    const message=`Sound could not start: ${error?.message||'Check this tab’s sound permission and try again.'}`;
    soundStatus.textContent=message;
    soundStatus.classList.add('is-error');
  }
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
  soundButton.querySelector('.label').textContent='SOUND READY';
}

soundButton.addEventListener('click',()=>soundButton.getAttribute('aria-pressed')==='true'?stopSound():void startSound());
document.addEventListener('visibilitychange',()=>{if(!audio)return;if(document.hidden){audio.suspend();stopSound()} });

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
  document.body.dataset.phase=state.day_phase||state.environment?.phase||'DAY';
  document.body.dataset.weather=state.environment?.weather||'CLEAR';
  document.body.dataset.visibility=state.environment?.visibility||'CLEAR';
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
  characters.replaceChildren(...data.characters.map(([name,description,x])=>{
    const item=document.createElement('div');
    item.className='preview-character';
    const portrait=document.createElement('span');
    portrait.className='preview-character-portrait';
    portrait.style.setProperty('--portrait-image',`url("${data.art}")`);
    portrait.style.setProperty('--portrait-x',`${x}%`);
    const strong=document.createElement('strong');
    const small=document.createElement('small');
    strong.textContent=name;
    small.textContent=description;
    const copy=document.createElement('span');
    copy.append(strong,small);
    item.append(portrait,copy);
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

function characterIdentity(name,details=[]){
  let hash=2166136261;
  for(const char of name)hash=Math.imul(hash^char.charCodeAt(0),16777619);
  const objective=(details[0]||'').toLowerCase();
  const roles=[
    [/guard|protect|patrol|captain|commander/,'Sentinel','◆'],
    [/archive|record|research|investigate|scholar/,'Keeper','✦'],
    [/trade|merchant|deal|smuggl/,'Broker','◈'],
    [/heal|rescue|assist|hope/,'Ally','✚'],
    [/hunt|confront|attack|revenge/,'Threat','▲'],
    [/spy|watch|observe|secret/,'Watcher','◉']
  ];
  const match=roles.find(([pattern])=>pattern.test(objective+name.toLowerCase()));
  const visual=window.gameCharacterVisual?.(name,details[0]||'',match?.[1]||'NPC');
  return{hue:visual?.hue??Math.abs(hash)%360,role:match?.[1]||'Unknown',initials:visual?.initials||name.slice(0,2).toUpperCase(),portrait:window.gameCharacterPortrait?.(name),variant:Math.abs(hash)%4,weaponIcon:visual?.weaponIcon||'🗡️',weapon:visual?.weapon||'Frontier shortblade',damage:visual?.damage||'1d6 + 1'};
}

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
    const identity=characterIdentity(name,details);
    const item=document.createElement('div');
    item.className=`presence-card presence-variant-${identity.variant}`;
    item.style.setProperty('--person-hue',identity.hue);
    const avatar=document.createElement('div');
    avatar.className='presence-avatar';
    avatar.setAttribute('aria-hidden','true');
    if(identity.portrait){
      avatar.classList.add('has-portrait');
      avatar.style.setProperty('--portrait-image',`url("${identity.portrait.art}")`);
      avatar.style.setProperty('--portrait-x',`${identity.portrait.x}%`);
      avatar.style.setProperty('--portrait-y',`${identity.portrait.y}%`);
    }
    avatar.innerHTML=`<span class="presence-initials">${identity.initials}</span>`;
    const copy=document.createElement('div');
    const headline=document.createElement('div');
    headline.className='presence-headline';
    const strong=document.createElement('b');
    const role=document.createElement('span');
    const moodLine=document.createElement('div');
    const objective=document.createElement('div');
    const detail=document.createElement('div');
    const weapon=document.createElement('div');
    strong.textContent=name;
    role.className='presence-role';
    role.textContent=identity.role;
    headline.append(strong,role);
    moodLine.className='presence-mood';
    moodLine.textContent=mood;
    objective.className='presence-objective';
    objective.textContent=details[0]||'Watching what you choose.';
    detail.className='presence-detail';
    detail.textContent=details[1]||'No shared history yet.';
    weapon.className='presence-weapon';
    weapon.innerHTML=`<span aria-hidden="true">${identity.weaponIcon}</span><b>${identity.weapon}</b><small>${identity.damage} · equipped</small>`;
    copy.append(headline,moodLine,objective,detail,weapon);
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
    const world=currentWorld(),weather=document.body.dataset.weather,phase=document.body.dataset.phase;
    if(weather==='RAIN'){
      context.strokeStyle=phase==='NIGHT'?'rgba(150,185,255,.34)':'rgba(205,225,255,.3)';context.lineWidth=1;
      for(const particle of particles){particle.y+=particle.speed*4.8;particle.x-=1.2;if(particle.y>innerHeight){particle.y=-18;particle.x=Math.random()*innerWidth}context.globalAlpha=particle.alpha;context.beginPath();context.moveTo(particle.x,particle.y);context.lineTo(particle.x-7,particle.y+20);context.stroke();}
    }else if(weather==='FOG'){
      for(const particle of particles){particle.x+=particle.speed*.16;particle.y+=Math.sin(time/1800+particle.x*.01)*.08;if(particle.x>innerWidth+30)particle.x=-30;context.globalAlpha=.035+particle.alpha*.12;context.fillStyle='rgb(220,226,232)';context.beginPath();context.ellipse(particle.x,particle.y,particle.radius*18+20,particle.radius*5+7,0,0,Math.PI*2);context.fill();}
    }else if(world==='neon-midnight'){
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
