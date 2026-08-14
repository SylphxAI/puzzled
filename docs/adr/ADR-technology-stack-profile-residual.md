# ADR: technology-stack-profile residual honesty

- **Status:** Accepted (clean migrate — sole createClient generated Connect client)
- **Date:** 2026-07-30
- **Profile:** SylphxAI/skills `technology-stack-profile`

## Context

Puzzled is **dev-phase / non-public-serving**. Product RPC generated Connect path uses
buffa + connectrpc + createClient (`puzzle-client` / `stats-client`).

## Decision

1. Product RPC authority is buffa + connectrpc on Rust product services.
2. Web generated Connect path uses createClient only under default connect (no hand-JSON dual).
3. Pure residual authority opt-out remains for offline fixtures only.

## Residual inventory

- No `*-residual.ts` hand-JSON dual modules remain under `src/lib/connect`.
- Product admission/authority modules gate pure vs connect without dual success.

## Validation

```bash
buf lint
bun test src/lib/connect
cargo test -p puzzled --lib
```
