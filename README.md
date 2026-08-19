# Puzzled

Puzzled is a daily light brain-games platform: short, positive rituals under one module protocol.

- Ordinary: https://puzzled.gg — named public customer domain on Sylphx Platform (`puzzled.gg`). DNS and TLS are active; HTTP GET timed out at observation. Reachability is not the product contract.
- Preview: none — no product-owned current preview URL. GitHub Pages is absent. `https://puzzled-gg.vercel.app` is leftover Vercel (`DEPLOYMENT_NOT_FOUND`) and is not production.
- Vision: [`docs/vision.md`](docs/vision.md)
- Capabilities: [`docs/capabilities.md`](docs/capabilities.md)
- Decisions: [`docs/adr/`](docs/adr/)

## Product

| | |
|--|--|
| Promise | Minutes a day, optional depth, shareable non-spoiler results |
| NSM | Distinct users who complete ≥1 puzzle ritual per product day |
| Money | Free daily finish floor; paid archive/suite/stats |

Repo entry: [`PROJECT.md`](PROJECT.md). North Star package: [`docs/north-star/README.md`](docs/north-star/README.md).

## System

```
edge -> /puzzled.v1.* /healthz /readyz -> api (Rust, sole authority)
      -> /*                             -> web (Next.js, no backend authority)
```

- **api** (`crates/puzzled-server`): Connect RPC only. Identity from Platform JWT.
- **web** (`apps/puzzled`): presentation only. Generated Connect client; Platform SDK for auth/billing/flags.
- **core** (`crates/puzzled-core`): pure game rules, validation, scoring, policy.
- **db**: Atlas-managed Postgres; the api service is the single runtime writer.

## Local

```bash
bun run lint
bun run typecheck
bun run test
cargo test -p puzzled-core -p puzzled-server
```
