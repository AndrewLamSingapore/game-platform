import { assertContract } from './generated/portfolio-contracts.js';

const OPTIONAL_DELIVERY_TIMEOUT_MS = 2000;

function configuration() {
  return {
    supabaseUrl: process.env.SUPABASE_URL,
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    primeUrl: process.env.PRIME_EVENT_URL || (process.env.PRIME_BASE_URL ? `${process.env.PRIME_BASE_URL.replace(/\/$/, '')}/api/cognitive/events` : ''),
    primeToken: process.env.PRIME_SPINE_TOKEN,
    relayUrl: process.env.PORTFOLIO_RELAY_URL,
    relayToken: process.env.PORTFOLIO_RELAY_TOKEN,
  };
}

async function supabase(path, { method = 'GET', body, fetchImpl = fetch, signal = AbortSignal.timeout(OPTIONAL_DELIVERY_TIMEOUT_MS) } = {}) {
  const { supabaseUrl, serviceKey } = configuration();
  if (!supabaseUrl || !serviceKey) throw new Error('Supabase outbox is not configured');
  const response = await fetchImpl(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/${path}`, {
    method,
    signal,
    headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}`, 'content-type': 'application/json', prefer: 'resolution=ignore-duplicates,return=representation' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Supabase outbox request failed: ${response.status}`);
  const text = await response.text();
  return text ? JSON.parse(text) : [];
}

export async function enqueueViaRelay(event, { url = configuration().relayUrl, token = configuration().relayToken, fetchImpl = fetch, signal = AbortSignal.timeout(OPTIONAL_DELIVERY_TIMEOUT_MS) } = {}) {
  assertContract('portfolio-event-v1', event);
  if (!url) return { queued: false, reason: 'PORTFOLIO_RELAY_URL not configured', event_id: event.event_id };
  if (!token) return { queued: false, reason: 'PORTFOLIO_RELAY_TOKEN not configured', event_id: event.event_id };
  const response = await fetchImpl(url, {
    method: 'POST',
    signal,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ action: 'publish', event }),
  });
  if (!response.ok) throw new Error(`Portfolio relay request failed: ${response.status}`);
  const payload = await response.json();
  const queued = payload?.queued === true;
  return { queued, event_id: event.event_id, relay: true, ...(queued ? {} : { reason: 'relay_did_not_acknowledge_queue' }) };
}

export async function enqueuePortfolioEvent(event, { fetchImpl = fetch, signal = AbortSignal.timeout(OPTIONAL_DELIVERY_TIMEOUT_MS) } = {}) {
  assertContract('portfolio-event-v1', event);
  const { supabaseUrl, serviceKey, relayUrl, relayToken } = configuration();
  if ((!supabaseUrl || !serviceKey) && relayUrl && relayToken) return enqueueViaRelay(event, { fetchImpl, signal });
  try {
    await supabase('portfolio_event_outbox?on_conflict=event_id', { method: 'POST', body: { event_id: event.event_id, event_json: event }, fetchImpl, signal });
    return { queued: true, event_id: event.event_id, relay: false };
  } catch (error) {
    if (relayUrl && relayToken) return enqueueViaRelay(event, { fetchImpl, signal });
    return { queued: false, event_id: event.event_id, reason: String(error?.message || error) };
  }
}

export async function sendPortfolioEvent(event, { url = configuration().primeUrl, token = configuration().primeToken, fetchImpl = fetch, signal = AbortSignal.timeout(OPTIONAL_DELIVERY_TIMEOUT_MS) } = {}) {
  assertContract('portfolio-event-v1', event);
  if (!url || !token) {
    const relay = await enqueueViaRelay(event, { fetchImpl, signal });
    return relay.queued ? { sent: true, queued: true, relay: true } : { sent: false, reason: relay.reason };
  }
  const response = await fetchImpl(url, { method: 'POST', signal, headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify(event) });
  if (!response.ok) throw new Error(`PRIME event ingestion failed: ${response.status}`);
  return { sent: true, response: await response.json(), relay: false };
}

export async function deliverPortfolioOutbox({ limit = 20, fetchImpl = fetch, signal = AbortSignal.timeout(OPTIONAL_DELIVERY_TIMEOUT_MS) } = {}) {
  const capped = Math.max(1, Math.min(Number(limit) || 20, 100));
  let rows;
  try {
    rows = await supabase(`portfolio_event_outbox?status=in.(PENDING,RETRY)&next_attempt_at=lte.${encodeURIComponent(new Date().toISOString())}&order=created_at.asc&limit=${capped}`, { fetchImpl, signal });
  } catch (error) {
    return { processed: 0, delivered: 0, dead: 0, reason: String(error?.message || error) };
  }
  let delivered = 0;
  let dead = 0;
  for (const row of rows) {
    try {
      const sent = await sendPortfolioEvent(row.event_json, { fetchImpl, signal });
      if (!sent.sent) throw new Error(sent.reason);
      await supabase(`portfolio_event_outbox?event_id=eq.${encodeURIComponent(row.event_id)}`, { method: 'PATCH', body: { status: 'DELIVERED', attempts: Number(row.attempts || 0) + 1, delivered_at: new Date().toISOString(), last_error: null }, fetchImpl, signal });
      delivered += 1;
    } catch (error) {
      const attempts = Number(row.attempts || 0) + 1;
      const status = attempts >= 8 ? 'DEAD' : 'RETRY';
      const delay = Math.min(3600, 15 * (2 ** Math.min(attempts, 8)));
      await supabase(`portfolio_event_outbox?event_id=eq.${encodeURIComponent(row.event_id)}`, { method: 'PATCH', body: { status, attempts, next_attempt_at: new Date(Date.now() + delay * 1000).toISOString(), last_error: String(error?.message || error).slice(0, 500) }, fetchImpl, signal });
      if (status === 'DEAD') dead += 1;
    }
  }
  return { processed: rows.length, delivered, dead };
}

export async function publishPortfolioEvent(event, { fetchImpl = fetch, signal = AbortSignal.timeout(OPTIONAL_DELIVERY_TIMEOUT_MS) } = {}) {
  // One shared deadline bounds enqueue and delivery together.
  // Invalid local events remain errors; only optional transport failures degrade.
  assertContract('portfolio-event-v1', event);
  let queued;
  try {
    queued = await enqueuePortfolioEvent(event, { fetchImpl, signal });
  } catch (error) {
    const timeout = signal.aborted || ['AbortError', 'TimeoutError'].includes(error?.name);
    queued = { queued: false, event_id: event.event_id, reason: timeout ? 'optional_portfolio_timeout' : 'optional_portfolio_unavailable' };
  }
  if (!queued.queued) {
    // Keep server diagnostics and credential-bearing URLs out of public results.
    const reason = queued.reason === 'relay_did_not_acknowledge_queue' ? queued.reason
      : queued.reason === 'optional_portfolio_timeout' ? queued.reason : 'optional_portfolio_unavailable';
    return { queued: { ...queued, reason }, delivery: { processed: 0, delivered: 0, dead: 0 }, degraded: true };
  }
  if (queued.relay) return { queued, delivery: { processed: 1, delivered: 0, relayed: 1, dead: 0 }, degraded: false };
  let delivery;
  try {
    delivery = await deliverPortfolioOutbox({ limit: 1, fetchImpl, signal });
  } catch {
    delivery = { processed: 0, delivered: 0, dead: 0, reason: 'optional_portfolio_delivery_unavailable' };
  }
  if (delivery.reason) delivery = { ...delivery, reason: 'optional_portfolio_delivery_unavailable' };
  return { queued, delivery, degraded: Boolean(delivery.reason) };
}
