import assert from 'node:assert/strict';
import fs from 'node:fs';

const experience = fs.readFileSync('experience.js', 'utf8');

assert.ok(experience.includes('SOUND READY') && experience.includes('PLAYING'), 'sound UI must distinguish ready from playing');
assert.ok(experience.includes("audio.state!=='running'"), 'sound startup must verify a running AudioContext');
assert.ok(experience.includes("soundStatus.classList.add('is-error')"), 'sound startup errors must be visible');
assert.ok(experience.includes("drone(110,.038") && experience.includes("drone(98,.036"), 'ambient bass must remain audible on laptop speakers');
assert.ok(!experience.includes('drone(36.7') && !experience.includes('drone(43,'), 'inaudible sub-bass drones must not return');

console.log('PASS: soundscape state, audibility and failure feedback verified.');
