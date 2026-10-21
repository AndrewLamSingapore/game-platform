> Portfolio status: [STATUS.md](https://github.com/AndrewLamSingapore/orqevia/blob/main/STATUS.md) is the sole portfolio status reference. Each product owns its source, configuration, contracts and domain records. The [operational manifest](https://github.com/AndrewLamSingapore/orqevia/blob/main/governance/operational-manifest.json) provides dated ORQEVIA component and observation references; it does not establish deployment status.

# Competitive AI architecture

The competitive primitives and narrative AI are designed as separate trust and
latency domains. Current owning source contains tested FSM/telemetry/rating/risk
libraries and database contracts, but no application/API/Edge consumer of those
libraries beyond tests was demonstrated in the 21 October 2026 audit. Match
execution, matchmaking and asynchronous workers below are integration contracts,
not a claim that a live competitive service has been implemented or deployed.

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
