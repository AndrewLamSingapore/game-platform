export function inlineIntegrityCheck(event,state={}){
  if(event.sequence<=(state.lastSequence??-1))return{allow:false,code:'NON_MONOTONIC_SEQUENCE'};
  if(event.payload?.scoreDelta>(state.maxScoreDelta??1000))return{allow:false,code:'IMPOSSIBLE_SCORE_DELTA'};
  if(event.payload?.position&&event.payload?.previousPosition&&event.payload?.elapsedMs>0){
    const dx=event.payload.position.x-event.payload.previousPosition.x,dy=event.payload.position.y-event.payload.previousPosition.y;
    const speed=Math.hypot(dx,dy)/(event.payload.elapsedMs/1000);
    if(speed>(state.maxSpeed??25)*1.05)return{allow:false,code:'IMPOSSIBLE_MOVEMENT'};
  }
  return{allow:true,code:'OK'};
}

export function detectAnomalies(events,baseline={}){
  const flags=[]; const byActor=new Map();
  for(const event of events){const list=byActor.get(event.actor_id)??[];list.push(event);byActor.set(event.actor_id,list);}
  for(const [actorId,list] of byActor){
    const actions=list.filter(e=>e.event_type==='PLAYER_ACTION');
    if(actions.length>=10){const intervals=actions.slice(1).map((e,i)=>Date.parse(e.occurred_at)-Date.parse(actions[i].occurred_at));const mean=intervals.reduce((a,b)=>a+b,0)/intervals.length;const variance=intervals.reduce((a,b)=>a+(b-mean)**2,0)/intervals.length;
      if(Math.sqrt(variance)<(baseline.minTimingStdDevMs??8))flags.push({actor_id:actorId,risk_type:'AUTOMATION_TIMING',severity:'MEDIUM',evidence:{samples:actions.length,stddev_ms:Math.sqrt(variance)}});
    }
    const rejected=list.filter(e=>e.payload?.integrity_result==='REJECT').length;
    if(rejected>=(baseline.rejectionThreshold??3))flags.push({actor_id:actorId,risk_type:'REPEATED_INVALID_ACTIONS',severity:'HIGH',evidence:{rejected}});
  }
  return flags;
}
