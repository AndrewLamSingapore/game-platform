import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
import * as integrity from '../supabase/functions/_shared/turn-integrity.js';
import { consumeEvents,encodeEvent } from '../supabase/functions/_shared/turn-stream.js';
const source=readFileSync(new URL('../supabase/functions/gm-turn/index.ts',import.meta.url),'utf8');
function fixture({failPersistence=false,delayWrites=false}={}){
 const calls=[];let handler,active=0,maxActive=0;
 const data={campaigns:{id:'campaign',title:'Fixture',world_state:{}},game_sessions:{id:'session'},campaign_entities:[{id:'hero',name:'Hero',state:{controlled_by:'user'}}],npc_agendas:[],campaign_memory:[],campaign_quests:[],faction_relations:[],world_clocks:{day:1,hour:8,minute:0},campaign_rulesets:{config:{}},quest_edges:[],character_stats:{level:1}};
 function query(table,admin){let op='select',payload,filters=[];
  const q={select(){return q;},eq(k,v){filters.push([k,v]);return q;},order(){return q;},limit(){return q;},single(){return q;},maybeSingle(){return q;},insert(x){op='insert';payload=x;return q;},update(x){op='update';payload=x;return q;},upsert(x){op='upsert';payload=x;return q;},then(resolve,reject){calls.push({table,op,payload,filters});if(failPersistence&&table==='game_turns')return Promise.reject(Error('storage unavailable')).then(resolve,reject);let value=admin?null:data[table];if(table==='campaign_entities'){value=filters.find(([k])=>k==='kind')?.[1]==='NPC'?[{id:'npc-1',name:'Witness',state:{}},{id:'npc-2',name:'Guard',state:{}}]:data.campaign_entities;}if(delayWrites&&admin&&op!=='select'&&table!=='game_audit_log'){active++;maxActive=Math.max(maxActive,active);return new Promise(done=>setTimeout(()=>{active--;done({data:value,error:null});},5)).then(resolve,reject);}return Promise.resolve({data:value,error:null}).then(resolve,reject);}};return q;
 }
 const userDb={auth:{getUser:async()=>({data:{user:{id:'user'}}})},rpc:async()=>({data:'OWNER'}),from:t=>query(t,false)};
 const admin={rpc:async()=>({data:1,error:null}),from:t=>query(t,true)};
 const model={narrative:'The gate opens and a witness steps forward.',choices:['Follow the new trail','Question the witness','Protect the open gate'],quest:null,faction_updates:[],npc_updates:[]};
 const sandbox={...integrity,consumeEvents,encodeEvent,Response,Request,ReadableStream,TextEncoder,AbortSignal,crypto,console,
  Deno:{env:{get:n=>n==='SUPABASE_SERVICE_ROLE_KEY'?'service':'fixture'},serve:fn=>{handler=fn;}},
  createClient:(_url,key)=>key==='service'?admin:userDb,
  fetch:async(_url,options)=>options.headers.Accept==='text/event-stream'?new Response(new ReadableStream({start(c){c.enqueue(new TextEncoder().encode(encodeEvent('narrative',{text:'The gate opens',provisional:true})+encodeEvent('result',model)));c.close();}}),{headers:{'content-type':'text/event-stream'}}):Response.json(model)};
 vm.runInNewContext(stripTypeScriptTypes(source.replace(/^import .*;\r?\n/gm,'')),sandbox);
 return {calls,maxActive:()=>maxActive,invoke:accept=>handler(new Request('https://fixture.invalid',{method:'POST',headers:{Authorization:'Bearer fixture',Accept:accept},body:JSON.stringify({campaign_id:'campaign',action:'Open the gate',client_request_id:'request'})}))};
}
test('real Edge success batches NPCs, persists a committed result, and releases the campaign guard',async()=>{
 const f=fixture(),r=await f.invoke('application/json'),data=await r.json();assert.equal(data.turn,1);assert.equal(data.choices.length,3);
 const batch=f.calls.find(x=>x.table==='npc_agendas'&&x.op==='upsert');assert.equal(batch.payload.length,2);
 assert.ok(f.calls.some(x=>x.table==='game_turns'&&x.op==='insert'));
 assert.equal(f.calls.at(-1).payload.turn_guard,false);
});
test('real Edge streaming forwards a draft and emits a committed result last',async()=>{
 const f=fixture(),r=await f.invoke('text/event-stream'),events=[];await consumeEvents(r.body,(event,data)=>events.push([event,data]));
 assert.ok(events.some(([e,d])=>e==='narrative'&&d.provisional));assert.equal(events.at(-1)[0],'result');assert.equal(events.at(-1)[1].turn,1);assert.equal(f.calls.at(-1).payload.turn_guard,false);
});
test('persistence exception never emits success and still releases the guard',async()=>{
 const f=fixture({failPersistence:true}),r=await f.invoke('text/event-stream'),events=[];await consumeEvents(r.body,(e,d)=>events.push([e,d]));assert.equal(events.at(-1)[0],'error');assert.ok(!events.some(([e])=>e==='result'));assert.equal(f.calls.at(-1).payload.turn_guard,false);
});

test('independent authoritative effect writes overlap before the committed result',async()=>{
 const f=fixture({delayWrites:true}),r=await f.invoke('application/json'),data=await r.json();
 assert.equal(data.turn,1);assert.ok(f.maxActive()>=4,'independent writes run concurrently');
 assert.equal(typeof data.timings.first_narrative_ms,'number');
});
