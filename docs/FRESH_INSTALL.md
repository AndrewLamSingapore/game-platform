# Independent fresh Game database installation

This path provisions a **new empty Supabase database**. Existing installations,
including production, retain their existing migrations and ledger. Do not run
the staged baseline against production, reset a populated database, or mark the
historical versions repaired.

## Why a separate workspace

Two original files have version `0004`; the ordinary CLI rejects the second with
`schema_migrations_pkey` / SQLSTATE 23505. Separately, raw historical SQL reaches
0005 before the legacy `entity_type/name` columns have become `kind/title`.

`supabase/fresh-install/manifest.json` pins the ordered 29 original inputs and a
CLI-generated baseline identity. The generator inserts the already-reviewed
compatibility repair after 0001 and includes its normal final occurrence.
Both 0004 files execute once in original full-filename order. Only CRLF-to-LF
checkout conversion is normalized to canonical Git SQL bytes; no original
file is rewritten. Generated SQL and provenance are deterministic.

## Generate and review

Requirements: Node 22+; tested CLI 2.121.0; a separately authorized, empty
Supabase target with its normal Auth schemas, roles and grants.

```text
npm run stage:fresh-database -- C:\path\to\new-game-staging
```

The new directory contains `supabase/config.toml`, one baseline migration, and
`fresh-install-provenance.json`. It contains no link, project reference,
credentials, seed script, Edge deployment or references to another sovereign
runtime. The command never connects to a database. It rejects an existing
output, overlap with the source Supabase tree, changed pinned input, and
unrecognized/backdated/colliding future versions.

Review every generated input/hash and the intended target's immutable identity.
Confirm the database is empty and independently backed up if it has anything
worth retaining. The baseline rejects existing non-extension public/private tables,
sequences/views/functions (including ownership helpers) and a nonempty migration ledger before original SQL.
An empty public application schema alone does not authorize overwriting unknown
project state.

Use a normal secure database credential mechanism outside evidence/logs. With
the verified target connection available only to the local operator:

```text
supabase migration up --workdir C:\path\to\new-game-staging --db-url <secure-target-connection>
supabase migration list --workdir C:\path\to\new-game-staging --db-url <secure-target-connection>
```

Do not paste an actual password into shell history, reports or a PR. Disable
command tracing, use the CLI's secure credential workflow, and retain TLS
validation for managed targets. No managed target is created or changed by the
automated tests.

The staged installation records **one baseline ledger version**, not fictitious
individual historical versions. Retain its provenance with the target. Generate
a new staging directory from the same manifest for future releases; subsequent
unique 14-digit migrations newer than the baseline are copied with their original
identities. Use that staged workspace for every future migration command on this
installation. Never switch it to the original colliding migration directory,
recalculate the baseline identity/hashes, or run migration repair to hide a
mismatch. Backdated changes require explicit review.

Configure and verify Auth, PostgREST, Edge functions, origins and environment
variables separately before declaring the complete hosted product commissioned.

## Reproducible verification

The cached/pinned image is shared with the existing recovery suite:

```text
docker pull pgvector/pgvector@sha256:ac08538c6f8b9904c33c8224c5e5706dbe760aca29db1d096972b4052c22a75d
npm test
npm run test:schema-recovery
npm run test:fresh-install
```

`test:fresh-install` locates `supabase` on PATH, or uses the operator's
`GAME_SUPABASE_CLI` executable path. It accepts no target URL and always makes a
UUID-owned local container with tmpfs data, 384 MiB/0.5 CPU, a random test password,
a task-only bridge with inter-container communication disabled, and one randomly
assigned **127.0.0.1-only** port for the host CLI. It uses `--pull=never`, verifies
ownership before cleanup, and touches no persistent container. The bridge has a
gateway; this is not a network-none claim. Docker internal-network port publishing
did not work on the tested host.

The suite actually reproduces both original failures, then executes supported
CLI installation and a complete no-op repeat. Existing ownership/bootstrap/audit/
turn/constraint tests run on that installed database. It dumps/restores all schema
and all public/auth/CLI-ledger fixture rows to a different empty database, compares
schema and row fingerprints, repeats CLI no-op and real RLS/FK/CHECK assertions,
and proves a future migration applies exactly once without rewriting the baseline
ledger. Auth itself, PostgREST, Edge deployment and managed backup recovery are
not executed by this fixture.

## Rollback

Before applying the baseline, remove only its reviewed generated staging output
if it is no longer needed. No original migration or database change is required.
A failed baseline must leave zero baseline history entries and preserve preexisting
data; stop and inspect rather than resetting the target.

After a successful new installation, keep its baseline and provenance forever.
Application rollback retains this compatible schema and ledger. Recover populated
data only through an approved verified backup/restore procedure; never remove
rows, reassign old versions, or replay a fresh baseline over that target. Reverting
this tooling release does not require a live database rollback.
