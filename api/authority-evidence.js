const UPSTREAM = 'https://authority-engine-app.vercel.app/api/game-platform-evidence';
const EXPECTED_SCHEMA = 'authority-game-platform-link-v1';
const EXPECTED_PRODUCT = 'GAME-PLATFORM';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=600');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3500);

  try {
    const upstream = await fetch(UPSTREAM, {
      headers: { Accept: 'application/json' },
      signal: controller.signal
    });

    if (!upstream.ok) throw new Error(`upstream_${upstream.status}`);

    const contract = await upstream.json();
    const valid =
      contract?.schema_version === EXPECTED_SCHEMA &&
      contract?.linked === true &&
      contract?.product?.id === EXPECTED_PRODUCT &&
      contract?.product?.evidence_level === 'E2' &&
      contract?.boundary?.mode === 'read-only-evidence' &&
      contract?.boundary?.operational_dependency === false &&
      contract?.boundary?.permits_mutation === false &&
      contract?.boundary?.permits_approval === false;

    if (!valid) throw new Error('contract_invalid');

    return res.status(200).json({
      linked: true,
      integration: 'game-platform-to-authority-engine',
      contract,
      checked_at: new Date().toISOString()
    });
  } catch (error) {
    return res.status(200).json({
      linked: false,
      degraded: true,
      integration: 'game-platform-to-authority-engine',
      reason: error?.name === 'AbortError' ? 'authority_timeout' : 'authority_unavailable',
      operational_impact: 'none',
      checked_at: new Date().toISOString()
    });
  } finally {
    clearTimeout(timeout);
  }
}
