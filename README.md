# Game Platform

Independent commercial AI-native persistent role-playing platform.

This product implements Shared Design Language v1 concepts independently. It has no runtime, database, secret, deployment, or code dependency on Personal JARVIS or VELYQUA Cloud.

## Product thesis

A persistent AI-native role-playing universe where the world remembers what the player did and consequences propagate through campaign state.

## Architecture

- GM Reasoner: bounded creative/stateful reasoner.
- Campaign memory: episodic, semantic, decisions, quests.
- Entities: PCs, NPCs, locations, factions, items.
- Stable Spine: Action Envelope -> classification -> policy -> execution -> verification -> audit.
- Policy states: AUTO, BOUNDED_AUTO, GATED, PROHIBITED.
- Consequential external actions remain gated.
- Dedicated Supabase project with tenant/campaign isolation and RLS.

## Infrastructure

Dedicated Supabase project: `vtrfgckzpjgtmqsnumur` (Singapore).

The repository intentionally contains no service-role keys or private secrets.
