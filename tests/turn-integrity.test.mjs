import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  allowedOrigins,
  isDuplicateKey,
  isMissingSchema,
  resolveCorsOrigin,
  sanitizeNarration,
  turnDiagnostics,
} from '../supabase/functions/_shared/turn-integrity.js';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const gmTurn = read('supabase/functions/gm-turn/index.ts');
const gameAction = read('supabase/functions/game-action/index.ts');
const joinCampaign = read('supabase/functions/join-campaign/index.ts');
const app = read('app.js');
const indexHtml = read('index.html');
const migration = read('supabase/migrations/20260922090000_turn_integrity_hardening.sql');

test('narration sanitiser removes mechanical values and keeps the prose', () => {
  const dirty =
    'You slip past the guard [check:stealth:14] and take 3 HP of damage. Roll 1d20 + 2 for the next step. DC 15 is still in force. The gate groans shut behind you.';
  const result = sanitizeNarration(dirty);
  assert.ok(!/\[check/i.test(result.text), 'bracketed directives are removed');
  assert.ok(!/\b3\s*hp\b/i.test(result.text), 'HP values are removed');
  assert.ok(!/\b1d20\b/i.test(result.text), 'dice notation is removed');
  assert.ok(!/\bDC\s*15\b/i.test(result.text), 'difficulty classes are removed');
  assert.match(result.text, /slip past the guard/i);
  assert.match(result.text, /gate groans shut behind you/i);
  assert.equal(result.changed, true);
  assert.ok(result.removed.length >= 3, `expected several lint labels, got ${result.removed.join(',')}`);
});

test('narration sanitiser leaves clean prose untouched and bounds its length', () => {
  const clean = 'The corridor narrows. Someone has been here before you, and recently.';
  const result = sanitizeNarration(clean);
  assert.equal(result.text, clean);
  assert.equal(result.changed, false);
  assert.deepEqual(result.removed, []);
  assert.equal(sanitizeNarration('x'.repeat(2000)).text.length, 900);
  assert.deepEqual(sanitizeNarration(''), { text: '', removed: [], changed: false });
});

test('browser origins are allow-listed instead of wildcarded', () => {
  assert.equal(resolveCorsOrigin('https://game-platform-wine-nine.vercel.app'), 'https://game-platform-wine-nine.vercel.app');
  assert.equal(resolveCorsOrigin('http://localhost:4178'), 'http://localhost:4178');
  assert.equal(resolveCorsOrigin('https://evil.example'), null);
  assert.equal(resolveCorsOrigin(''), null);
  assert.equal(resolveCorsOrigin(undefined), null);
  assert.equal(resolveCorsOrigin('https://preview.example', 'https://preview.example'), 'https://preview.example');
  assert.ok(allowedOrigins().includes('https://game-platform-wine-nine.vercel.app'));
});

test('edge functions no longer emit a wildcard CORS origin', () => {
  for (const [name, source] of [['gm-turn', gmTurn], ['game-action', gameAction], ['join-campaign', joinCampaign]]) {
    assert.ok(!source.includes("'Access-Control-Allow-Origin':'*'"), `${name} must not send a wildcard origin`);
    assert.ok(source.includes("resolveCorsOrigin(req.headers.get('Origin')"), `${name} resolves the request origin`);
    assert.ok(source.includes("'Access-Control-Allow-Origin':origin||'null'"), `${name} echoes only an allowed origin`);
    assert.ok(source.includes("'Vary':'Origin'"), `${name} varies on Origin`);
  }
});

test('schema and idempotency failures are classified, not swallowed', () => {
  assert.equal(isDuplicateKey({ code: '23505' }), true);
  assert.equal(isDuplicateKey({ code: '23503' }), false);
  assert.equal(isMissingSchema({ code: '42703' }), true);
  assert.equal(isMissingSchema({ code: '42P01' }), true);
  assert.equal(isMissingSchema({ code: '23505' }), false);
  assert.deepEqual(turnDiagnostics({ auditOk: true }), { audit: 'recorded', narration_lint: [] });
  assert.deepEqual(turnDiagnostics({ auditOk: false, narrationLint: ['mechanical value'] }), {
    audit: 'degraded',
    narration_lint: ['mechanical value'],
  });
});

test('the idempotency key is reserved before any authoritative mutation', () => {
  const reservation = gmTurn.indexOf('idempotency_key:idem');
  const claim = gmTurn.indexOf('claim_next_game_turn');
  assert.ok(reservation > -1, 'gm-turn reserves the idempotency key');
  assert.ok(claim > -1, 'gm-turn claims the turn sequence');
  assert.ok(reservation < claim, 'the reservation must happen before the turn is claimed');
  assert.ok(gmTurn.includes("error:'turn_in_flight'"), 'a concurrent duplicate is rejected as in-flight');
  assert.ok(gmTurn.includes('replayed:true'), 'a completed duplicate returns the stored result');
  const duplicateCheck = gmTurn.indexOf('isDuplicateKey(reserveError)');
  const replayLookup = gmTurn.indexOf("await admin.from('game_audit_log').select('decision_record')");
  assert.ok(duplicateCheck > -1, 'the reservation conflict is classified');
  assert.ok(replayLookup > duplicateCheck, 'the replay lookup only runs after a duplicate-key conflict, never before mutation');
});

test('model narration is sanitised before it can become authoritative prose', () => {
  assert.ok(gmTurn.includes("from '../_shared/turn-integrity.js';"), 'gm-turn imports the shared turn-integrity helpers');
  for (const helper of ['isDuplicateKey', 'resolveCorsOrigin', 'sanitizeNarration', 'turnDiagnostics']) {
    assert.ok(gmTurn.includes(helper), `gm-turn imports ${helper}`);
  }
  assert.ok(gmTurn.includes('sanitizeNarration(model.narrative,900)'), 'model narration passes through the sanitiser');
  assert.ok(/let gm=modelNarration\?\.text\|\|deterministicNarrative\(/.test(gmTurn), 'the deterministic fallback is used when the sanitiser empties the model text');
  assert.ok(gmTurn.includes('narration_lint'), 'lint output is reported');
});

test('a degraded audit write is reported instead of blocking the turn', () => {
  assert.ok(gmTurn.includes("message:'gm_turn_audit_degraded'"));
  assert.ok(/return j\(\{\.\.\.result,diagnostics:/.test(gmTurn), 'the turn result still returns with diagnostics');
});

test('the audit-write migration is additive and idempotent', () => {
  for (const column of ['actor_type', 'action', 'execution_status', 'verification_status', 'outcome_status', 'decision_record']) {
    assert.ok(migration.includes(`add column if not exists ${column}`), `migration adds ${column}`);
  }
  assert.ok(migration.includes('NOT APPLIED'), 'the migration states it has not been applied');
  assert.ok(!/drop table|truncate|delete from/i.test(migration), 'the migration destroys nothing');
});

test('the client can never leave the choice buttons permanently disabled', () => {
  assert.ok(app.includes('let turnInFlight=false'), 'a double-submission guard exists');
  const submit = app.slice(app.indexOf('async function submitChoice'), app.indexOf('async function submitChoice') + 2200);
  assert.ok(submit.includes('finally{'), 'the submit path always restores state');
  assert.ok(submit.includes('buttons.forEach(button=>button.disabled=false)') || submit.includes('document.querySelectorAll(\'.choice\')'), 'buttons are re-enabled');
  assert.ok(submit.includes('await openCampaign(campaign.id)'), 'the authoritative scene is reloaded rather than patched client-side');
  assert.ok(/status===409|conflict/.test(submit), 'conflict responses are recognised');
  assert.ok(indexHtml.includes('id="notice" class="notice" role="status"'), 'turn outcomes are announced through a live region');
});

test('the resolved turn outcome survives the authoritative reload', () => {
  const submit = app.slice(app.indexOf('let turnInFlight=false;'), app.indexOf('const maneuverBar'));
  const reload = submit.indexOf('await openCampaign(campaign.id)');
  const outcome = submit.indexOf('advanced \\u00b7 Day');
  assert.ok(reload > -1, 'the submit path reloads the authoritative scene');
  assert.ok(outcome > reload, 'the outcome notice is written after the reload, because opening a campaign clears the notice');
  assert.ok(
    !/notice\(`Turn \$\{data\.turn\} advanced/.test(submit.slice(0, reload)),
    'the outcome is no longer written before the reload that clears it',
  );
  assert.ok(submit.includes("notice('That scene had already moved on."), 'a stale scene is reported after the reload');
});
