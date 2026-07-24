# ADR-170 — Terminal capability ownership (jobs worker + API shell)

- **Status:** Accepted
- **Date:** 2026-07-24
- **Supersedes residual wording in:** ADR-169 transitional residual section
- **Relates to:** ADR-169 capability-first Modular DDD / FCIS; binding Skills `engineering-standard`

## Context

ADR-169 established Capability-first Modular DDD with `puzzled-core` (functional
core) and `puzzled-server` (API shell). Job execution temporarily bounced between
Rust stubs and web handlers, including a false-success hole that #33 closed by
restoring the web webhook executor.

Leaving job I/O labeled "residual until Rust" forever is not a terminal design.
Platform SDK BaaS callbacks (cron delivery, push/email side effects, QStash) are
naturally owned by the web worker process that already integrates `@sylphx/sdk`.
Rust owns product API authority, pure puzzle kernels, and seed planning.

## Decision

### 1. Terminal ownership matrix

| Capability / surface | Terminal owner | Notes |
| --- | --- | --- |
| Product HTTP API (`/api/v1/*`, health, leaderboard) | Rust `puzzled-server` | Edge `path_prefixes` |
| Pure puzzle/domain/policy kernels | Rust `puzzled-core` | FCIS functional core |
| Platform job worker webhook + handlers | Web `apps/puzzled` | `/api/webhooks/platform-jobs` + `src/lib/jobs/**` |
| Seed plan/materialize API | Rust `/api/v1/jobs/plan|execute` | Pure/seed only; not full job worker |
| Browser UI / Next presentation | Web | Unchanged |
| Dual legacy Vercel cron + `/api/jobs/*` HTTP | **Retired** | Explicit 410; not serving authority |

### 2. No dual public authority

- Edge must not route `/api/webhooks/platform-jobs` to Rust.
- Rust must not expose a competing platform-jobs webhook that claims completion
  for web-owned effects.
- Legacy `/api/cron/*` and `/api/jobs/*` HTTP entry points return **410 Gone**
  with a pointer to the terminal webhook/worker path.
- Internal library modules under `src/lib/jobs/**` remain callable from the
  terminal webhook only (not second public HTTP authorities).

### 3. Naming

- Web job work is a **terminal capability** (`platform_job_worker`), not a
  temporary residual.
- Rust `jobs_policy` pure catalog classifies which job **names** the web worker
  owns versus which pure seed plan Rust can materialize.

## Consequences

- ADR-169 residual section for job I/O is closed by this terminal decision.
- Further Rust job I/O migration is **out of scope** unless a new ADR reopens it
  with full adapter evidence (DB, LLM, Platform SDK, DLQ).
- Architecture tests enforce: webhook on web executes handlers; path_prefixes
  omit webhook; legacy dual HTTP returns 410; Rust router has no platform-jobs
  webhook route.

## Validation

- `cargo test -p puzzled-core -p puzzled-server`
- Architecture shell tests for terminal ownership
- Language hygiene
- CI required contexts green on the landing PR
