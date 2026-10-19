import { gameBackend } from '../lib/game-backend.js';
import { consumeEvents, encodeEvent, partialNarrative } from '../supabase/functions/_shared/turn-stream.js';
const DEFAULT_MODEL = 'openai/gpt-5.4-nano';
const DEFAULT_FALLBACK_MODELS = ['google/gemini-3.6-flash', 'alibaba/qwen3.7-flash'];

const clean = (value, max = Infinity) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const norm = value => clean(value).toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const outputText = response => typeof response?.output_text === 'string'
  ? response.output_text
  : (response?.output || [])
      .filter(item => item?.type === 'message')
      .flatMap(item => item.content || [])
      .filter(item => item?.type === 'output_text' || item?.type === 'text')
      .map(item => item.text || '')
      .join('');

const narrativeSchema = {
  type: 'object',
  properties: {
    narrative: { type: 'string', maxLength: 900 },
    choices: { type: 'array', minItems:3,maxItems:3, items: { type: 'string', minLength: 8, maxLength: 160 } },
    quest: {
      anyOf: [
        { type: 'null' },
        {
          type: 'object',
          properties: {
            op: { type: 'string', enum: ['create', 'resolve'] },
            title: { type: 'string' },
            objective: { type: 'string' },
            status: { type: 'string', enum: ['OPEN', 'COMPLETED', 'FAILED'] },
          },
          required: ['op', 'title', 'objective', 'status'],
          additionalProperties: false,
        },
      ],
    },
    faction_updates: {
      type: 'array',
      maxItems: 4,
      items: {
        type: 'object',
        properties: { name: { type: 'string' }, delta: { type: 'integer', minimum: -10, maximum: 10 } },
        required: ['name', 'delta'],
        additionalProperties: false,
      },
    },
    npc_updates: {
      type: 'array',
      maxItems: 8,
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          agenda: { type: 'string' },
          disposition_delta: { type: 'integer', minimum: -5, maximum: 5 },
        },
        required: ['name', 'agenda', 'disposition_delta'],
        additionalProperties: false,
      },
    },
  },
  required: ['narrative', 'choices', 'quest', 'faction_updates', 'npc_updates'],
  additionalProperties: false,
};

function fallbackChoices(state, previousChoices, lastAction) {
  const place = clean(state.location || state.scene_label || 'the current scene', 80);
  const beat = Math.max(1, Number(state?.story_progression?.beat) || Number(state?.last_turn) || 1);
  const sets = [
    [`Follow the fresh trail away from ${place}`, 'Confront the person who moved while you were occupied', 'Seal the exposed route before the opposition can use it'],
    ['Shadow the opposition to learn where it regroups', 'Trade the new evidence for immediate help', `Abandon ${place} and seize the initiative elsewhere`],
    ['Set a trap using what the last move revealed', 'Split the party to pursue both urgent leads', 'Call out the hidden adversary and force an answer'],
    ['Rescue the witness before the next attack begins', 'Destroy the advantage the opposition just gained', 'Risk the dangerous passage that has just opened'],
  ];
  const candidates = [...sets[beat % sets.length], ...sets[(beat + 1) % sets.length], ...sets[(beat + 2) % sets.length]];
  const forbidden = new Set([...previousChoices, lastAction].map(norm).filter(Boolean));
  return candidates.filter(choice => !forbidden.has(norm(choice))).slice(0, 3);
}

