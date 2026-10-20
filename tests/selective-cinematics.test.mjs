import assert from 'node:assert/strict';
import {test} from 'node:test';
import fs from 'node:fs';
import {createCinematicController} from '../src/cinematic-client.js';
import {startHiggsfieldVideo,getHiggsfieldVideo} from '../lib/higgsfield-video.js';
const env={HF_KEY:'fixture:secret'};
const response=data=>({ok:true,json:async()=>data});
test('Higgsfield submission uses server credentials and documented image-to-video input',async()=>{
 let count=0;
 const result=await startHiggsfieldVideo({prompt:'Ash falls',imageUrl:'https://example.com/world.webp'},{env,fetchImpl:async(url,options)=>{
  count++;assert.equal(url,'https://api.higgsfield.ai/v1/image2video/dop');assert.equal(options.headers.Authorization,'Key fixture:secret');assert.equal(options.redirect,'error');
  assert.deepEqual(JSON.parse(options.body),{model:'dop-turbo',prompt:'Ash falls',input_images:[{type:'image_url',image_url:'https://example.com/world.webp'}]});
  return response({request_id:'request-123'});
 }});
 assert.deepEqual(result,{provider:'higgsfield',request_id:'request-123',model:'dop-turbo'});assert.equal(count,1);
});
test('provider timeout is not automatically retried',async()=>{
 let count=0;await assert.rejects(startHiggsfieldVideo({prompt:'test',imageUrl:'https://example.com/a.webp'},{env,fetchImpl:async()=>{count++;throw Error('timeout');}}),/timeout/);assert.equal(count,1);
});
test('polling fixes credential destination and maps provider states',async()=>{
 const operation={provider:'higgsfield',request_id:'request-123',status_url:'https://attacker.example/status'};
 for(const [status,expected]of [['queued','pending'],['in_progress','pending'],['failed','error'],['nsfw','error'],['canceled','error'],['completed','completed']]){
  const result=await getHiggsfieldVideo(operation,{env,fetchImpl:async url=>{assert.equal(url,'https://api.higgsfield.ai/requests/request-123/status');return response({status,video:{url:'https://media.example/video.mp4'}});}});assert.equal(result.status,expected);
 }
 await assert.rejects(getHiggsfieldVideo({...operation,request_id:'../secret'},{env}),/invalid_provider_operation/);
 for(const url of ['http://example.com/video.mp4','https://user:password@example.com/video.mp4'])await assert.rejects(getHiggsfieldVideo(operation,{env,fetchImpl:async()=>response({status:'completed',video:{url}})}),/invalid_provider_video/);
 await assert.rejects(getHiggsfieldVideo(operation,{env,fetchImpl:async()=>response({status:'unknown'})}),/unknown_provider_status/);
});
test('client polls once, plays cached ready video and prevents duplicate clicks',async()=>{
 const requests=[],updates=[];let release;
 const controller=createCinematicController({request:async body=>{requests.push(body);if(body.action==='start')return{id:'job',status:'QUEUED'};return{id:'job',status:'READY',output_url:'https://media.example/video.mp4'};},update:s=>updates.push(s),delay:()=>new Promise(r=>release=r)});
 controller.load({campaignId:'campaign',sourceTurn:4});const pending=controller.start();await Promise.resolve();await controller.start();assert.equal(requests.length,1);release();await pending;
 assert.equal(requests.length,2);assert.equal(updates.at(-1).phase,'ready');assert.equal(updates.at(-1).url,'https://media.example/video.mp4');
});
test('scene changes discard late results and polling failures leave controls usable',async()=>{
 let resolve;const updates=[];
 const controller=createCinematicController({request:()=>new Promise(r=>resolve=r),update:s=>updates.push(s)});
 controller.load({campaignId:'old',sourceTurn:0});const pending=controller.start();controller.load({campaignId:'new',sourceTurn:1});resolve({id:'old',status:'READY',output_url:'https://media.example/old.mp4'});await pending;assert.equal(updates.at(-1).phase,'idle');
 const failing=createCinematicController({request:async()=>{throw Error('offline');},update:s=>updates.push(s)});failing.load({campaignId:'new',sourceTurn:1});await failing.start();assert.equal(updates.at(-1).phase,'error');await failing.start();assert.equal(updates.at(-1).phase,'error');
});
test('polling timeout resumes existing job rather than creating another paid job',async()=>{
 const requests=[],updates=[];
 const controller=createCinematicController({request:async body=>{requests.push(body);return{id:'job',status:'PROCESSING'};},update:s=>updates.push(s),pollLimit:0});controller.load({campaignId:'x',sourceTurn:4});await controller.start();assert.equal(updates.at(-1).phase,'waiting');await controller.start();assert.equal(requests[1].action,'status');
});
test('all three world previews have distinct generation inputs and a video player',async()=>{
 const {cinematicWorlds,worldImageUrl}=await import('../lib/cinematic-worlds.js');assert.equal(Object.keys(cinematicWorlds).length,3);assert.equal(new Set(Object.keys(cinematicWorlds).map(worldImageUrl)).size,3);
 const html=fs.readFileSync('index.html','utf8');assert.match(html,/id="cinematicVideo" controls playsinline/);assert.doesNotMatch(html,/No credits, waiting/);
 const preview=fs.readFileSync('experience.js','utf8');assert.match(preview,/cinematics\/manifest.json/);assert.match(preview,/previewVideo.controls=true/);assert.match(preview,/previewVersion/);
});
