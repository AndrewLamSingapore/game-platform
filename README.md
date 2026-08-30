# Game Platform

Independent commercial AI-native persistent role-playing platform.

This product implements Shared Design Language v1 concepts independently. It has no runtime, database, secret, deployment, or code dependency on Personal JARVIS or VELYQUA Cloud.

## Product thesis

A persistent AI-native role-playing universe where the world remembers what the player did and consequences propagate through campaign state.

## Architecture

- GM Reasoner: bounded creative/stateful reasoner with deterministic fallback.
- Campaign memory: episodic, semantic, decisions, quests and quest graph.
- Living entities: player-owned PCs, autonomous NPCs, factions and items.
- Game Systems v2: multiplayer roles/invites, world clock, rulesets, inventory/equipment, health and deterministic combat.
- Stable Spine: Action Envelope -> classification -> policy -> execution -> verification -> audit.
- Policy states: AUTO, BOUNDED_AUTO, GATED, PROHIBITED.
- Consequential external actions remain gated.
- Dedicated Supabase project with campaign isolation, RLS, server-authoritative game actions and JWT-enforced Edge Functions.

## Infrastructure

Dedicated Supabase project: `vtrfgckzpjgtmqsnumur` (Singapore).

Production web application: `game-platform-wine-nine.vercel.app`.

The repository intentionally contains no service-role keys or private secrets.

## Current release

**Game Systems v2** — persistent multiplayer world simulation. Supabase security advisor: zero findings after v2 hardening; performance advisor has only unused-index informational notices while the private alpha has low traffic.
