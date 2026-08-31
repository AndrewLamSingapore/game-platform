const REQUIRED = ['event_id','event_type','occurred_at','match_id','actor_id','sequence','source'];
const SOURCES = new Set(['GAME_SERVER','BOT_RUNTIME','SYSTEM_JOB']);

export function createGameEvent(input) {
  const event = {
    schema_version: 1,
    event_id: input.event_id,
    event_type: input.event_type,
    occurred_at: input.occurred_at,
    received_at: input.received_at ?? new Date().toISOString(),
    match_id: input.match_id,
    actor_id: input.actor_id,
    sequence: input.sequence,
    source: input.source,
    bot_version: input.bot_version ?? null,
    ruleset_version: input.ruleset_version ?? null,
    map_version: input.map_version ?? null,
    random_seed: input.random_seed ?? null,
    payload: structuredClone(input.payload ?? {})
  };
  validateGameEvent(event);
  return Object.freeze(event);
}

export function validateGameEvent(event) {
  for (const key of REQUIRED) if (event[key] === undefined || event[key] === null || event[key] === '') throw new TypeError(`missing_${key}`);
  if (event.schema_version !== 1) throw new RangeError('unsupported_schema_version');
  if (!SOURCES.has(event.source)) throw new RangeError('untrusted_event_source');
  if (!Number.isSafeInteger(event.sequence) || event.sequence < 0) throw new RangeError('invalid_sequence');
  if (Number.isNaN(Date.parse(event.occurred_at))) throw new RangeError('invalid_occurred_at');
  if (event.payload === null || Array.isArray(event.payload) || typeof event.payload !== 'object') throw new TypeError('invalid_payload');
  return true;
}

export function orderEvents(events) {
  return [...events].sort((a,b) => a.sequence-b.sequence || a.event_id.localeCompare(b.event_id));
}
