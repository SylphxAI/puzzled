# puzzled — local agent notes only

Static engineering and delivery standards load from the active Skills runtime
([SylphxAI/skills](https://github.com/SylphxAI/skills) is binding instruction
SSOT). Doctrine and Mission Control are retired historical lineage and must not
be loaded as current instruction authority.

Local truth: `PROJECT.md`, `docs/adr/`, `.doctrine/project.json` when present.

Architecture SSOT: binding Skills `engineering-standard` + ADR-169/ADR-170 (`docs/adr/`).
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