export function deterministicFallback(context = {}, reason = 'gateway_unavailable') {
  const state = context?.campaign?.world_state || {};
  const previousChoices = Array.isArray(state.choices) ? state.choices.map(clean).filter(Boolean) : [];
  const lastAction = clean(context?.player_action, 240);
  const place = clean(state.location || state.scene_label || 'the contested ground', 100);
  const beat = Math.max(1, Number(state?.story_progression?.beat) || Number(state?.last_turn) || 1);
  const developments = [
    'The move exposes a trail leading away from the old confrontation. The opposition withdraws with something valuable, while a witness signals from a newly opened route.',
    'The balance breaks decisively. An ally is cut off, the safest route closes, and the opposition begins regrouping somewhere beyond sight.',
    'A hidden participant finally acts. New evidence changes the meaning of the last encounter, but recovering the truth now carries an immediate cost.',
    'The old standoff ends. A dangerous passage opens as the opposition loses control of the scene, forcing the party to choose what matters most.',
  ];
  return {
    narrative: clean(`At ${place}, ${developments[beat % developments.length]} The consequence is permanent; repeating the previous decision is no longer possible.`, 900),
    choices: fallbackChoices(state, previousChoices, lastAction),
    quest: null,
    faction_updates: [],
    npc_updates: [],
    generation: { mode: 'deterministic_fallback', reason },
  };
}

function gatewayModels() {
  const model = clean(process.env.GAME_NARRATION_MODEL || DEFAULT_MODEL, 120);
  const configured = clean(process.env.GAME_NARRATION_FALLBACK_MODELS || '', 500)
    .split(',').map(item => clean(item, 120)).filter(Boolean);
  return { model, fallbacks: configured.length ? configured : DEFAULT_FALLBACK_MODELS };
}

