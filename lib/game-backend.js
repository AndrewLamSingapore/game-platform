export const PRODUCTION_SUPABASE_URL = 'https://vtrfgckzpjgtmqsnumur.supabase.co';
const PRODUCTION_KEY = 'sb_publishable_zsgA314WZue1tlu_Kt-SDQ_UopdKMNs';
export function gameBackend(env = process.env) {
  const preview = env.VERCEL_ENV === 'preview';
  const url = String(env.GAME_SUPABASE_URL || (preview ? '' : PRODUCTION_SUPABASE_URL)).replace(/\/$/, '');
  const key = env.GAME_SUPABASE_PUBLISHABLE_KEY || (preview ? '' : PRODUCTION_KEY);
  if (!url || !key) return null;
  let parsed;try{parsed=new URL(url);}catch{return null;}
  if(parsed.protocol!=='https:'||parsed.username||parsed.password||parsed.pathname!=='/'||parsed.search||parsed.hash)return null;
  if(preview&&parsed.hostname===new URL(PRODUCTION_SUPABASE_URL).hostname)return null;
  return { url, key, region: env.GAME_SUPABASE_FUNCTION_REGION || (preview ? '' : 'ap-southeast-1') };
}
