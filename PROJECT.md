# Puzzled Project

Puzzled is a production puzzle-game application repo. It owns the Puzzled
Next.js app, repo-local UI package, Atlas migrations, Sylphx deployment
manifest, and application-specific game/user workflows.

## Lifecycle

- Lifecycle: **dev-phase until live proof** (ADR-170 §6). No production claim
  exists until both images build from the Dockerfiles and an end-to-end
  play→save→leaderboard→premium round trip is demonstrated on a deployed
  environment.
- Layer: `application`
- Instruction SSOT: binding Skills (`engineering-standard`). Architecture:
  [ADR-170](docs/adr/ADR-170-clean-break-north-star.md) (sole Connect, sole
  Rust executor, content tool).

## Architecture

- **api** (Rust, `crates/puzzled-server`): sole backend. Connect RPC services
  only — Health, Puzzle, Stats, Preferences, Gamification, Admin, Jobs. No
  REST surface. Identity from Platform JWT (Bearer or session cookie).
- **web** (Next.js, `apps/puzzled`): presentation only. Generated Connect
  client; Platform SDK for auth/billing/flags/AI. No backend authority.
- **core** (`crates/puzzled-core`): pure game rules, validation, scoring,
  policy.
- **Content**: `apps/puzzled/scripts/generate-content.ts` imports daily
  puzzles into the content store (`daily_puzzles`); the api serves and
  validates from it. No runtime generation service.
- **DB**: Atlas-managed Postgres; single runtime writer is the api service.

## Delivery

<<<<<<< HEAD
CI declares `Lint & Type Check`, `Security Scan`, `Migration Integrity`, `Unit
Tests`, and `Build`. The workflow currently path-filters to app/package/workflow
changes, so docs-only project-control metadata may need central status fan-in or
ruleset adjustment before the repo can claim full doctrine admission.

## Delivery authority

See [docs/north-star/DELIVERY-AUTHORITY.md](docs/north-star/DELIVERY-AUTHORITY.md).
=======
CI runs lint/typecheck, buf + platform-boundary gates, migration integrity,
unit tests (app + Rust), and real builds (web `next build` + Rust release).
Evidence is per layer: source / CI / deploy / live — a green check or a 200
is not proof.
>>>>>>> a518392 (docs(adr): ADR-170 clean-break north star + proto naming conformance)
