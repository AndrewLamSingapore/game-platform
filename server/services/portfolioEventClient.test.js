import assert from 'node:assert/strict';
import { enqueueViaRelay, sendPortfolioEvent } from './portfolioEventClient.js';
import { asPortfolioEvent, simulateScenario } from './portfolioSimulation.js';

const event = asPortfolioEvent(simulateScenario({ seed: 'client-test', iterations: 10 }));
const missing = await sendPortfolioEvent(event, { url: '', token: '' });
assert.equal(missing.sent, false);

let request;
const sent = await sendPortfolioEvent(event, {
  url: 'https://prime.example/api/cognitive/events', token: 'test',
  fetchImpl: async (url, options) => { request = { url, options }; return { ok: true, json: async () => ({ accepted: true }) }; },
});
assert.equal(sent.sent, true);
assert.equal(JSON.parse(request.options.body).schema_version, '1.0.0');

const relayed = await enqueueViaRelay(event, {
  url: 'https://portal.example/api/portfolio-relay', token: 'relay-secret',
  fetchImpl: async (url, options) => {
    request = { url, options };
    return { ok: true, json: async () => ({ queued: true }) };
  },
});
assert.equal(relayed.queued, true);
assert.equal(request.options.headers.authorization, 'Bearer relay-secret');
assert.equal(JSON.parse(request.options.body).action, 'publish');
console.log('portfolio event client tests passed');
