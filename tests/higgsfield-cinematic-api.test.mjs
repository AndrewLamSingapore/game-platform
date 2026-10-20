import {test} from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/cinematic.js';
const campaign='11111111-1111-4111-8111-111111111111',id='22222222-2222-4222-8222-222222222222';
const reply=data=>({ok:true,status:200,json:async()=>data});
async function call(body,options={}){
 const previous=globalThis.fetch,saved={};
 for(const [key,value]of Object.entries({HF_KEY:'fixture:secret',SUPABASE_SERVICE_ROLE_KEY:'fixture-service',CINEMATIC_GENERATION_ENABLED:'true'})){saved[key]=process.env[key];process.env[key]=value;}
 const calls=[];
 globalThis.fetch=async(url,request={})=>{
  calls.push([url,request]);
  if(url.endsWith('/auth/v1/user'))return reply({id:'user'});
  if(url.includes('/campaign_members?'))return reply([{role:'OWNER'}]);
  if(url.includes('/campaigns?'))return reply([{id:campaign,title:'Ashen',world_state:{starter_id:options.world||'ashen-gate'}}]);
  if(url.includes('/game_turns?'))return reply([{turn_no:4,content:'The gate closes.'}]);
  if(url.includes('/campaign_entities?')||url.includes('/campaign_quests?'))return reply([]);
  if(url.includes('/cinematic_jobs?'))return reply([options.job]);
  if(url.endsWith('/server_reserve_cinematic_job'))return reply(options.reserved||{created:true,job:{id,status:'RESERVED'}});
  if(url.endsWith('/server_transition_cinematic_job')){const args=JSON.parse(request.body);assert.equal(args.p_user_id,'user');assert.equal(request.headers.apikey,'fixture-service');return reply({id,status:args.p_status,output_url:args.p_output_url,operation:args.p_operation});}
  if(url==='https://api.higgsfield.ai/v1/image2video/dop'){if(options.providerError)throw Error('timeout');return reply({request_id:'provider-request'});}
  if(url==='https://api.higgsfield.ai/requests/provider-request/status')return reply({status:'completed',video:{url:'https://media.example/video.mp4'}});
  throw Error(`Unexpected URL: ${url}`);
 };
 const result={statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v;},status(code){this.statusCode=code;return this;},json(data){this.body=data;return this;}};
 try{await handler({method:'POST',headers:{authorization:'Bearer fixture-user'},body},result);return{result,calls};}
 finally{globalThis.fetch=previous;for(const [key,value]of Object.entries(saved))if(value===undefined)delete process.env[key];else process.env[key]=value;}
}
test('each world submits server-authored prompt and its distinct artwork',async()=>{
 for(const [world,art]of [['ashen-gate','ashen-gate.webp'],['neon-midnight','neon-after-midnight.webp'],['last-expedition','last-expedition.webp']]){
  const {result,calls}=await call({action:'start',campaign_id:campaign,source_turn:4,prompt:'attacker prompt'},{world});assert.equal(result.statusCode,202);assert.equal(result.body.job.operation,undefined);
  const submit=calls.find(([url])=>url.includes('/v1/image2video/dop'));const input=JSON.parse(submit[1].body);assert.ok(input.input_images[0].image_url.endsWith(art));assert.ok(input.prompt.includes('The gate closes'));assert.ok(!input.prompt.includes('attacker prompt'));
 }
});
test('cached scenes do not submit another paid generation',async()=>{
 const {result,calls}=await call({action:'start',campaign_id:campaign,source_turn:4},{reserved:{created:false,job:{id,status:'READY',output_url:'https://media.example/video.mp4'}}});assert.equal(result.body.cached,true);assert.ok(!calls.some(([url])=>url.includes('api.higgsfield.ai')));
});
test('stale scene is rejected before reservation or provider call',async()=>{
 const {result,calls}=await call({action:'start',campaign_id:campaign,source_turn:3});assert.equal(result.statusCode,409);assert.ok(!calls.some(([url])=>url.includes('server_reserve')||url.includes('api.higgsfield.ai')));
});
test('ambiguous provider timeout never marks job retryable',async()=>{
 const {result,calls}=await call({action:'start',campaign_id:campaign,source_turn:4},{providerError:true});assert.equal(result.statusCode,500);assert.ok(!calls.some(([url])=>url.includes('server_transition')));
});
test('completed provider video is persisted and returned without operation details',async()=>{
 const {result}=await call({action:'status',job_id:id},{job:{id,requested_by:'user',status:'QUEUED',operation:{provider:'higgsfield',request_id:'provider-request'}}});assert.equal(result.statusCode,200);assert.equal(result.body.job.status,'READY');assert.equal(result.body.job.output_url,'https://media.example/video.mp4');assert.equal(result.body.job.operation,undefined);
});
test('invalid JSON returns a client error',async()=>{const {result}=await call('{');assert.equal(result.statusCode,400);});
