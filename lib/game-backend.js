export const PRODUCTION_SUPABASE_URL = 'https://vtrfgckzpjgtmqsnumur.supabase.co';
const PRODUCTION_KEY = 'sb_publishable_zsgA314WZue1tlu_Kt-SDQ_UopdKMNs';

function isPublicBackendKey(key) {
  if (typeof key !== 'string' || key.length > 8192 || key.trim() !== key) return false;
  if (/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) return true;
  const parts = key.split('.');
  if (parts.length !== 3 || parts.some(part => !/^[A-Za-z0-9_-]+$/.test(part))) return false;
  try {
    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    // Classify legacy public keys; Supabase still validates signature and expiry.
    // A service_role key or a user's access token must never enter browser config.
    return header?.alg === 'HS256' && header?.typ === 'JWT' && payload?.role === 'anon';
  } catch {
    return false;
  }
}

export function gameBackend(env = process.env) {
  const preview = env.VERCEL_ENV === 'preview';
  const url = String(env.GAME_SUPABASE_URL || (preview ? '' : PRODUCTION_SUPABASE_URL)).replace(/\/$/, '');
  const key = env.GAME_SUPABASE_PUBLISHABLE_KEY || (preview ? '' : PRODUCTION_KEY);
  if (!url || !isPublicBackendKey(key)) return null;
  let parsed;
  try { parsed = new URL(url); } catch { return null; }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash) return null;
  if (preview && parsed.hostname === new URL(PRODUCTION_SUPABASE_URL).hostname) return null;
  return { url, key, region: env.GAME_SUPABASE_FUNCTION_REGION || (preview ? '' : 'ap-southeast-1') };
}