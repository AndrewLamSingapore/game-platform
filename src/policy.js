export const POLICY = Object.freeze({ AUTO:'AUTO', BOUNDED_AUTO:'BOUNDED_AUTO', GATED:'GATED', PROHIBITED:'PROHIBITED' });

const gated = new Set(['account.purchase','public.publish','campaign.export_external','moderation.override']);
const prohibited = new Set(['policy.bypass','cross_tenant.read','cross_tenant.write']);
const bounded = new Set(['world.mutate','economy.adjust','entity.retire']);

export function classifyAction(action){
  if(prohibited.has(action)) return POLICY.PROHIBITED;
  if(gated.has(action)) return POLICY.GATED;
  if(bounded.has(action)) return POLICY.BOUNDED_AUTO;
  return POLICY.AUTO;
}

export function authorize(envelope){
  if(!envelope?.tenant_id || !envelope?.correlation_id || !envelope?.idempotency_key) return {state:POLICY.PROHIBITED,reason:'invalid_action_envelope'};
  const state=classifyAction(envelope.action);
  return {state,reason: state===POLICY.PROHIBITED?'platform_policy':state===POLICY.GATED?'human_approval_required':state===POLICY.BOUNDED_AUTO?'bounded_campaign_mutation':'internal_narrative_action'};
}
