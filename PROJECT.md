# Puzzled Project

Puzzled is a production puzzle-game application repo. It owns the Puzzled
Next.js app, repo-local SDK/UI integration, Atlas migrations, Sylphx deployment
manifest, and application-specific game/user workflows.

## Lifecycle

- Lifecycle: `production`
- Layer: `application`
- Instruction SSOT: binding Skills (`engineering-standard`). Architecture: [ADR-169](docs/adr/ADR-169-capability-first-modular-ddd.md) (supersedes ADR-168 module shape; retains Rust API authority).
- Machine manifest: `.doctrine/project.json`

## Goals

- Ship the Puzzled game application with reliable app, database, auth, settings,
  analytics, and deployment behavior.
- Keep Puzzled-specific product behavior inside this repo and use external
  projects only through documented public contracts.
- Maintain safe Atlas migration and Sylphx deployment evidence for production
  changes.

## Non-Goals

- Do not own Sylphx Platform core behavior or shared SDK semantics beyond
  repo-local integration.
- Do not encode another product's game or customer-specific behavior into this
  app.
- Do not treat source revert as complete recovery after migrations or deploy
  side effects have run.

## Boundaries

Puzzled owns its application code, app package, migrations, deployment manifest,
local SDK/UI consumption, and product-specific game workflows.
Rust functional core lives in `crates/puzzled-core` (capability modules);
imperative API shell lives in `crates/puzzled-server`. It does not own
Sylphx Platform internals, external package release policy, or sibling product
domain models.

## Delivery

CI declares `Lint & Type Check`, `Security Scan`, `Migration Integrity`, `Unit
Tests`, and `Build`. The workflow currently path-filters to app/package/workflow
changes, so docs-only project-control metadata may need central status fan-in or
ruleset adjustment before the repo can claim full doctrine admission.
