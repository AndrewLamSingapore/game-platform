// Explicit, resumable generation of the three starter-world introductions.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {cinematicWorlds,worldImageUrl} from '../lib/cinematic-worlds.js';
import {startHiggsfieldVideo,getHiggsfieldVideo,higgsfieldConfigured} from '../lib/higgsfield-video.js';
const mode=process.argv[2];
if(!['--submit','--collect'].includes(mode))throw Error('Usage: node --env-file-if-exists=.env.local scripts/generate-world-cinematics.mjs --submit|--collect');
if(!higgsfieldConfigured())throw Error('Set HF_KEY (KEY_ID:KEY_SECRET) securely in the server environment first.');
const folder=resolve('assets/worlds/cinematics');
const statePath=resolve(process.env.CINEMATIC_GENERATION_STATE||'/workspace/cloud-setup/game-platform/world-cinematic-jobs.json');
await mkdir(folder,{recursive:true});
await mkdir(resolve(statePath,'..'),{recursive:true});
async function readJson(path){try{return JSON.parse(await readFile(path,'utf8'));}catch(error){if(error.code==='ENOENT')return{};throw error;}}
const state=await readJson(statePath),manifest=await readJson(resolve(folder,'manifest.json'));
for(const [id,world]of Object.entries(cinematicWorlds)){
 if(manifest[id]){console.log(`${id}: already published locally`);continue;}
 if(mode==='--submit'){
  if(state[id]){console.log(`${id}: already submitted or submission unresolved; use --collect`);continue;}
  // Save before submitting: an ambiguous timeout must never silently bill twice.
  state[id]={status:'submitting'};await writeFile(statePath,JSON.stringify(state,null,2)+'\n');
  state[id]=await startHiggsfieldVideo({prompt:`${world.prompt} Animate the supplied artwork. Original fictional characters only. No dialogue, text, logos or interface.`,imageUrl:worldImageUrl(id)});
  await writeFile(statePath,JSON.stringify(state,null,2)+'\n');console.log(`${id}: submitted`);
 }else{
  if(!state[id]?.request_id){console.log(`${id}: no confirmed request; inspect the provider account before resubmitting`);continue;}
  const result=await getHiggsfieldVideo(state[id]);
  if(result.status!=='completed'){console.log(`${id}: ${result.status}`);continue;}
  const response=await fetch(result.url,{redirect:'error',signal:AbortSignal.timeout(60000)});
  if(!response.ok||!response.headers.get('content-type')?.startsWith('video/'))throw Error(`${id}: video download failed`);
  const bytes=new Uint8Array(await response.arrayBuffer());
  if(bytes.length<1024||bytes.length>100*1024*1024)throw Error(`${id}: unexpected video size`);
  await writeFile(resolve(folder,`${id}.mp4`),bytes);
  manifest[id]=`/assets/worlds/cinematics/${id}.mp4`;
  await writeFile(resolve(folder,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');console.log(`${id}: video saved`);
 }
}
