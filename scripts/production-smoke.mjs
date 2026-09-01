import assert from 'node:assert/strict';
const base=(process.env.GAME_PLATFORM_URL||'https://game-platform-wine-nine.vercel.app').replace(/\/$/,'');
const response=await fetch(`${base}/api/health`,{signal:AbortSignal.timeout(Number(process.env.SMOKE_TIMEOUT_MS||15000))});
assert.equal(response.status,200);const health=await response.json();assert.equal(health.ok,true);assert.equal(health.product,'game-platform');assert.equal(health.simulation,'bounded-v1');
if(process.env.EXPECTED_REVISION)assert.equal(health.revision,process.env.EXPECTED_REVISION);
console.log(`Game Platform production smoke passed: ${health.revision||'revision unavailable'}`);
