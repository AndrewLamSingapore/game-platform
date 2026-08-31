# Competitive AI architecture

The competitive runtime and narrative AI are separate trust and latency domains.

## Non-negotiable boundary

No LLM, external model, Living Character, or Game Master call may execute in the authoritative competitive gameplay loop. Competitive bots use deterministic, versioned finite-state machines. Narrative services may consume completed game events asynchronously but cannot submit authoritative competitive decisions.

## Flow

1. The authoritative server validates an action with cheap integrity rules.
2. It resolves the tick, including deterministic bot decisions.
3. It appends an immutable, server-authored event carrying bot, ruleset, map, and seed versions.
4. Rating, matchmaking, adaptive difficulty, analytics, and risk workers consume events outside the hot path.
5. Risk workers create review flags; only impossible-state checks reject inline.

## Replay contract

A replay is reproducible from ordered events plus `bot_version`, `ruleset_version`, `map_version`, and `random_seed`. Runtime releases must retain old bot/ruleset implementations while replay data referencing them remains supported.
