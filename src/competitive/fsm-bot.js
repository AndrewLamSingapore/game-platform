const STATES = Object.freeze({SPAWN:'SPAWN',SEEK:'SEEK',ENGAGE:'ENGAGE',RETREAT:'RETREAT',OBJECTIVE:'OBJECTIVE',DEFEATED:'DEFEATED'});
const clamp=(n,min,max)=>Math.max(min,Math.min(max,Number(n)||0));

export function seededRandom(seed) {
  let state=(Number(seed)>>>0)||0x6d2b79f5;
  return () => { state += 0x6d2b79f5; let t=state; t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296; };
}

export function createBot(config={}) {
  return Object.freeze({
    id:String(config.id??'bot'), version:String(config.version??'fsm-v1'),
    state:STATES.SPAWN, tick:0, hp:clamp(config.hp??100,0,100),
    retreatAt:clamp(config.retreatAt??25,1,90), aggression:clamp(config.aggression??0.6,0,1),
    seed:Number(config.seed)>>>0, targetId:null
  });
}

export function decideBotTick(bot, world) {
  const next={...bot,tick:bot.tick+1,hp:clamp(world.selfHp??bot.hp,0,100)};
  if (next.hp===0) return freezeDecision(next,STATES.DEFEATED,'NONE',null,'defeated');
  if (next.hp<=next.retreatAt && world.safePosition) return freezeDecision(next,STATES.RETREAT,'MOVE',world.safePosition,'low_health');
  if (world.visibleEnemy?.id) {
    const inRange=clamp(world.visibleEnemy.distance,0,Number.MAX_SAFE_INTEGER)<=clamp(world.attackRange??2,0,1000);
    return freezeDecision(next,STATES.ENGAGE,inRange?'ATTACK':'MOVE',inRange?world.visibleEnemy.id:world.visibleEnemy.position,inRange?'enemy_in_range':'close_distance');
  }
  if (world.objective?.active) return freezeDecision(next,STATES.OBJECTIVE,'MOVE',world.objective.position,'active_objective');
  const points=Array.isArray(world.patrolPoints)?world.patrolPoints:[];
  const random=seededRandom((next.seed+next.tick)>>>0);
  const target=points.length?points[Math.floor(random()*points.length)]:world.spawnPosition??null;
  return freezeDecision(next,STATES.SEEK,target?'MOVE':'WAIT',target,'seek');
}

function freezeDecision(bot,state,action,target,reason){return Object.freeze({bot:Object.freeze({...bot,state,targetId:typeof target==='string'?target:null}),decision:Object.freeze({tick:bot.tick,state,action,target,reason})});}
export {STATES};
