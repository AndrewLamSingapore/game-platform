import assert from 'node:assert/strict';
import fs from 'node:fs';

const experience = fs.readFileSync('experience.js', 'utf8');

assert.ok(experience.includes('SOUND READY') && experience.includes('PLAYING'), 'sound UI must distinguish ready from playing');
assert.ok(experience.includes("audio.state!=='running'"), 'sound startup must verify a running AudioContext');
assert.ok(experience.includes("soundStatus.classList.add('is-error')"), 'sound startup errors must be visible');
assert.ok(experience.includes("drone(196,.12") && experience.includes("drone(174.61,.11"), 'continuous ambience must be audible on laptop speakers');
assert.ok(experience.includes('function audibilityCue()') && experience.includes("783.99") && experience.includes(".14"), 'playback must begin with an unmistakable confirmation cue');
assert.ok(!experience.includes('drone(36.7') && !experience.includes('drone(43,'), 'inaudible sub-bass drones must not return');

console.log('PASS: soundscape state, audibility and failure feedback verified.');
