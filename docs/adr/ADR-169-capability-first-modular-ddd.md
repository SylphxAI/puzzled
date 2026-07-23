# ADR-169 — Capability-first Modular DDD for Puzzled

- **Status:** Accepted
- **Date:** 2026-07-23
- **Supersedes:** ADR-168 (sections on crate/module shape and residual flat layout)
- **Relates to:** Binding Skills `engineering-standard` (Capability-first Modular DDD,
  Clean/Hexagonal boundaries, Functional Core / Imperative Shell)
- **Change class:** architecture / ownership

## Context

ADR-168 correctly established Rust API authority, Protobuf+Buf contracts, and the
strangler cutover posture. Implementation then accumulated a flat
`puzzled-server` god crate: pure dual-oracle residuals, game rules, HTTP
handlers, SQL adapters, and JWT I/O shared one module namespace with no
capability ownership map.

Binding Skills `engineering-standard` requires:

- Capability-first Modular DDD at the macro level
- Clean/Hexagonal dependency rule (policy never depends on delivery details)
- Functional Core / Imperative Shell (pure decisions vs effectful adapters)
- Rust **modules** as the default semantic unit; additional crates only for real
  compile, dependency, release, ownership, or isolation boundaries
- No size-based exemption and no residual dual authority for the same promise

## Decision

### 1. Canonical architecture

Puzzled durable product code follows:

> **Capability-first Modular DDD with Clean/Hexagonal boundaries and FCIS**

| Layer | Home | May depend on |
| --- | --- | --- |
| Functional core (domain + pure application decisions) | `crates/puzzled-core` | std, serde, chrono (datetimes as values), uuid |
| Imperative shell (HTTP, SQL, JWT, env, clocks, composition) | `crates/puzzled-server` | `puzzled-core` + effect libraries |
| Web presentation | `apps/puzzled` (TypeScript) | published contracts / BaaS SDK; no backend domain authority |
| Cross-boundary contracts | `proto/puzzled/v1` | language-neutral SSOT |

### 2. Crate policy

Retain exactly two Rust crates unless a new independent boundary appears:

| Crate | Justification |
| --- | --- |
| `puzzled-core` | Pure functional core; independent proof; no axum/sqlx/reqwest/tokio runtime |
| `puzzled-server` | Deployed API binary / effect shell (`sylphx.toml` `api` service) |

Rejected: per-game micro-crates, per-cell parity crates, and additional
scaffolding crates without release/security/isolation ownership.

### 3. Capability map (macro ownership)

| Capability ID | Outcome | Core modules | Shell modules |
| --- | --- | --- | --- |
| `puzzle_play` | Generate/validate/score puzzle play correctly | `capabilities::puzzle_play` | HTTP games/grid/submit adapters |
| `identity_access` | Verified platform identity gates mutations | `capabilities::identity_policy` | JWT adapter + session HTTP |
| `leaderboard` | Ranked score projections | pure enrich/query types | SQL adapter + HTTP |
| `preferences` | Durable profile/UI/notification prefs | profile limits pure | prefs HTTP + SQL |
| `gamification` | Streaks/freezes/achievement tiers | achievement tier pure | gamification HTTP + SQL |
| `stats` | User stats / percentile projections | pure stat math | stats HTTP |
| `generation_jobs` | Plan/execute platform generation jobs | pure job policy/backoff | job HTTP + webhooks |
| `product_policy` | Shared limits, codes, enums, app constants | pure product policy | composition only |
| `privacy` | PII scrub / privacy sanitize | pure privacy rules | adapters at edges |
| `billing_access` | Premium/free access policy | pure billing policy | shell evaluation at edges |
| `presentation_policy` | Motion/color/vitals pure parity constants | pure presentation policy | none (no product HTTP) |
| `platform_health` | Liveness/readiness probes | none | bootstrap health routes |

Shared technical folders (`utils`, flat `*_pure.rs` dumps) are not macro
architecture. Vertical slices live **inside** a capability.

### 4. Dependency rules

1. `puzzled-core` must not import axum, sqlx, reqwest, tokio runtime, or read
   process env/clocks for domain decisions.
2. Shell adapters implement ports; domain types and pure decisions live in core.
3. TypeScript may own browser UI and temporary strangler adapters, but must not
   remain dual authority for routes declared on the Rust `api` service in
   `sylphx.toml`.
4. New backend product behavior defaults to Rust capability modules.

### 5. Strangler posture (from ADR-168, refined)

ADR-168 S0–S3 transport/cutover goals remain. Module shape now follows this ADR
rather than a flat residual dump. When a route is edge-routed to Rust, residual
Next.js handlers for that route are non-authority and must be deleted or reduced
to an explicit non-serving stub with tests preventing reintroduction of dual
authority.

### 6. What ADR-168 still owns

- Protobuf + Buf SSOT
- Connect/gRPC north star transport
- Rust API authority vs Next presentation
- Atlas + sqlx persistence direction
- Platform BaaS consumption boundaries

## Alternatives considered

| Alternative | Why rejected |
| --- | --- |
| Keep flat `puzzled-server` + flat pure residual files | Violates capability ownership and FCIS |
| One crate per game / per residual | Micro-crate tax without isolation benefit |
| Move pure domain into Next.js packages | Contradicts Rust API authority and Skills language pillars |
| Expand-contract every module forever | No live dual-write requirement for in-process module moves |

## Consequences

- Pure dual-oracle modules move under `puzzled-core` capability trees.
- HTTP/SQL/JWT/env/clock effects stay in `puzzled-server` shell modules.
- Architecture tests enforce crate dependency direction and forbid shell imports
  in core.
- ADR-168 status becomes **Superseded in part** by this ADR for module/crate
  shape; transport north star remains.

## Validation

- `cargo test -p puzzled-core -p puzzled-server`
- `cargo clippy -p puzzled-core -p puzzled-server -- -D warnings`
- Architecture unit tests: core has no forbidden shell deps; capability modules
  resolve; public HTTP routes remain contract-stable
- No dual-authority Next route for `sylphx.toml` `api` `path_prefixes`


## Transitional residual (explicit, not done)

### Job I/O authority (corrected)

Full platform job **effects** (LLM generation, DB persistence, email/push, DLQ)
remain on the **web residual executor**:

- `apps/puzzled/src/app/api/webhooks/platform-jobs/route.ts` + `src/lib/jobs/**`
- `sylphx.toml` api `path_prefixes` intentionally **omit**
  `/api/webhooks/platform-jobs` so edge does not send job I/O to Rust stubs

Rust owns:

- pure plan/seed materialization at `/api/v1/jobs/plan` and `/api/v1/jobs/execute`
- fail-closed responses for residual I/O job names (no false `success: true`)
- pure job catalog under `puzzled_core::jobs_policy::job_catalog`

### Other residuals

1. Legacy Next `/api/cron/*` fire-and-forget paths remain non-platform dual entry
   points for local/Vercel-era flows; production Platform crons use the webhook.
2. `presentation_policy` pure dual-oracle constants remain parity kernels.
3. Progressive extraction of remaining pure application helpers from shell
   interfaces continues without changing public HTTP contracts.

Landed job-authority rule: **never claim Rust job completion for residual I/O**.
