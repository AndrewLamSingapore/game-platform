import crypto from 'node:crypto';

function rng(seed){let x=Number.parseInt(crypto.createHash('sha256').update(String(seed)).digest('hex').slice(0,8),16)>>>0; return ()=>{x=(1664525*x+1013904223)>>>0; return x/4294967296;};}
function quantile(xs,q){const a=[...xs].sort((x,y)=>x-y); return a[Math.min(a.length-1,Math.max(0,Math.floor((a.length-1)*q)))];}
export function simulateScenario(spec={}){
  const iterations=Math.max(10,Math.min(Number(spec.iterations||500),10000)); const random=rng(spec.seed||'portfolio'); const baseline=Number(spec.baseline||0); const volatility=Math.max(0,Number(spec.volatility||1)); const drift=Number(spec.drift||0); const outcomes=[];
  for(let i=0;i<iterations;i++){const noise=((random()+random()+random()+random()+random()+random())-3)*volatility; outcomes.push(baseline+drift+noise);}
  const mean=outcomes.reduce((a,b)=>a+b,0)/outcomes.length;
  return {simulation_id:crypto.randomUUID(),assumptions:{baseline,volatility,drift},seed:String(spec.seed||'portfolio'),iterations,metrics:{mean,p10:quantile(outcomes,.1),median:quantile(outcomes,.5),p90:quantile(outcomes,.9),min:Math.min(...outcomes),max:Math.max(...outcomes)},authoritative:false,evidence_level:'E1'};
}
export function asPortfolioEvent(result,correlationId=null){return {version:'1.0',event_id:`game-${result.simulation_id}`,event_type:'game.simulation.completed',source:'game-platform',occurred_at:new Date().toISOString(),correlation_id:correlationId,subject_id:result.simulation_id,evidence_level:result.evidence_level,provenance:[`seed:${result.seed}`,`iterations:${result.iterations}`],payload:result};}
