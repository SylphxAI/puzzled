# puzzled — local agent notes only

Doctrine and Mission Control are retired historical lineage and must not
be loaded as current instruction authority.

Local truth: `PROJECT.md`, `docs/adr/`.

Product NSM: **daily puzzle completers** (English quantity; do not invent a house score acronym). Secondary entertainment metric: **daily entertainment completers**.

Architecture SSOT: binding Skills `engineering-standard` + `docs/adr/ADR-170-clean-break-north-star.md`
(sole Connect, sole Rust executor, content tool). Rust layout:
`crates/puzzled-core` (functional core) + `crates/puzzled-server` (imperative shell).

## Boundary hazards

- Do not put Puzzled-specific behavior into shared SDK/UI packages unless
- Never commit secrets, database URLs, Redis credentials, auth secrets, or

## Local commands

```bash
bun run lint
bun run typecheck
bun run test
bun run build
bun run check:proto-buf
cargo test -p puzzled-core -p puzzled-server
cargo clippy -p puzzled-core -p puzzled-server -- -D warnings
atlas migrate hash --dir file://apps/puzzled/atlas/migrations
```

## CI and the merge queue

The queue runs only the fast gate (`ci.yml`: lint, typecheck, secret scan,
affected unit tests, and the migration lane when `apps/puzzled/atlas/` changes).
`verify.yml` runs the full suite (production web build, release binary,
database-backed Rust tests, SEO, accessibility, Lighthouse) after merge and
nightly, and marks the commit `verified`. A draft is the compiler: it runs the
gate only. A pull request marked ready also runs the affected suite. See the
[SylphxAI/.github optimistic-merge guide](https://github.com/SylphxAI/.github/blob/main/docs/optimistic-merge.md).

## Validation notes

- Prefer the **narrowest** affected check before full workspace runs.
- Local work is done when the change is correct. Name the layer. Do not write
  `docs/evidence` or invent a house score.

## Backend false-authority fence

The **Rust backend cutover is complete** (ADR-170):

1. Production backend authority is the Rust crate/binary/service path declared
   in `sylphx.toml` / deploy manifests / Docker ENTRYPOINT
   (`crates/puzzled-server`).
2. The Next.js service is presentation-only: no DB writes, no job execution,
   no email/push delivery, no REST API surface.
3. Do not reintroduce TypeScript backend authority (jobs, generation, REST)
   — daily puzzles are generated, validated and stored by the Rust pipeline
   (`crates/puzzled-server/src/capabilities/daily_pipeline`). The TS
   generators remain only as the parity oracle for the Rust ports
   (`apps/puzzled/scripts/export-generator-fixtures.ts`).
4. Do not reintroduce the REST `/api/v1` surface or a Hono client layer; the
   sole transport is Connect RPC.

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
