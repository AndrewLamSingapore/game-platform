import assert from 'node:assert/strict';
import { deterministicFallback } from '../api/narrate.js';

const context = {
  player_action: 'Open the sealed gate',
  campaign: { world_state: { location: 'Ashen Gate', choices: ['Open the sealed gate', 'Wait for dawn', 'Return to camp'] } },
};
const result = deterministicFallback(context, 'gateway_429');
assert.equal(result.generation.mode, 'deterministic_fallback');
assert.equal(result.generation.reason, 'gateway_429');
assert.equal(result.choices.length, 3);
assert.equal(new Set(result.choices).size, 3);
assert.ok(result.choices.every(choice => !context.campaign.world_state.choices.includes(choice)));
assert.ok(result.narrative.includes('Ashen Gate'));
console.log('Narration deterministic resilience: PASS');
