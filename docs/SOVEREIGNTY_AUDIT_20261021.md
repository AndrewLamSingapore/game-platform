# GAME PLATFORM independent audit — 21 October 2026

**Completion classification: PARTIALLY COMPLETE.**

This is an engineering audit, not an owner-verified portfolio status promotion.
Owning source: `AndrewLamSingapore/game-platform`, clean initial `main`
`b11a0f949fcd5e0766ab99110c2130ec9b6d312c`. Work is isolated on
`codex/sovereign-five-20261021-091215`. The portfolio's canonical ORQEVIA main was
independently resolved by the coordinating agent at
`9703c9b5df92ba266acf56bfb19d85f3e10bc739`; its records do not replace this
repository's code or runtime observations.

## Product and architecture established from code

The implemented product is Living Worlds: a temporary public guest preview of a
persistent, AI-assisted RPG. `index.html` and `app.js` implement starter/custom
campaign creation, saved-world navigation, a scene/transcript, three decisions,
characters, inventory/equipment, quests, faction/memory panels, world time,
combat controls, invitations and membership. `experience.js`, `cinematics.js`
and the local assets provide sound/scene presentation. It is a static browser
application rather than a framework app requiring a compile step.

`app.js` obtains public backend settings from `api/runtime-config.js` and creates
an anonymous Supabase session. The product owns the dedicated Supabase project
recorded in `lib/game-backend.js`; no other portfolio repository supplies its
campaign state or authorization. Preview requires a separately configured
project. Browser continuity is storage-bound; clearing browser storage can lose
guest access. Account migration or a cross-device recovery flow was not verified.

The primary turn path is browser `src/turn-client.js` -> authenticated
`supabase/functions/gm-turn/index.ts` -> membership/scene-version/idempotency
reservation -> bounded narration -> authoritative state writes -> committed
SSE result -> snapshot reconciliation. Narration is served by `api/narrate.js`,
with database quota admission and a deterministic prose fallback when model
services fail. Provisional text is never the final turn result.

`game-action` owns equipment, combat, rules, quest and invite operations;
`join-campaign` validates invite claims. SQL migrations own durable state and RLS.
The GM guard covers GM turns, not all game-action mutations. Independent writes
share a completion barrier but are not one database transaction. A failure
response does not prove that every preceding write rolled back. The current
suite validates failure signalling and reservation release, not universal
transactional recovery.

Vercel owns the static/API deployment; Supabase owns Auth/Postgres/Edge services.
`vercel.json` has no commissioned cron. `api/portfolio-events.js` is an
authenticated manual outbox endpoint. `api/health.js` explicitly reports
configuration health and says it does not execute an end-to-end game turn.

## Baseline and validated repairs

| Check | Outcome and evidence |
|---|---|
| Repository identity | PASS — canonical origin, clean main and exact commit recorded above |
| Local toolchain | PASS — Node 24.20.0, npm 11.19.0; repository requires Node >=22, CI uses 24 |
| Clean locked install | PASS — isolated `npm ci`, 11 packages, audit reported zero vulnerabilities |
| Existing tests before changes | PASS — all commands in `npm test`; includes executable real-handler fixtures and several source-contract checks |
| Base status/ownership consistency | PASS — `python scripts/check_status_authority.py` |
| Public credential class safety | FAIL at baseline, repaired in `752318fdbbbd8c3326c4988109822b6bf7c22a28`; a synthetic server-only key was returned by unauthenticated runtime-config before the fix; all five actual-handler regressions pass after it |
| Empty database replay | FAIL at baseline — `0005` references nonexistent `e.kind` |
| Candidate schema recovery | PASS locally — `scripts/schema-recovery.mjs`, real PostgreSQL 17.11/pgvector; 28 historical files plus explicit compatibility ordering |
| Existing data preservation | PASS locally — legacy identities/values preserved; repeated repair retains data fingerprints and constraint definition |
| Starter-world database workflow | PASS locally — authenticated owner insert produces 11 entities/stats, 6 inventory items, 10 quests, 1 session, 10 living NPCs and 1 clock |
| Tenant/actor database controls | PASS locally — outsider reads/writes and audit forgery denied; canonical and historical audit actor formats tested |
| State/turn controls | PASS locally — correlated events/SOCIAL memory, stable transcript snapshot, one active GM guard, stale-scene rejection and narration quota admission |
| Local backup and restore | PASS locally — pg_dump/pg_restore into an independent empty database preserves state fingerprints and outsider RLS |
| Production health observation | PASS, limited — passive smoke observed revision `b11a0f949fcd5e0766ab99110c2130ec9b6d312c`; configuration only |
| Candidate production deployment | NOT TESTED — no push, merge, migration or deployment was performed |
| Browser -> real Auth -> Edge -> database gameplay | NOT TESTED in this audit — live writes/paid generation were not authorized for testing; database identity fixtures do not establish this gate |
| Production backup/restore and incident recovery | NOT TESTED — cloud retention, restoration permissions and recovery objectives were not established |
| Optional simulation relay failure | FAIL at baseline — real simulation handler returns 422 and discards local results when only the optional relay fails; tracked for a separate repair |

