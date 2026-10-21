# Database recovery and release gates

Source baseline: `b11a0f949fcd5e0766ab99110c2130ec9b6d312c`.
Candidate validation: 21 October 2026 on ABEX. No production schema was changed.

## Confirmed historical defect

A fresh PostgreSQL replay fails in `0005_game_systems_v2_hardening.sql` with
`column e.kind does not exist`. `0001` creates `campaigns.name` and
`campaign_entities.entity_type`; later migrations and the application require
`title` and `kind`. The initial schema also lacks the two `updated_at` columns,
`game_events.correlation_id`, and the `SOCIAL` memory type written by `gm-turn`.
Existing `20260922090000_turn_integrity_hardening.sql` already repairs the separate
audit column discrepancy; it must remain in the ordered history.

There are two historical files with version `0004`. Do not renumber either or
mark remote history repaired without inspecting the actual target's migration
ledger. A forward migration at the end cannot fix a fresh replay that already
failed earlier.

## Reproducible local verification

Prerequisites: Node 24 (the CI runtime), Docker with Linux containers, and the
published pgvector image below. Pulling the image is the only network step:

```text
docker pull pgvector/pgvector@sha256:ac08538c6f8b9904c33c8224c5e5706dbe760aca29db1d096972b4052c22a75d
npm run test:schema-recovery
```

The runner requires the already-present image (`--pull=never`), creates its own
UUID-named container, and verifies its ownership label before removing it.
It accepts no database URL or credentials. It has no network, no published port,
384 MiB RAM, 0.5 CPU, and temporary in-memory data. Other containers and databases
are never selected for cleanup.

The PostgreSQL 17.11/pgvector fixture models Supabase's `anon`, `authenticated`,
and `service_role` database roles, `auth.uid()`, grants, and `public,extensions`
search path. It does not run Supabase Auth, PostgREST, Deno, or the browser.

The suite reproduces the original failure, then replays every historical file
by full filename with the compatibility repair immediately after `0001` and
again at the end. It records the SHA-256 of every SQL input. This avoids a
version-key collision in this isolated verification without rewriting the
Supabase migration ledger. The same test runs in a separate CI job; local
success does not establish that job has run remotely.

Actual assertions cover legacy row preservation; guest-equivalent owner world
creation and its entities/stats/inventory/quests/session/NPCs/clock; cross-user
read/write and audit-forgery denial; canonical and historical actor-scoped audit
visibility; SOCIAL type validation; transcript ordering; turn guards; stale
scenes; narration quota admission; idempotence; ambiguous-column rejection; and
`pg_dump`/`pg_restore` into a separate empty database with state fingerprints and
RLS retained. No paid model is called.

## Candidate forward repair

`20261021012412_restore_reproducible_game_schema.sql` was generated with the
checksum-verified official Supabase CLI 2.121.0 using `migration new`. It:

- Renames a legacy column only when the canonical counterpart is absent. If
  both exist, it rejects the ambiguity rather than choosing a source value.
- Adds only missing timestamps and the event correlation column.
- Extends the existing one-column memory type check for SOCIAL, retaining
  previously accepted types and other constraints.
- Makes the actor-scoped audit SELECT policy understand canonical `actor_id`
  and historical `actor.id`, while still requiring current campaign membership.

Apply it atomically. Reapplying is verified to retain rows and the type check.
The early recovery pass skips the audit policy until the membership helper
exists; the final pass repairs that policy after historical policy migrations.

## Commissioning an independent empty environment

Before provisioning: obtain approval for the target and cost, use a separate
Supabase project, and record its immutable identity. Do not reuse production for
Preview. Export and review its grants, schema and migration history first.

Use the tested full-filename ordering and early compatibility prelude to prepare
an owner-reviewed baseline bundle for that empty target. Include both 0004 files
exactly once; retain their original hashes and names in the recovery record.
Commission and compare the target's Supabase migration ledger deliberately before
resuming normal CLI migrations. This repository does not automate remote ledger
repair or claim ordinary `supabase db reset` now accepts the historical collision.

Then configure anonymous sign-in, actual project credentials, JWT verification
for all three Edge functions, allowed origins, the database-near function region,
and Vercel's separate public/server environment variables. Deploy matching Edge
sources and the Vercel candidate through approved gates. Run Supabase advisors
and the real browser creation/decision/reload/membership tests in that isolated
environment, then record deployment revisions. Those service-level gates were
not executed by the PostgreSQL fixture.

## Existing production and rollback

Production health was passively observed at the original baseline revision.
Neither candidate commit, new migration, nor CI configuration has been deployed.
Before a production change, require a reviewed PR, successful checks, approved
deployment, a current schema/history comparison, and an owner-controlled backup.
The new migration's grants/policies require the same review as other security
changes; a local test is not authority to change production permissions.

Retain the prior Vercel and Edge deployments. If an application release fails,
restore that deployment and retain compatible additive database fields while
investigating. Do not remove data, renumber history, clear every turn guard, or
drop schema objects as an emergency shortcut. A conditional legacy rename is a
schema migration; restoring its pre-migration backup requires a separate
approved data-recovery procedure. Verify actual cloud backup retention,
restorability and recovery objectives before claiming operational readiness.