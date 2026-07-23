# ADR-168 — Portfolio Puzzled Rust North Star architecture

- **Status:** Superseded in part by ADR-169 (module/crate shape); transport north star retained
- **Superseded by:** ADR-169-capability-first-modular-ddd.md
- **Date:** 2026-07-09
- **Relates to:** ADR-167 (SylphxAI/doctrine)
- **Change class:** `required-future` for Puzzled; `advisory` for portfolio

## Context

Puzzled is a production puzzle-game application with a Next.js app, local SDK/UI
packages, Atlas migrations, and Sylphx deployment manifest. Game state, auth, and
leaderboard paths are latency-sensitive backend surfaces.

Doctrine [ADR-167](https://github.com/SylphxAI/doctrine/blob/main/docs/adr/ADR-167-boundary-contract-stack-and-platform-pillars.md)
requires Rust-first backend authority, Protobuf+Buf SSOT, and Connect/gRPC default
transport. The game web UI and shared UI package remain TypeScript per language pillars.

## Decision

### 1. North Star production stack (Puzzled repo)

| Layer | North Star | Transitional (until sunset slice) |
| --- | --- | --- |
| Cross-boundary contract | Protobuf + Buf (`proto/puzzled/v1/`) | Hand-written TS types |
| App↔backend transport | Connect RPC / gRPC | Next.js API routes |
| Backend API authority | Rust `crates/puzzled-server` | Next.js server routes |
| Web application | TypeScript Next.js | unchanged |
| Persistence | Atlas + sqlx (`puzzled-db`) | Drizzle/Atlas during cutover |
| Platform BaaS | `@sylphx/sdk` | repo-local integration |

### 2. Ownership matrix

| Concern | Owner | Puzzled may | Puzzled must not |
| --- | --- | --- | --- |
| Puzzle game product, scoring, user progress | **SylphxAI/puzzled** | Own game DB tables and policies | Encode other products' game logic |
| Auth, managed Postgres, analytics | **SylphxAI/platform** | Consume public BaaS | Own platform internals |

### 3. Strangler-fig cutover posture

- **S0:** `proto/puzzled/v1/` + Buf lint.
- **S1:** Rust auth/read slice (session, profile, leaderboard read) with fixture parity.
- **S2:** Game write paths on Connect; Next.js uses generated TS client.
- **S3:** Delete TS backend authority for migrated routes.
- `packages/ui` stays TypeScript; no Rust UI scope.

### 4. Contract stack (ADR-167 alignment)

- **Protobuf + Buf** is cross-boundary SSOT.
- **Connect RPC / gRPC** is default for web↔API transport.
- Hand-written parallel OpenAPI rejected post-S0.

## Alternatives considered

| Alternative | Why rejected |
| --- | --- |
| Permanent TS API monolith | Contradicts ADR-167 |
| Rust game UI | Violates TypeScript browser pillar |
| Skip proto until post-launch | Creates second SSOT during active production lifecycle |

## Consequences

- New backend code defaults to `crates/puzzled-*`.
- Portfolio cutover registry: auth/read slice is first parity milestone.
- Atlas migrations and Sylphx deploy evidence required per slice.

## Validation

- `buf lint` + `cargo test` + `cargo clippy -D warnings`
- Auth and leaderboard contract unchanged through cutover
- `python3 $DOCTRINE/scripts/project-control-plane-audit.py --local . --fail-on-drift`