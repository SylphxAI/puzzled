![Puzzled](https://mark.sylphx.com/api/v1/mark/hero.svg?type=grid&color=0%3A9a3412%2C50%3Af97316%2C100%3Afb923c&text=Puzzled&desc=Short%20daily%20brain%20games)

# Puzzled: nineteen daily puzzles, one always free. [puzzled.gg](https://puzzled.gg)

[![website](https://mark.sylphx.com/badge/play-puzzled.gg-f97316?style=flat-square&labelColor=1a1712)](https://puzzled.gg)
[![stars](https://mark.sylphx.com/github/stars/SylphxAI/puzzled?style=flat-square&labelColor=1a1712&color=f97316)](https://github.com/SylphxAI/puzzled/stargazers)
[![license](https://mark.sylphx.com/badge/license-MIT-f97316?style=flat-square&labelColor=1a1712)](LICENSE)

Short daily brain games for anyone with a few minutes: one shared puzzle for
everyone each day, and a result card you can share without spoiling the answer.
Today's featured puzzle is free with no account. Puzzled Plus, a subscription
that opens every other game, the archive of past days and a family plan, is built
but not on sale until payments run through Sylphx Money, the platform's payments
service ([pricing and policy](docs/monetization.md)).

- Goal, users and what we will not do: [docs/vision.md](docs/vision.md)
- Capabilities and their status: [docs/capabilities.md](docs/capabilities.md)
- Metrics, game rules, growth, design: [docs/](docs) (index in [AGENTS.md](AGENTS.md#where-things-live))

## How it is built

```text
browser -> /puzzled.v1.*, /healthz, /readyz -> api (Rust)
Compute -> /internal/compute/*              -> api (Rust)  scheduled jobs
Stripe  -> /webhooks/stripe                 -> api (Rust)  dormant, no keys
ops     -> /observability/test              -> api (Rust)
        -> everything else (/api/health)    -> web (Next.js)
```

- **api** ([crates/puzzled-server](crates/puzzled-server)): a
  [Connect](https://connectrpc.com) RPC server. It is the only service that
  decides game results and the only one that writes to the database. Its
  daily-puzzle pipeline generates and stores every game's puzzle 14 days
  ahead (19 games), on an hourly Compute schedule, and grades guesses on the
  server, so the browser never holds an answer. It also holds the dormant
  Puzzled Plus code (entitlement, ledger, Stripe adapter), which is replaced
  by Sylphx Money rather than switched on.
- **core** ([crates/puzzled-core](crates/puzzled-core)): the game rules,
  answer checking and scoring, with no I/O.
- **web** ([apps/puzzled](apps/puzzled)): the Next.js site. It renders pages
  and calls the api through a generated Connect client.
- **db**: PostgreSQL, with schema migrations managed by Atlas.

Server and browser errors go to Sylphx Observability through the Sylphx SDK,
with no third-party error service; see [docs/observability.md](docs/observability.md). Every
page is served with a strict, nonce-based Content Security Policy
([docs/reference/csp.md](docs/reference/csp.md)). CI runs on our own runners.

Every game follows one protocol: a daily puzzle keyed to the date in Hong Kong
time, a run, a finish and a result card ([docs/game-protocol.md](docs/game-protocol.md)).

## Develop

Requires [Bun](https://bun.sh) and a Rust toolchain.

```bash
bun install
bun run lint
bun run typecheck
bun run test
cargo test -p puzzled-core -p puzzled-server
```

A local full stack (api, web and a scratch Postgres) is described in
[docs/reference/local-stack.md](docs/reference/local-stack.md).

## Test and deploy

Pull requests go through the merge queue, which runs a fast gate; the full suite
runs after merge and nightly ([AGENTS.md](AGENTS.md#ci-and-the-merge-queue)). A
merged commit that passes is deployed by the platform from `sylphx.toml`, with
schema migrations applied by an Atlas job first. After a deploy, run
`bun run verify:live` to check production
([docs/reference/live-verification.md](docs/reference/live-verification.md)).
