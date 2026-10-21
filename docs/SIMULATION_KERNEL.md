> Portfolio status: [STATUS.md](https://github.com/AndrewLamSingapore/orqevia/blob/main/STATUS.md) is the sole portfolio status reference. Each product owns its source, configuration, contracts and domain records. The [operational manifest](https://github.com/AndrewLamSingapore/orqevia/blob/main/governance/operational-manifest.json) provides dated ORQEVIA component and observation references; it does not establish deployment status.

# Simulation Kernel boundary

Game Platform implements a bounded synthetic scenario simulator independently of the RPG. Its tested competitive FSM/Elo/risk libraries are separate primitives; this simulator does not execute a competitive match or invoke those libraries.

A portfolio simulation request must be a bounded, non-authoritative scenario specification. Simulation never writes another product's production state. Results can be exported as `game.simulation.completed`, `game.strategy.tested`, or `game.anomaly.detected` Portfolio Events with assumptions, seed/ruleset, metrics and provenance.

Generative characters and GM reasoning remain outside authoritative competitive state. A simulated outcome is evidence about a model, not proof of a real-world outcome.

## Optional event delivery

The simulation API computes and validates its local result before attempting
portfolio publication. An optional relay outage does not turn that successful
local computation into an invalid-scenario response. `portfolio_fabric.degraded`
and its `queued`/`delivery` records explicitly report unavailable integration.
A result can be valid while its event has not been durably queued.

All requests within one publication attempt share one two-second abort deadline,
including the local outbox, relay, direct integration and delivery bookkeeping.
Queue acknowledgement must be the literal boolean `true`; it is not evidence
that downstream processing completed. An existing acknowledged local enqueue
remains reported as durable if its subsequent delivery attempt fails. Public
simulation diagnostics use fixed reason codes rather than raw server errors.

No model reasoning, game authority or real-world outcome is established by these
synthetic scenario metrics. Invalid local scenarios remain HTTP 422 and invalid
authorization remains HTTP 401. `npm test` includes ten real-handler regression
cases, with synthetic credentials and network fixtures, for this boundary.
