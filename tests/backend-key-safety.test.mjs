import test from 'node:test';
import assert from 'node:assert/strict';
import { gameBackend } from '../lib/game-backend.js';
import runtimeConfig from '../api/runtime-config.js';
import health from '../api/health.js';
import narrate from '../api/narrate.js';

const publicKey = 'sb_publishable_fixture_not_a_real_credential';
const privateKey = 'sb_secret_fixture_not_a_real_credential';
const legacyKey = role => [
  Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'),
  Buffer.from(JSON.stringify({ iss: 'supabase', role })).toString('base64url'),
  'fixture-signature',
].join('.');
const backendEnv = key => ({
  VERCEL_ENV: 'preview',
  GAME_SUPABASE_URL: 'https://isolated.supabase.co',
  GAME_SUPABASE_PUBLISHABLE_KEY: key,
});
function response() {
  return {
    headers: {}, statusCode: 200,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}
async function withEnvironment(values, run) {
  const previous = Object.fromEntries(Object.keys(values).map(key => [key, process.env[key]]));
  Object.assign(process.env, values);
  try { return await run(); }
  finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test('public backend accepts publishable keys and legacy anon keys only', () => {
  assert.equal(gameBackend(backendEnv(publicKey)).key, publicKey);
  const anon = legacyKey('anon');
  assert.equal(gameBackend(backendEnv(anon)).key, anon);
  assert.ok(gameBackend({ VERCEL_ENV: 'production' }));
  for (const key of [
    privateKey, legacyKey('service_role'), legacyKey('authenticated'),
    'fixture', 'sb_publishable_', 'sb_publishable_fixture\n',
    'eyJhbGciOiJIUzI1NiJ9.bm90LWpzb24.signature',
    `a.${Buffer.from(JSON.stringify({ role: 'anon' })).toString('base64url')}.c`,
    '', ' ', null, {},
  ]) assert.equal(gameBackend(backendEnv(key)), null);
});

test('runtime config rejects private and malformed keys without including the value', async () => {
  for (const key of [privateKey, legacyKey('service_role'), 'malformed-fixture']) {
    await withEnvironment(backendEnv(key), () => {
      const res = response();
      runtimeConfig({ method: 'GET' }, res);
      assert.equal(res.statusCode, 503);
      assert.equal(res.headers['Cache-Control'], 'no-store');
      assert.equal(res.body.supabaseKey, undefined);
      assert.equal(JSON.stringify(res.body).includes(key), false);
    });
  }
});

test('runtime config still supplies the isolated public backend', async () => {
  await withEnvironment(backendEnv(publicKey), () => {
    const res = response();
    runtimeConfig({ method: 'GET' }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.supabaseUrl, 'https://isolated.supabase.co');
    assert.equal(res.body.supabaseKey, publicKey);
  });
});

test('health fails closed for a private browser-backend credential', async () => {
  await withEnvironment(backendEnv(privateKey), async () => {
    const res = response();
    await health({ method: 'GET' }, res);
    assert.equal(res.statusCode, 503);
    assert.equal(res.body.backend_configured, false);
  });
});

test('narration rejects an unsafe backend before authentication or paid calls', async () => {
  await withEnvironment(backendEnv(privateKey), async () => {
    const previous = global.fetch;
    let networkCalls = 0;
    global.fetch = async () => { networkCalls += 1; throw Error('unexpected network'); };
    try {
      const res = response();
      await narrate({ method: 'POST', headers: { authorization: 'Bearer fixture' }, body: { campaign_id: 'fixture' } }, res);
      assert.equal(res.statusCode, 503);
      assert.equal(networkCalls, 0);
      assert.equal(JSON.stringify(res.body).includes(privateKey), false);
    } finally { global.fetch = previous; }
  });
});