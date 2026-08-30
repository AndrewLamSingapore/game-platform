import assert from 'node:assert/strict';import fs from 'node:fs';
const files=['app.js','supabase/functions/gm-turn/index.ts','supabase/functions/game-action/index.ts'];const text=files.map(f=>fs.readFileSync(f,'utf8')).join('\n');
assert.equal(/entity_type/.test(text),false,'campaign_entities canonical column is kind');
assert.equal(/action_type/.test(text),false,'game_audit_log canonical column is action');
assert.equal(/\.select\(['"]decision['"]\)/.test(text),false,'game_audit_log canonical payload is decision_record');
assert.equal(/campaign\.name\b/.test(text),false,'campaign canonical display field is title');
assert.match(text,/decision_record/);assert.match(text,/correlation_id/);assert.match(text,/world_state/);
console.log('Canonical live schema contract: PASS');
