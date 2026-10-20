> Portfolio status: [STATUS.md](https://github.com/AndrewLamSingapore/orqevia/blob/main/STATUS.md) is the sole portfolio status reference. Each product owns its source, configuration, contracts and domain records. The [operational manifest](https://github.com/AndrewLamSingapore/orqevia/blob/main/governance/operational-manifest.json) provides dated ORQEVIA component and observation references; it does not establish deployment status.

# Game Platform

[**Open Living Worlds ↗**](https://game-platform-wine-nine.vercel.app/) · [**Discuss this project**](https://authority-engine-app.vercel.app/contact?source=game-platform) · [**Meet Andrew Lam**](https://authority-engine-app.vercel.app/about)

An independent working prototype of an AI-assisted persistent role-playing platform. Commercial adoption and outcomes are not asserted.

This product implements Shared Design Language v1 concepts independently. It owns its runtime, database, secrets and deployment. Optional portfolio event exchange and public navigation connect it to the wider work without transferring game authority.

## Connected work

[**Explore ORQEVIA**](https://authority-engine-app.vercel.app/jarvis) · [**Meet Andrew**](https://authority-engine-app.vercel.app/about) · [**Start a conversation**](https://authority-engine-app.vercel.app/contact?source=game-platform&intent=collaboration)

ORQEVIA’s public walkthrough connects this project to Andrew’s wider work. Public navigation and enquiries do not merge accounts, data or runtime authority. Current operational evidence comes from the canonical portfolio record; this README describes source capabilities.

## Product thesis

A persistent AI-native role-playing universe where the world remembers what the player did and consequences propagate through campaign state.

## Architecture

- GM Reasoner: bounded creative/stateful reasoner with deterministic fallback.
- Selective Cinematic Mode: pivotal turns can produce one cached Higgsfield AI video, with asynchronous jobs, per-user/campaign limits and text-first fallback.
- Campaign memory: episodic, semantic, decisions, quests and quest graph.
- Living entities: player-owned PCs, autonomous NPCs, factions and items.
- Game Systems v2: multiplayer roles/invites, world clock, rulesets, inventory/equipment, health and deterministic combat.
- Competitive AI runtime: deterministic FSM bots, immutable server-authored telemetry, shared Elo ratings, matchmaking, adaptive difficulty and asynchronous anomaly detection.
- Hard AI boundary: Living Characters and the Game Master never execute inside the authoritative competitive hot path.
- Stable Spine: Action Envelope -> classification -> policy -> execution -> verification -> audit.
- Policy states: AUTO, BOUNDED_AUTO, GATED, PROHIBITED.
- Consequential external actions remain gated.
- Dedicated Supabase project with campaign isolation, RLS, server-authoritative game actions and JWT-enforced Edge Functions.
- Temporary public guest preview uses Supabase anonymous identities: no email/password login, while each guest remains isolated by `auth.uid()` ownership and membership policies.

## Infrastructure

Dedicated Supabase project: `vtrfgckzpjgtmqsnumur` (Singapore).

Production web application: `game-platform-wine-nine.vercel.app`.
Production deployment source: `main`.

The repository intentionally contains no service-role keys or private secrets.

## Current release

**Game Systems v2 — temporary public guest preview.** Visitors enter with an isolated anonymous identity and can create private campaigns without an email/password login. Guest continuity is browser-bound; clearing browser storage or changing devices can remove access. The temporary mode intentionally produces Supabase anonymous-access advisor warnings, while ownership and campaign-membership predicates remain enforced.

## Higgsfield cinematics

The in-campaign cinematic button submits a Higgsfield DOP Turbo image-to-video
job using the current narrative and the world’s original artwork, then polls
until the video is ready. Playback is user controlled. Generation never runs
automatically and game turns do not wait for it. The existing per-scene cache,
three daily jobs per user, eight per campaign, and single retry remain in place.
Provider submission timeouts are not automatically retried because they can
represent accepted, billable jobs.

Before enabling on a deployment:

1. Apply `supabase/migrations/20261020020000_higgsfield_cinematics.sql` through
   the project’s normal migration process. It preserves existing jobs and moves
   job writes behind service-role-only functions.
2. Configure server-only `HF_KEY` as `KEY_ID:KEY_SECRET`, and the matching
   Supabase project’s `SUPABASE_SERVICE_ROLE_KEY`. Never expose these in browser
   configuration. `HF_CREDENTIALS` or `HF_API_KEY` plus `HF_API_SECRET` also work.
3. Set `CINEMATIC_GENERATION_ENABLED=true` when the account has generation
   credits. For a preview, also configure a separate `GAME_SUPABASE_URL` and
   `GAME_SUPABASE_PUBLISHABLE_KEY`; never mix a preview key with production.
4. Deploy and verify a real authenticated cinematic from submission through
   playback. Local fixture tests do not establish provider access or credits.

The three starter-world preview players load local videos from
`assets/worlds/cinematics/manifest.json`. Generate their distinct introductions
with credentials available only to the server-side shell:

```sh
node --env-file-if-exists=.env.local scripts/generate-world-cinematics.mjs --submit
node --env-file-if-exists=.env.local scripts/generate-world-cinematics.mjs --collect
```

`--submit` makes up to three billable generations, saving request IDs outside the
checkout. `--collect` checks each once and downloads completed videos; rerun it
while jobs are pending. Review and commit the resulting MP4 files and manifest
before deploying. The manifest remains empty until actual videos are collected;
world artwork remains visible in the meantime. Do not delete unresolved job
state or rerun submissions after a timeout without checking the Higgsfield
account first. Override `CINEMATIC_GENERATION_STATE` to choose a persistent state
path on another machine.

The REST adapter follows the official `higgsfield-ai/higgsfield-js` v2 README
(image-to-video DOP endpoint and status response) and Python SDK. New jobs use
Higgsfield; retained Vercel AI Gateway jobs can still be polled to completion.
Run `npm test` for the provider, client lifecycle, and existing game checks.
