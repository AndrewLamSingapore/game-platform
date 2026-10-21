import test from 'node:test';
import assert from 'node:assert/strict';
import simulate from '../api/simulate.js';
import { simulateScenario } from '../server/services/portfolioSimulation.js';
import { publishPortfolioEvent } from '../server/services/portfolioEventClient.js';

const spec = { seed: 'sovereign-fixture', iterations: 20, baseline: 10, volatility: 2 };
const token = 'fixture-token';
const baseEnv = {
  PORTFOLIO_SIMULATION_TOKEN: token, SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: '',
  PORTFOLIO_RELAY_URL: '', PORTFOLIO_RELAY_TOKEN: '',
  PRIME_BASE_URL: '', PRIME_EVENT_URL: '', PRIME_SPINE_TOKEN: '',
};
const relay = { PORTFOLIO_RELAY_URL: 'https://relay.fixture.invalid', PORTFOLIO_RELAY_TOKEN: token };
async function fixture(settings, fetchImpl, run) {
  const values = { ...baseEnv, ...settings };
  const previous = Object.fromEntries(Object.keys(values).map(key => [key, process.env[key]]));
  const previousFetch = global.fetch;
  Object.assign(process.env, values); global.fetch = fetchImpl;
  try { return await run(); }
  finally {
    global.fetch = previousFetch;
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
}
async function request(body = spec, authorization = `Bearer ${token}`) {
  const res = { statusCode: 200, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(n) { this.statusCode = n; return this; }, json(v) { this.body = v; return this; } };
  await simulate({ method: 'POST', headers: { authorization }, body }, res);
  return res;
}
function assertLocalSuccess(res) {
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.deepEqual(res.body.result, simulateScenario(spec));
  assert.equal(res.body.result.authoritative, false);
  assert.equal(res.body.result.real_world_proof, false);
}

test('simulation remains available without any optional portfolio services', async () => {
  await fixture({}, async () => { throw Error('network must not execute'); }, async () => {
    const res = await request(); assertLocalSuccess(res);
    assert.equal(res.body.portfolio_fabric.queued.queued, false);
    assert.equal(res.body.portfolio_fabric.degraded, true);
  });
});
for (const [label, fail] of [
  ['offline', async () => { throw Error('private diagnostic fixture marker'); }],
  ['HTTP unavailable', async () => Response.json({}, { status: 503 })],
]) {
  test(`optional relay ${label} does not discard the local simulation`, async () => {
    await fixture(relay, fail, async () => {
      const res = await request(); assertLocalSuccess(res);
      assert.equal(res.body.portfolio_fabric.degraded, true);
      assert.equal(res.body.portfolio_fabric.queued.queued, false);
      assert.equal(res.body.portfolio_fabric.delivery.delivered, 0);
      assert.equal(JSON.stringify(res.body).includes('private diagnostic fixture marker'), false);
    });
  });
}
for (const queued of [false, 'true', undefined]) {
  test(`relay acknowledgements must explicitly be boolean true (${String(queued)})`, async () => {
    await fixture(relay, async () => Response.json({ queued }), async () => {
      const res = await request(); assertLocalSuccess(res);
      assert.equal(res.body.portfolio_fabric.queued.queued, false);
      assert.equal(res.body.portfolio_fabric.delivery.relayed || 0, 0);
      assert.equal(res.body.portfolio_fabric.degraded, true);
    });
  });
}
test('an acknowledged relay is reported as queued, not delivered', async () => {
  await fixture(relay, async (_url, options) => {
    assert.ok(options.signal instanceof AbortSignal);
    return Response.json({ queued: true });
  }, async () => {
    const res = await request(); assertLocalSuccess(res);
    assert.equal(res.body.portfolio_fabric.queued.queued, true);
    assert.equal(res.body.portfolio_fabric.delivery.relayed, 1);
    assert.equal(res.body.portfolio_fabric.delivery.delivered, 0);
    assert.equal(res.body.portfolio_fabric.degraded, false);
  });
});
test('local durability remains explicit when optional delivery is unavailable', async () => {
  let calls = 0;
  await fixture({ SUPABASE_URL: 'https://outbox.fixture.invalid', SUPABASE_SERVICE_ROLE_KEY: token }, async (_url, options) => {
    calls += 1; assert.ok(options.signal instanceof AbortSignal);
    return options.method === 'POST' ? Response.json([{ event_id: 'fixture' }]) : Response.json({}, { status: 503 });
  }, async () => {
    const res = await request(); assertLocalSuccess(res);
    assert.equal(calls, 2);
    assert.equal(res.body.portfolio_fabric.queued.queued, true);
    assert.equal(res.body.portfolio_fabric.delivery.delivered, 0);
    assert.equal(res.body.portfolio_fabric.degraded, true);
  });
});
test('a stalled optional relay is aborted and cannot hold the simulation indefinitely', async () => {
  let aborted = false;
  await fixture(relay, async (_url, options) => {
    assert.ok(options.signal instanceof AbortSignal);
    return new Promise((resolve, reject) => {
      const guard = setTimeout(() => reject(Error('fixture exceeded bounded request')), 6000);
      const abort = () => { aborted = true; clearTimeout(guard); reject(options.signal.reason); };
      if (options.signal.aborted) abort(); else options.signal.addEventListener('abort', abort, { once: true });
    });
  }, async () => {
    const res = await request(); assertLocalSuccess(res);
    assert.equal(aborted, true);
    assert.equal(res.body.portfolio_fabric.queued.queued, false);
    assert.equal(res.body.portfolio_fabric.degraded, true);
  });
});
test('real invalid scenarios and unauthorized requests retain their failure status', async () => {
  let calls = 0;
  await fixture(relay, async () => { calls += 1; throw Error('unexpected network'); }, async () => {
    const invalid = await request({ strategies: [{}] }); assert.equal(invalid.statusCode, 422); assert.equal(invalid.body.ok, false);
    const unauthorized = await request(spec, 'Bearer wrong-fixture'); assert.equal(unauthorized.statusCode, 401);
    assert.equal(calls, 0);
    await assert.rejects(publishPortfolioEvent({}), /schema_version is required/);
  });
});