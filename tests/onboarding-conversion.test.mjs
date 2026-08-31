import assert from 'node:assert/strict';
import fs from 'node:fs';

const html=fs.readFileSync('index.html','utf8');
const app=fs.readFileSync('app.js','utf8');
const migration=fs.readFileSync('supabase/migrations/20260830143000_starter_worlds_and_conversion_events.sql','utf8');
const gmTurn=fs.readFileSync('supabase/functions/gm-turn/index.ts','utf8');
const narrate=fs.readFileSync('api/narrate.js','utf8');

for(const title of ['The Ashen Gate','Neon After Midnight','The Last Expedition']){
  assert.match(html,new RegExp(title));
  assert.match(migration,new RegExp(title));
}
for(const event of ['game_platform_loaded','starter_world_viewed','starter_world_selected','campaign_created','first_decision_completed','second_turn_completed','return_visit']){
  assert.match(`${app}\n${migration}`,new RegExp(event));
}
assert.match(html,/id="quickChoices"/);
assert.doesNotMatch(html,/id="(?:action|turnForm|send)"/);
assert.doesNotMatch(html,/What do you do\?|write exactly what you do/i);
assert.match(app,/submitChoice\(button\.dataset\.choice\)/);
assert.match(gmTurn,/choice_required/);
assert.match(gmTurn,/choices:nextChoices/);
assert.match(narrate,/minItems:3,maxItems:3/);
assert.match(html,/World details, characters & advanced controls/);
assert.match(migration,/force row level security/i);
assert.match(migration,/revoke all on public\.product_events from public, anon, authenticated/i);
assert.equal((migration.match(/npc_(?:one|two)_agenda/g)||[]).length>4,true);
console.log('Starter onboarding and conversion funnel: PASS');
