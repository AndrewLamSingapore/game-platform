import assert from 'node:assert/strict';
import fs from 'node:fs';

const html=fs.readFileSync('index.html','utf8');
const experience=fs.readFileSync('experience.js','utf8');
assert.match(html,/experience\.js/);
assert.match(experience,/AudioContext/);
assert.match(experience,/aria-pressed/);
assert.match(experience,/prefers-reduced-motion/);
assert.match(experience,/\(hover: hover\) and \(pointer: fine\)/);
assert.match(experience,/pointerType===['"]touch['"]/);
assert.match(experience,/ashen-gate/);
assert.match(experience,/neon-midnight/);
assert.match(experience,/last-expedition/);
assert.match(experience,/requestAnimationFrame/);
console.log('Cinematic music and motion experience: PASS');
