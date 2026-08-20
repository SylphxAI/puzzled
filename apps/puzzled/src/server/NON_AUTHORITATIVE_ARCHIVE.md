# Hybrid residual TypeScript (puzzled)

Work: `wi_01KYFN6993PMG8WD00Q51AE231`

## Sole-Rust public API
`sylphx.toml` service `api` (`crates/puzzled-server`) path_prefixes:
`/healthz`, `/readyz`, `/api/leaderboard`, `/api/v1` (complete public API namespace).

## Retired source
The stale TypeScript puzzle-generation and display-cache implementations that
were formerly retained under this directory had no import edges from the
current product and no configured ingress. They are deleted rather than kept as
editable reference code; Git history is the archive.

Do not reintroduce executable TypeScript backend source under
`apps/puzzled/src/server/**`. Product API policy belongs to the Rust service.
`packages/sdk/src/server/**` is an intentional SDK server package, not a
Puzzled product backend. Platform job webhooks remain explicit web residuals
until Rust job adapters own their full I/O (see `sylphx.toml`).
