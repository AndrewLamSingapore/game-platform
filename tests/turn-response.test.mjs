import test from 'node:test';
import assert from 'node:assert/strict';
import { consumeEvents,encodeEvent,partialNarrative } from '../supabase/functions/_shared/turn-stream.js';
import { requestTurn } from '../src/turn-client.js';
import { gameBackend } from '../lib/game-backend.js';
import narrate from '../api/narrate.js';
const bodyFrom=pieces=>new ReadableStream({start(c){for(const p of pieces)c.enqueue(new TextEncoder().encode(p));c.close();}});
test('SSE handles split UTF-8, escaped JSON, comments and missing terminal results',async()=>{
 const bytes=new TextEncoder().encode(encodeEvent('narrative',{text:'奥启维亚 “hello”'}));
 const body=new ReadableStream({start(c){for(const b of bytes)c.enqueue(new Uint8Array([b]));c.close();}});const seen=[];
 await consumeEvents(body,(event,data)=>seen.push([event,data]));assert.equal(seen[0][1].text,'奥启维亚 “hello”');
 assert.equal(partialNarrative('{"narrative":"Hello \\"friend\\" \\u4f60'),'Hello "friend" 你');
 assert.equal(partialNarrative('{"narrative":"Hi\\u4f'),'Hi');
 await assert.rejects(requestTurn({url:'https://fixture.invalid',key:'fixture',token:'fixture',body:{},fetchImpl:async()=>new Response(bodyFrom([encodeEvent('narrative',{text:'draft'})]),{headers:{'content-type':'text/event-stream'}})}),/before the turn was confirmed/);
});
test('browser receives provisional text before committed result and surfaces stream conflicts',async()=>{
 const seen=[];const r=await requestTurn({url:'https://fixture.invalid',key:'fixture',token:'fixture',body:{},onNarrative:t=>seen.push(t),fetchImpl:async()=>new Response(bodyFrom([encodeEvent('narrative',{text:'draft'}),encodeEvent('result',{turn:2,gm:'committed'})]),{headers:{'content-type':'text/event-stream'}})});
 assert.deepEqual(seen,['draft']);assert.equal(r.data.gm,'committed');
 const e=await requestTurn({url:'https://fixture.invalid',body:{},fetchImpl:async()=>new Response(bodyFrom([encodeEvent('error',{status:409,error:'stale_beat'})]),{headers:{'content-type':'text/event-stream'}})});assert.equal(e.error.context.status,409);
});
test('preview cannot default or explicitly point at the production backend',()=>{
 assert.equal(gameBackend({VERCEL_ENV:'preview'}),null);
 assert.equal(gameBackend({VERCEL_ENV:'preview',GAME_SUPABASE_URL:'https://vtrfgckzpjgtmqsnumur.supabase.co/',GAME_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fixture'}),null);
 assert.equal(gameBackend({VERCEL_ENV:'preview',GAME_SUPABASE_URL:'https://VTRFGCKZPJGTMQSNUMUR.supabase.co:443',GAME_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fixture'}),null);
 assert.ok(gameBackend({VERCEL_ENV:'production'}));
 assert.equal(gameBackend({VERCEL_ENV:'preview',GAME_SUPABASE_URL:'https://isolated.supabase.co',GAME_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fixture'}).url,'https://isolated.supabase.co');
});
function fakeRes(){return {headers:{},chunks:[],statusCode:200,setHeader(k,v){this.headers[k]=v;},status(s){this.statusCode=s;return this;},json(x){this.body=x;return this;},write(x){this.chunks.push(x);},end(){this.ended=true;},flushHeaders(){}};}
test('narration quota denies before provider invocation and storage errors fail closed',async()=>{
 const original=global.fetch;let calls=[];
 try{for(const quota of [false,'offline']){calls=[];global.fetch=async(url)=>{calls.push(url);if(url.includes('/auth/'))return Response.json({id:'fixture'});if(url.includes('campaign_members'))return Response.json([{role:'OWNER'}]);if(url.includes('admit_game_narration'))return quota==='offline'?Response.json({}, {status:503}):Response.json(quota);throw Error('paid provider must not execute');};
 const res=fakeRes();await narrate({method:'POST',headers:{authorization:'Bearer fixture'},body:{campaign_id:'fixture'}},res);assert.equal(res.statusCode,quota==='offline'?503:429);assert.equal(calls.length,3);}}
 finally{global.fetch=original;}
});
test('real narration handler streams provider deltas, then validates the completed object',async()=>{
 const original=global.fetch,previous=process.env.AI_GATEWAY_API_KEY;process.env.AI_GATEWAY_API_KEY='fixture';
 const generated={narrative:'A witness opens the gate.',choices:['Follow the new trail','Question the witness','Protect the exposed route'],quest:null,faction_updates:[],npc_updates:[]};
 try{global.fetch=async(url,options)=>{if(url.includes('/auth/'))return Response.json({id:'fixture'});if(url.includes('campaign_members'))return Response.json([{role:'OWNER'}]);if(url.includes('admit_game_narration'))return Response.json(true);assert.equal(JSON.parse(options.body).stream,true);assert.equal(JSON.parse(options.body).reasoning.effort,'none');
 const full=JSON.stringify(generated);return new Response(bodyFrom([encodeEvent('response.output_text.delta',{type:'response.output_text.delta',delta:full.slice(0,28)}),encodeEvent('response.output_text.delta',{type:'response.output_text.delta',delta:full.slice(28)}),encodeEvent('response.completed',{type:'response.completed',response:{model:'fixture'}})]),{headers:{'content-type':'text/event-stream'}});};
 const res=fakeRes();await narrate({method:'POST',headers:{authorization:'Bearer fixture',accept:'text/event-stream'},body:{campaign_id:'fixture',context:{}}},res);
 const events=[];await consumeEvents(bodyFrom(res.chunks),(e,d)=>events.push([e,d]));assert.equal(events[0][0],'narrative');assert.equal(events.at(-1)[0],'result');assert.equal(events.at(-1)[1].narrative,generated.narrative);assert.ok(res.ended);
 }finally{global.fetch=original;if(previous===undefined)delete process.env.AI_GATEWAY_API_KEY;else process.env.AI_GATEWAY_API_KEY=previous;}
});