## Security findings and limits

The repaired backend resolver permits documented publishable keys and legacy
anon JWTs, rejecting secret/service-role/session-token classes before browser
configuration or narration can use them. It classifies public credentials;
Supabase still performs cryptographic validation and authorization. No real
secrets were read or emitted for these tests. Synthetic fixture values are not
credentials. RLS, server-only environment separation, quota admission, the CORS
allow-list, and JWT checks in the source remain required.

The recovery patch also fixes an actual audit privacy/readability mismatch:
new Action Envelopes write `actor_id`, while the historical RLS policy only reads
`actor.id`. The new predicate requires both membership and the matching actor,
prioritizes the canonical field if both appear, and retains historical records.
The baseline omission and post-fix actor isolation are executed against Postgres.

Remaining security/operational gates include actual Supabase Auth/JWT and
PostgREST commissioning, database advisor results, secret lifecycle/rotation,
branch protections, dependency advisory monitoring, and production observation.
The Supabase browser and Edge imports use mutable `@2` CDN references, outside
the npm lockfile. Pinning and testing an exact served revision is a supply-chain
hardening gap. The current security header set includes nosniff, strict referrer
policy and frame denial; a tested CSP was not established.

## Sovereignty and genuine completion gaps

No core source imports a sibling repository. Required runtime dependencies are
this product's Vercel deployment, its own Supabase services, and its browser
module source. Model service failure has an existing deterministic narrative
fallback. Authority Engine evidence is a bounded optional read-only adapter
with an explicit unavailable response. Portfolio relay delivery is now isolated
behind one shared two-second deadline; the simulation returns its identical local
result when optional delivery fails, with explicit queue/delivery status and no
claim of durability without an acknowledgement. Invalid scenarios and failed
authorization still fail. See `tests/simulation-sovereignty.test.mjs`.

The source's competitive libraries (`src/competitive/*`) implement bounded FSM,
telemetry, Elo/ranking and anomaly functions with unit tests. Search results show
no application/API/Edge consumer of those modules beyond tests. Their tables and
architecture document do not establish reachable competitive match execution,
a matchmaking service, rating workers or a replay UI. The baseline README described more operational integration than the owning
executable paths demonstrate. Candidate README/architecture text now scopes these
as tested primitives and integration contracts; the missing services remain a
product gap before selling that capability.

Historical `0004` version collisions remain intact. The verified local recovery
runner handles ordering by full filename with an early compatibility prelude;
it does not repair remote Supabase history. Ordinary fresh CLI installation and
actual deployed-service recovery remain open gates. See `DATABASE_RECOVERY.md`.

Commercial readiness additionally lacks measured operating/model/video costs,
service-level objectives, actual end-to-end accessibility/device acceptance,
customer onboarding/support evidence and verified guest recovery. Existing
README correctly calls the product a working prototype and does not assert
commercial adoption. No invented launch revenue, user count or SLA is claimed.

## Retired-system reference classification

- `contracts/*` and generated validators contain historical JARVIS titles,
  `prime` source IDs and the parked product's enum value. These are versioned,
  hashed contract compatibility, not an active centralized runtime. Do not
  rewrite their bytes independently of the owning contract and consumers.
- The outdated owner-rule pointer in `AGENTS.md` now names ORQEVIA.
- `PRIME_*` environment names in the optional event client/health are legacy
  ORQEVIA integration compatibility. They are not core game dependencies.
  A reviewed ORQEVIA-named alias migration can retire them without destroying
  existing deployments; no credentials or infrastructure identifiers were renamed.
- Public `/jarvis` links remain compatibility navigation to the current ORQEVIA
  walkthrough. Public text already labels ORQEVIA. Renaming routes in another
  repository is outside this product's scope.
- `SSOT` appears in checks preventing retired status files/banner restoration.
  Those negative guards and audit history are retained.
- VELYQUA was not opened, modified, deployed or made a new dependency.

## Verification boundaries and next gates

The candidate changes are reversible source changes on an isolated branch.
No production credentials, live player data, existing deployments, parked
repository or original working tree was modified. `npm test` passing does not
establish live readiness. The new database CI job is source configuration only
until an actual remote run is recorded.

Review/merge the local credential, recovery and optional-relay repairs through
existing gates, then obtain authorized isolated Supabase/Vercel commissioning and a full guest creation ->
decision -> reload -> membership/failure -> recovery acceptance run. Compare
schema/history and advisors before a production migration, retain rollback
artifacts, and record the target revision. Competitive scope and commercial
acceptance require owning-product decisions and executable evidence.