import crypto from 'node:crypto';
import { assertContract } from './generated/portfolio-contracts.js';

const hash=value=>crypto.createHash('sha256').update(String(value)).digest('hex');
function rng(seed){let x=Number.parseInt(hash(seed).slice(0,8),16)>>>0;return()=>{x=(1664525*x+1013904223)>>>0;return x/4294967296;};}
function quantile(values,q){const sorted=[...values].sort((a,b)=>a-b);return sorted[Math.min(sorted.length-1,Math.max(0,Math.floor((sorted.length-1)*q)))];}
function metrics(outcomes){const mean=outcomes.reduce((a,b)=>a+b,0)/outcomes.length;return {mean,p10:quantile(outcomes,.1),median:quantile(outcomes,.5),p90:quantile(outcomes,.9),min:Math.min(...outcomes),max:Math.max(...outcomes)};}
export function simulateScenario(spec={}){
  const iterations=Math.max(10,Math.min(Number(spec.iterations||500),10000));const seed=String(spec.seed??'portfolio');const baseline=Number(spec.baseline||0);const volatility=Math.max(0,Number(spec.volatility??1));const drift=Number(spec.drift||0);const assumptions=Array.isArray(spec.assumptions)?spec.assumptions.map(String):[];
  const strategies=Array.isArray(spec.strategies)&&spec.strategies.length?spec.strategies:[{id:'baseline',parameters:{baseline,volatility,drift}}];
  const results=strategies.map(strategy=>{
    if(!strategy?.id)throw new Error('strategy.id is required');const parameters={...strategy.parameters};const strategyBaseline=Number(parameters.baseline??Object.values(parameters).reduce((sum,value)=>sum+Number(value||0),0)??baseline);const strategyVolatility=Math.max(0,Number(parameters.volatility??volatility));const strategyDrift=Number(parameters.drift??drift);const random=rng(`${seed}:${strategy.id}`);const outcomes=[];
    for(let index=0;index<iterations;index++){const noise=(random()+random()+random()+random()+random()+random()-3)*strategyVolatility;outcomes.push(strategyBaseline+strategyDrift+noise);}
    return {strategy_id:String(strategy.id),parameters,metrics:metrics(outcomes)};
  });
  const scenarioId=String(spec.scenario_id||spec.id||`scenario-${hash(JSON.stringify({seed,iterations,strategies,assumptions})).slice(0,16)}`);const simulationId=`sim-${hash(JSON.stringify({scenarioId,seed,iterations,strategies,assumptions})).slice(0,24)}`;
  return {schema_version:'1.0',simulation_id:simulationId,scenario_id:scenarioId,seed,iterations,assumptions,results,metrics:results.length===1?results[0].metrics:null,authoritative:false,real_world_proof:false,evidence_level:'E1'};
}
export function asPortfolioEvent(result,correlationId=null){
  return assertContract('portfolio-event-v1',{version:'1.0',event_id:`game-${result.simulation_id}`,event_type:'game.simulation.completed',source:'game-platform',occurred_at:new Date().toISOString(),correlation_id:correlationId||result.scenario_id,subject_id:result.simulation_id,evidence_level:'E1',provenance:[`seed:${result.seed}`,`iterations:${result.iterations}`],payload:result});
}
