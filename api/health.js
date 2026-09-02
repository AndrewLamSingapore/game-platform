export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  const directPrime = Boolean((process.env.PRIME_EVENT_URL || process.env.PRIME_BASE_URL) && process.env.PRIME_SPINE_TOKEN);
  const localOutbox = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
  const relay = Boolean(process.env.PORTFOLIO_RELAY_URL && process.env.PORTFOLIO_RELAY_TOKEN);
  return res.status(200).json({
    ok: true,
    product: 'game-platform',
    revision: process.env.VERCEL_GIT_COMMIT_SHA || null,
    simulation: 'bounded-v1',
    portfolio_outbox: localOutbox || relay,
    portfolio_relay: relay,
    prime_delivery: directPrime || relay,
    ai_degradation: 'deterministic-fallback-v1',
  });
}
