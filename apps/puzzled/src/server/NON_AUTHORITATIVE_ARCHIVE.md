# Hybrid residual TypeScript (puzzled)

Work: `wi_01KYFN6993PMG8WD00Q51AE231`

## Sole-Rust public API
`sylphx.toml` service `api` (`crates/puzzled-server`) path_prefixes:
`/healthz`, `/readyz`, `/api/leaderboard`, `/api/v1` (complete public API namespace).

## Residual
`apps/puzzled/src/server/**` and some `packages/sdk/src/server/**` are web/SDK residual.
Do not re-author product API policy in TS. Platform job webhooks residual may remain on web until Rust job adapters own full I/O (see sylphx.toml comments).
