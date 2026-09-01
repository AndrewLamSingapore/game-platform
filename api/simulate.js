import crypto from 'node:crypto';
import { simulateScenario, asPortfolioEvent } from '../server/services/portfolioSimulation.js';
import { publishPortfolioEvent } from '../server/services/portfolioEventClient.js';

function authorized(req){const expected=process.env.PORTFOLIO_SIMULATION_TOKEN||'';const supplied=String(req.headers?.authorization||'').replace(/^Bearer\s+/i,'');if(!expected||expected.length!==supplied.length)return false;return crypto.timingSafeEqual(Buffer.from(expected),Buffer.from(supplied));}
export default async function handler(req,res){
  res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'method_not_allowed'});}
  if(!process.env.PORTFOLIO_SIMULATION_TOKEN)return res.status(503).json({error:'simulation_authorization_not_configured'});
  if(!authorized(req))return res.status(401).json({error:'unauthorized'});
  try{const result=simulateScenario(req.body||{});const event=asPortfolioEvent(result,req.body?.correlation_id||result.scenario_id);const fabric=await publishPortfolioEvent(event);return res.status(200).json({ok:true,result,event_id:event.event_id,portfolio_fabric:fabric});}
  catch(error){return res.status(422).json({ok:false,error:String(error?.message||error).slice(0,300)});}
}
