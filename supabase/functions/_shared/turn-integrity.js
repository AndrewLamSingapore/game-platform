/**
 * Shared helpers for the authoritative Living Worlds turn path.
 *
 * The GM model proposes; the server disposes. These helpers keep three
 * server-side guarantees small, testable and identical across edge functions:
 *
 *  1. Browser origins are allow-listed instead of wildcarded.
 *  2. Model narration cannot smuggle mechanical values into the story.
 *  3. Schema/idempotency failures are classified consistently, so a degraded
 *     audit write never masquerades as a clean turn.
 *
 * Plain ESM with no Deno-specific or Node-specific APIs, so both the edge
 * functions and the Node test suite can import it.
 */

export const DEFAULT_ALLOWED_ORIGINS = ['https://game-platform-wine-nine.vercel.app'];

const LOCAL_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?$/;

/** Allow-list = origins configured through ALLOWED_ORIGIN plus the known app. */
export function allowedOrigins(configured = '') {
  const extra = String(configured || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  return [...new Set([...extra, ...DEFAULT_ALLOWED_ORIGINS])];
}

/**
 * Returns the origin to echo back, or null when the caller must not be granted
 * cross-origin access. Requests without an Origin header (server-to-server,
 * curl, smoke tests) return null and get no permissive header.
 */
export function resolveCorsOrigin(origin, configured = '') {
  const value = String(origin || '').trim();
  if (!value) return null;
  if (allowedOrigins(configured).includes(value)) return value;
  if (LOCAL_ORIGIN.test(value)) return value;
  return null;
}

export function corsHeadersFor(origin, base = {}) {
  return { ...base, 'Access-Control-Allow-Origin': origin || 'null', Vary: 'Origin' };
}

/**
 * Mechanical tokens the narrative must never carry. Ordered longest-match
 * first so a phrase such as "loses 3 HP" is reported as one mechanical effect.
 */
const MECHANICAL_RULES = [
  [/\b(?:lose|loses|losing|lost|gain|gains|gaining|heal|heals|healing|deal|deals|dealt|take|takes|taking)\s+\d+\s*(?:hp|hit\s*points?|damage)\b/gi, 'mechanical effect'],
  [/\b(?:hit\s*points?|hp|ac|dc|xp|cr|thac0)\b\s*[:=]?\s*[+-]?\d+(?:\s*\/\s*\d+)?/gi, 'mechanical value'],
  [/\b[+-]\d+\s*(?:hp|ac|dc|xp)\b/gi, 'mechanical modifier'],
  [/\b\d*\s*d\s*\d+(?:\s*[+-]\s*\d+)?\b/gi, 'dice notation'],
  [/\[[^\]]*\]/g, 'bracketed directive'],
  [/\b(?:roll|rolled|rolling)\s+(?:a\s+)?\d+/gi, 'roll result'],
];

/**
 * Strips mechanical values from model-authored narration.
 *
 * The deterministic fallback keeps its own explicitly signalled check text;
 * this sanitiser is applied to model output only, so that prose can describe
 * consequences without asserting numbers the resolver owns.
 */
export function sanitizeNarration(text, limit = 900) {
  const source = String(text ?? '');
  if (!source.trim()) return { text: '', removed: [], changed: false };

  let value = source;
  const removed = [];
  for (const [pattern, label] of MECHANICAL_RULES) {
    const matches = value.match(pattern);
    if (matches && matches.length) {
      removed.push(label);
      value = value.replace(pattern, ' ');
    }
  }

  const cleaned = value
    .replace(/\(\s*\)/g, '')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/([,.;:])\s*(?=[,.;:])/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, limit);

  return {
    text: cleaned,
    removed: [...new Set(removed)],
    changed: cleaned !== source.trim().slice(0, limit),
  };
}

/** Postgres/PostgREST codes that mean "this column or table is not deployed". */
export const MISSING_SCHEMA_CODES = new Set(['42P01', '42703', 'PGRST204', 'PGRST205']);

export function isMissingSchema(error) {
  return MISSING_SCHEMA_CODES.has(String(error?.code || ''));
}

/** Unique-violation: an idempotency key already exists for this campaign. */
export function isDuplicateKey(error) {
  return String(error?.code || '') === '23505';
}

/** Slim diagnostic block returned to the caller and stored with the turn. */
export function turnDiagnostics({ auditOk, narrationLint = [] }) {
  return {
    audit: auditOk ? 'recorded' : 'degraded',
    narration_lint: narrationLint,
  };
}
