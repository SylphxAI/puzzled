# Puzzled Agent Instructions

## Scope

This file is the repo-local operating policy for agents working in
`SylphxAI/puzzled`. Org-wide engineering doctrine is owned by
`SylphxAI/doctrine`; `PROJECT.md` and `.doctrine/project.json` own this
repository's local identity, lifecycle, boundary, and delivery facts.

Puzzled is a production puzzle-game application repo with a Next.js app,
repo-local SDK/UI packages, Atlas migrations, Sylphx deployment manifest, and
CI gates for lint/typecheck, security, migrations, tests, and build.

## Read First

1. `PROJECT.md` and `.doctrine/project.json`.
2. Root `package.json`, `apps/puzzled/package.json`, and `sylphx.toml`.
3. `apps/puzzled/atlas.hcl` and `apps/puzzled/atlas/migrations/` before
   touching persistence.
4. `packages/sdk/README.md` and `packages/sdk/package.json` before changing SDK
   behavior.
5. `.github/workflows/ci.yml` before changing validation or branch gates.

## Non-Negotiables

- Treat Atlas migrations and `release_command` as forward-only production
  behavior. Use expand/contract and verify migration checksums.
- Do not put Puzzled-specific behavior into shared SDK/UI packages unless it is
  generalized and documented.
- Do not commit secrets, database URLs, Redis credentials, auth secrets, customer
  data, or generated build output.
- Runtime, migration, auth, billing, analytics, and deploy changes need tests
  plus deploy/readback evidence.
- Use branch -> commit -> PR. Do not push directly to `main`, force-push, merge,
  or deploy without required gates.

## Validation

- `bun run lint`
- `bun run typecheck`
- `bun run test`
- `bun run build`
- `bun run check:proto-buf` — `buf lint` + `buf breaking` (ADR-168 S0)
- `cargo test -p puzzled-server` and `cargo clippy -p puzzled-server -- -D warnings`
- `atlas migrate hash --dir file://apps/puzzled/atlas/migrations`

Docs-only boundary changes may be validated by diff review, referenced-file
checks, and the central project manifest audit.