function validateOutput(out, previousChoices, lastAction) {
  out.narrative = clean(out.narrative, 900);
  out.choices = Array.isArray(out.choices) ? out.choices.map(value => clean(value, 160)).filter(Boolean).slice(0, 3) : [];
  const forbidden = new Set([...previousChoices, lastAction].map(norm).filter(Boolean));
  const unique = new Set(out.choices.map(norm));
  if (out.choices.length !== 3 || unique.size !== 3 || out.choices.some(value => forbidden.has(norm(value)))) {
    throw new Error('choices_repeat_previous_state');
  }
  out.faction_updates = Array.isArray(out.faction_updates) ? out.faction_updates.slice(0, 4) : [];
  out.npc_updates = Array.isArray(out.npc_updates) ? out.npc_updates.slice(0, 8) : [];
  out.generation = { mode: 'ai_gateway' };
  return out;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  const backend=gameBackend();if(!backend)return res.status(503).json({error:'preview_backend_not_configured'});
  const SUPABASE_URL=backend.url,SUPABASE_KEY=backend.key;
  res.setHeader('Cache-Control','no-store');
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return res.status(401).json({ error: 'unauthorized' });

  const userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, { signal:AbortSignal.timeout(5000),headers: { apikey: SUPABASE_KEY, Authorization: auth } });
  if (!userResponse.ok) return res.status(401).json({ error: 'unauthorized' });
  const user = await userResponse.json();
  const body = req.body || {};
  const campaignId = clean(body.campaign_id, 80);
  if (!campaignId) return res.status(400).json({ error: 'campaign_id_required' });

  const membershipResponse = await fetch(`${SUPABASE_URL}/rest/v1/campaign_members?campaign_id=eq.${encodeURIComponent(campaignId)}&user_id=eq.${encodeURIComponent(user.id)}&status=eq.ACTIVE&select=role&limit=1`, { signal:AbortSignal.timeout(5000),headers: { apikey: SUPABASE_KEY, Authorization: auth, Accept: 'application/json' } });
  if (!membershipResponse.ok) return res.status(403).json({ error: 'campaign_access_denied' });
  const memberships = await membershipResponse.json();
  if (!['OWNER', 'GM', 'PLAYER'].includes(memberships?.[0]?.role)) return res.status(403).json({ error: 'player_role_required' });

  const quota=await fetch(`${SUPABASE_URL}/rest/v1/rpc/admit_game_narration`,{method:'POST',headers:{apikey:SUPABASE_KEY,Authorization:auth,'Content-Type':'application/json'},body:JSON.stringify({p_campaign_id:campaignId}),signal:AbortSignal.timeout(5000)});
  if(!quota.ok)return res.status(503).json({error:'narration_admission_unavailable'});
  if(await quota.json()!==true){res.setHeader('Retry-After','60');return res.status(429).json({error:'narration_rate_limited'});}
  const streaming=String(req.headers.accept||'').includes('text/event-stream');
  let streamStarted=false;
  const emit=(event,data)=>{if(!streamStarted){res.setHeader('Content-Type','text/event-stream');res.setHeader('X-Accel-Buffering','no');res.flushHeaders?.();streamStarted=true;}res.write(encodeEvent(event,data));};
  const finish=value=>{if(!streaming)return res.status(200).json(value);emit('result',value);return res.end();};
  const context = body.context || {};
  const state = context?.campaign?.world_state || {};
  const previousChoices = Array.isArray(state.choices) ? state.choices.map(clean).filter(Boolean) : [];
  const lastAction = clean(context?.player_action);
  const serializedContext = JSON.stringify(context).slice(0, 12000);
  const prompt = `You are the AI GM for a persistent tabletop RPG. Continue the story forward from the player's selected action. Preserve canon, named characters, location, world time, NPC motivations, quests, factions, combat and checks. The selected action must cause a concrete visible consequence. Never reset or replay the previous scene. Return a vivid new situation and exactly three materially different next actions grounded in that new situation. Never reuse or lightly paraphrase a previous choice or the selected action. Previous choices: ${JSON.stringify(previousChoices)}. Selected action: ${JSON.stringify(lastAction)}. Progression: ${JSON.stringify(state.story_progression || {})}. Keep narrative <=900 characters. Each choice begins with an action verb. Campaign context: ${serializedContext}`;
  const token = process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN;
  if (!token) return finish(deterministicFallback(context, 'gateway_auth_unavailable'));

  const { model, fallbacks } = gatewayModels();
  try {
    const started = Date.now();
    const response = await fetch('https://ai-gateway.vercel.sh/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        stream: streaming,
        input: prompt,
        max_output_tokens: 1000,
        reasoning: { effort: 'low' },
        providerOptions: { gateway: { models: fallbacks, sort: ['cost','ttft','tps'].includes(process.env.GAME_NARRATION_PROVIDER_SORT)?process.env.GAME_NARRATION_PROVIDER_SORT:'ttft', user: user.id, tags: ['product:game-platform', 'feature:narration', 'env:production'] } },
        text: { format: { type: 'json_schema', name: 'gm_turn', strict: true, schema: narrativeSchema } },
      }),
      signal: AbortSignal.timeout(25000),
    });
    if (!response.ok) {
      const detail = clean(await response.text(), 300);
      console.error(JSON.stringify({ level: 'error', message: 'narration_gateway_failed', route: '/api/narrate', status: response.status, model, duration_ms: Date.now() - started, detail }));
      if ([402, 403, 429, 500, 502, 503, 504].includes(response.status)) return finish(deterministicFallback(context, `gateway_${response.status}`));
      return res.status(503).json({ error: 'ai_gm_unavailable' });
    }
    let raw, text;
    if(streaming){let full='',completed=false;
      await consumeEvents(response.body,(_event,event)=>{
        if(event.type==='response.output_text.delta'){full+=event.delta||'';if(full.length>30000)throw Error('model_output_too_large');const narrative=partialNarrative(full);if(narrative)emit('narrative',{text:narrative,provisional:true});}
        if(event.type==='response.completed'){completed=true;raw=event.response;}
        if(['response.failed','response.incomplete','error'].includes(event.type))throw Error('model_stream_failed');
      });
      if(!completed)throw Error('model_stream_incomplete');text=clean(full||outputText(raw));
    }else{raw=await response.json();text=clean(outputText(raw));}
    if (!text) throw new Error('empty_model_output');
    const out = validateOutput(JSON.parse(text), previousChoices, lastAction);
    console.log(JSON.stringify({ level: 'info', message: 'narration_completed', route: '/api/narrate', model: raw?.model || model, duration_ms: Date.now() - started }));
    return finish(out);
  } catch (error) {
    console.error(JSON.stringify({ level: 'error', message: 'narration_generation_failed', route: '/api/narrate', error: error instanceof Error ? error.message : String(error) }));
    return finish(deterministicFallback(context, 'gateway_exception'));
  }
}
