import assert from 'node:assert/strict';
import fs from 'node:fs';

const html=fs.readFileSync('index.html','utf8');
const experience=fs.readFileSync('experience.js','utf8');
const atmosphere=fs.readFileSync('atmosphere.css','utf8');
assert.match(html,/experience\.js/);
assert.match(html,/atmosphere\.css/);
assert.match(html,/id="worldPreview"/);
assert.match(html,/id="peoplePresent"/);
assert.match(html,/data-world="ashen-gate"/);
assert.match(html,/data-world="neon-midnight"/);
assert.match(html,/data-world="last-expedition"/);
assert.match(experience,/AudioContext/);
assert.match(experience,/aria-pressed/);
assert.match(experience,/prefers-reduced-motion/);
assert.match(experience,/\(hover: hover\) and \(pointer: fine\)/);
assert.match(experience,/pointerType===['"]touch['"]/);
assert.match(experience,/ashen-gate/);
assert.match(experience,/neon-midnight/);
assert.match(experience,/last-expedition/);
assert.match(experience,/requestAnimationFrame/);
assert.match(experience,/updatePeoplePresent/);
assert.match(experience,/showModal/);
assert.match(experience,/visibilitychange/);
assert.match(atmosphere,/ashen-gate\.webp/);
assert.match(atmosphere,/neon-after-midnight\.webp/);
assert.match(atmosphere,/last-expedition\.webp/);
assert.match(atmosphere,/prefers-reduced-motion/);
for(const asset of ['ashen-gate.webp','neon-after-midnight.webp','last-expedition.webp']){
  const path=`assets/worlds/${asset}`;
  assert.equal(fs.existsSync(path),true,`missing atmosphere art: ${path}`);
  assert.ok(fs.statSync(path).size<150_000,`atmosphere art must stay mobile-friendly: ${path}`);
}
console.log('Atmosphere System V1: cinematic art, sound, motion, previews and Living Characters: PASS');
