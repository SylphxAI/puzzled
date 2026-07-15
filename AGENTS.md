# puzzled — local agent notes only

Doctrine and fleet delivery law live in the **host always-on constitution**
(`~/.grok/AGENTS.md` / Doctrine template). This file must **not** restate,
weaken, or fork that law (including PR-vs-direct-trunk delivery).

Local truth: [`PROJECT.md`](./PROJECT.md), [`.doctrine/project.json`](./.doctrine/project.json)
when present.

## Boundary hazards

- Atlas migrations and `release_command` are forward-only; use expand/contract
  and verify migration checksums.
- Do not put Puzzled-specific behavior into shared SDK/UI packages unless
  generalized and documented.
- Never commit secrets, database URLs, Redis credentials, auth secrets, or
  customer data.

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

- Docs-only: diff review + referenced paths exist.
- Runtime / migration / auth / billing / analytics / deploy: tests + readback
  when in scope.
- Report layers honestly: local diff · trunk FF · deploy · prod proof.
