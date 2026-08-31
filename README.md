# Game Platform

Independent commercial AI-native persistent role-playing platform.

This product implements Shared Design Language v1 concepts independently. It has no runtime, database, secret, deployment, or code dependency on unrelated portfolio products.

## Product thesis

A persistent AI-native role-playing universe where the world remembers what the player did and consequences propagate through campaign state.

## Architecture

- GM Reasoner: bounded creative/stateful reasoner with deterministic fallback.
- Selective Cinematic Mode: pivotal turns can produce one cached four-second AI video through Vercel AI Gateway, with asynchronous jobs, per-user/campaign limits and text-first fallback.
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
