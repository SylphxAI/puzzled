# puzzled — local agent notes only

Static engineering and delivery standards load from the active Skills runtime
([SylphxAI/skills](https://github.com/SylphxAI/skills) is binding instruction
SSOT). Doctrine and Mission Control are retired historical lineage and must not
be loaded as current instruction authority.

Local truth: `PROJECT.md`, `docs/adr/`, `.doctrine/project.json` when present.

Architecture SSOT: binding Skills `engineering-standard` + `docs/adr/ADR-169-capability-first-modular-ddd.md`.
Rust layout: `crates/puzzled-core` (functional core) + `crates/puzzled-server` (imperative shell).

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
- Report layers honestly: local diff · trunk FF · deploy · prod proof (do not collapse).

## Language hygiene

Machine gate: `bash scripts/check-language-hygiene.sh`.

## Backend false-authority fence

Work: wi_01KYFN6993PMG8WD00Q51AE231

If this repository has completed a **Rust backend** cutover:

1. Production backend behavior authority is the Rust crate/binary/service path declared in `sylphx.toml` / deploy manifests / package `bin` native path / Docker ENTRYPOINT.
2. Residual TypeScript service trees or alternate TS engines are **not** product authority unless explicitly proven still on the live path.
3. Do not "fix production" by editing residual TypeScript and assuming deploy/runtime will pick it up.
4. Prefer deleting residual TS backend trees after Rust sole proof; keep history in Git.
5. Intentional TypeScript frontends, npm packaging wrappers, and native-binding surfaces may remain.

### Repo-specific note

Prefer Rust crates for backend; residual TS server paths need deploy proof before treating as authority.
