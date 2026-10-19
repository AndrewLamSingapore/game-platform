# Turn response and deployment controls

Player decisions request an authenticated SSE response from gm-turn. AI Gateway output deltas are decoded into provisional narrative text; choices remain unavailable until the server has validated the final narration and persisted the turn. The final authoritative TurnResult replaces the draft immediately. A single RLS-preserving game_campaign_snapshot call reconciles secondary panels in the background. Snapshot results are discarded if the user changes campaigns, another turn starts, or the scene version changes.

NPC agendas use a batched upsert. Independent transcript, memory, clock, player/NPC, campaign and session effects share one parallel completion barrier; failures stop a success response. Stats are fetched only when a skill check needs them, and faction updates reuse the already-read campaign context. Turn writes still complete before a successful result is sent. resolved_before_audit_ms, model_ms, first_narrative_ms and effects_ms are measured separately; neither is a browser-visible latency claim.

## Concurrency and recovery

A partial unique index permits only one guarded GM reservation per campaign. A trigger locks the campaign row and checks the expected scene version before reservation. This prevents a different client request ID from resolving an already-moving scene. Same-request replay semantics remain unchanged.

The guard is released in finally after success or failure. It deliberately does not expire underneath a slow live writer. If an Edge worker is terminated abruptly and cannot release its guard, inspect the specific request and campaign before clearing that reservation's turn_guard as an administrator. Do not blindly expire all locks or replay a possibly committed turn. Audit history is retained. Other game-action operations are not covered by this GM-only lock.

## Paid narration quotas

admit_game_narration validates the authenticated identity and active OWNER/GM/PLAYER membership, then atomically counts shared PostgreSQL budgets across instances: 10 requests/minute and 100/day per user, 20/minute and 200/day per campaign, 100/minute and 2,000/day globally. Failed admission returns 429 with Retry-After; storage failure returns 503 before invoking the paid provider. The quota table denies direct client access. The deliberately exposed SECURITY DEFINER admission function and deny-by-default table can produce advisor messages; their ownership and grants are intentional.

Provider routing prefers time to first token through GAME_NARRATION_PROVIDER_SORT=ttft, while retaining the existing model and fallback list. No premium service tier is requested. Short narration uses the existing model with reasoning effort none (supported by the current model metadata); GAME_NARRATION_REASONING_EFFORT can override it. The deterministic rules and authorization remain unchanged. Provider generation has a 25-second deadline; auth, membership and quota calls have five-second deadlines. A failed provider stream falls back to the existing deterministic narration. This fallback can replace provisional text; provisional text is never canonical game state.

## Region and measurement

The owning Supabase database is in ap-southeast-1. Production turn requests send x-region from runtime-config to execute near that database; GAME_SUPABASE_FUNCTION_REGION can override this. Explicit regional invocation does not automatically fail over during a regional outage; adjust the configured region if needed. The first live cloud-browser check before this regional setting recorded 17,187ms before audit, including 5,722ms narration, so no final speed improvement was inferred from the first deployment. A follow-up batches the remaining independent effects and records first-narrative and effect times.

## Preview isolation

/api/runtime-config supplies only the public backend URL and publishable key. Production preserves the existing project by default. Preview must configure GAME_SUPABASE_URL and GAME_SUPABASE_PUBLISHABLE_KEY for a different project; missing configuration or the production URL returns 503 before guest sign-in. Narration uses the same server-side check. Preview cinematic generation is unavailable until separately commissioned. Do not configure production backend credentials on a Preview deployment. Old previews retain their old code; retire or restrict old deployment URLs separately before treating the entire historical preview estate as isolated.

## Outbox schedules

The uncommissioned local-outbox cron has been removed from vercel.json. The production Portal relay push path remains configured and unaffected. /api/portfolio-events remains authenticated and fails closed without CRON_SECRET or PORTFOLIO_OUTBOX_TOKEN; it is an inactive manual endpoint, not an operational scheduled delivery service. To commission a local outbox later, provision its server-only Supabase credentials, authentication secret and consumer, verify delivery, then register the schedule. This release does not claim that pathway is commissioned.

## Release and rollback

Deploy the additive 20261019045443_game_turn_response_controls migration before the new Edge function and Vercel client. Retain JWT verification on gm-turn and include both _shared/turn-integrity.js and _shared/turn-stream.js in its bundle. Keep the previous Edge source and Vercel deployment available for rollback. Do not remove additive database controls during an emergency rollback; the prior function does not set turn_guard and remains compatible with the new schema.

Repository enforcement should require PRs, a reviewer and successful policy-contract/status checks, and disallow force pushes and branch deletion. A runbook does not enforce GitHub settings. Administration-write access is required to apply those controls.

Transcript windows order equal-timestamp messages by their monotonically increasing row ID before reversing them for display, so each player action precedes its GM response.
