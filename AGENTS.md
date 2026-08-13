# puzzled — local agent notes only

Static engineering and delivery standards load from the active Skills runtime
([SylphxAI/skills](https://github.com/SylphxAI/skills) is binding instruction
SSOT). Doctrine and Mission Control are retired historical lineage and must not
be loaded as current instruction authority.

Local truth: `PROJECT.md`, `docs/adr/`, `.doctrine/project.json` when present.

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
   — the content tool (`apps/puzzled/scripts/generate-content.ts`) is the only
   non-Rust backend-adjacent code and it is a standalone tool, not a service.
4. Do not reintroduce the REST `/api/v1` surface or a Hono client layer; the
   sole transport is Connect RPC.
