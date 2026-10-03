import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';

// Run the real Edge handler, not a copied decision function. Strip TypeScript
// annotations and substitute only Deno/Supabase transport boundaries. No live
// credentials, network requests, or production database are involved.
const source = readFileSync(new URL('../supabase/functions/gm-turn/index.ts', import.meta.url), 'utf8');
const helperSource = readFileSync(new URL('../supabase/functions/_shared/turn-integrity.js', import.meta.url), 'utf8');
const helperUrl = 'data:text/javascript,' + encodeURIComponent(helperSource);
const helpers = await import(helperUrl);

function edgeHarness(reservationError, priorResult = null) {
  const calls = [];
  let handler;
  const chain = (terminal, label) => ({
    select(...args) { calls.push(label + '.select'); return this; },
    eq(...args) { calls.push(label + '.eq'); return this; },
    single() { calls.push(label + '.single'); return terminal; },
    maybeSingle() { calls.push(label + '.maybeSingle'); return terminal; },
  });
  const userDb = {
    auth: { async getUser() { calls.push('auth.getUser'); return { data: { user: { id: 'fixture-user' } } }; } },
    async rpc(name) {
      calls.push('user.rpc:' + name);
      if (name !== 'campaign_role') throw new Error('unexpected user RPC');
      return { data: 'OWNER' };
    },
    from(table) {
      calls.push('user.from:' + table);
      if (table !== 'campaigns') throw new Error('unexpected user table: ' + table);
      return chain(Promise.resolve({ data: { id: 'campaign-1', title: 'Fixture', world_state: {} } }), 'campaigns');
    },
  };
  const admin = {
    from(table) {
      calls.push('admin.from:' + table);
      if (table !== 'game_audit_log') throw new Error('mutation before durable reservation: ' + table);
      return {
        async insert() {
          calls.push('audit.insert');
          return { error: reservationError };
        },
        select() {
          calls.push('audit.select');
          return chain(Promise.resolve({ data: priorResult ? { decision_record: { result: priorResult } } : null }),
                       'audit.replay');
        },
      };
    },
    async rpc(name) {
      calls.push('admin.rpc:' + name);
      throw new Error('turn claim before durable reservation');
    },
  };
  const stripped = stripTypeScriptTypes(source.replace(/^import .*;\r?\n/gm, ''));
  const sandbox = {
    Deno: {
      env: { get(name) { return ({ SUPABASE_URL: 'https://fixture.invalid',
                                SUPABASE_ANON_KEY: 'fixture-anon',
                                SUPABASE_SERVICE_ROLE_KEY: 'fixture-service' })[name] || ''; } },
      serve(fn) { handler = fn; },
    },
    createClient(_url, key) { return key === 'fixture-service' ? admin : userDb; },
    reservationDisposition: helpers.reservationDisposition,
    resolveCorsOrigin: helpers.resolveCorsOrigin,
    sanitizeNarration: helpers.sanitizeNarration,
    turnDiagnostics: helpers.turnDiagnostics,
    Response, Request, crypto,
    fetch() { throw new Error('network call before durable reservation'); },
  };
  vm.runInNewContext(stripped, sandbox, { timeout: 1000, filename: 'gm-turn/index.ts' });
  assert.equal(typeof handler, 'function');
  return { handler, calls };
}

async function invoke(handler) {
  return handler(new Request('https://fixture.invalid/gm-turn', {
    method: 'POST',
    headers: { Authorization: 'Bearer fixture' },
    body: JSON.stringify({ campaign_id: 'campaign-1', action: 'Investigate', client_request_id: 'request-1' }),
  }));
}

for (const error of [
  { code: '42501', message: 'permission denied' },
  { code: '42P01', message: 'relation missing' },
  { code: 'PGRST205', message: 'schema cache unavailable' },
  { message: 'network unavailable' },
]) {
  test('real Edge handler fails closed before turn mutation on reservation error: ' + (error.code || 'transport'), async () => {
    const { handler, calls } = edgeHarness(error);
    const response = await invoke(handler);
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: 'turn_reservation_unavailable' });
    assert.equal(calls.filter((call) => call === 'audit.insert').length, 1);
    assert.ok(!calls.some((call) => call.startsWith('admin.rpc:')));
    assert.ok(!calls.some((call) => call.includes('game_sessions') || call.includes('campaign_entities')));
    assert.ok(!calls.some((call) => call.includes('.update') || call.includes('game_events')));
  });
}

test('real Edge handler preserves completed duplicate replay without mutation', async () => {
  const priorResult = { turn: 3, gm: 'Previously committed result.' };
  const { handler, calls } = edgeHarness({ code: '23505' }, priorResult);
  const response = await invoke(handler);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ...priorResult, replayed: true });
  assert.ok(calls.includes('audit.replay.maybeSingle'));
  assert.ok(!calls.some((call) => call.startsWith('admin.rpc:')));
});

test('real Edge handler reports an in-flight duplicate without mutation', async () => {
  const { handler, calls } = edgeHarness({ code: '23505' });
  const response = await invoke(handler);
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error, 'turn_in_flight');
  assert.ok(!calls.some((call) => call.startsWith('admin.rpc:')));
});
