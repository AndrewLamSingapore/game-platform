export const PRODUCTION_SUPABASE_URL = 'https://vtrfgckzpjgtmqsnumur.supabase.co';
const PRODUCTION_KEY = 'sb_publishable_zsgA314WZue1tlu_Kt-SDQ_UopdKMNs';
export function gameBackend(env = process.env) {
  const preview = env.VERCEL_ENV === 'preview';
  const url = String(env.GAME_SUPABASE_URL || (preview ? '' : PRODUCTION_SUPABASE_URL)).replace(/\/$/, '');
  const key = env.GAME_SUPABASE_PUBLISHABLE_KEY || (preview ? '' : PRODUCTION_KEY);
  if (!url || !key || (preview && url === PRODUCTION_SUPABASE_URL)) return null;
  return { url, key, region: env.GAME_SUPABASE_FUNCTION_REGION || (preview ? '' : 'ap-southeast-1') };
}
