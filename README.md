![Puzzled](https://mark.sylphx.com/api/v1/mark/hero.svg?type=grid&color=0%3A9a3412%2C50%3Af97316%2C100%3Afb923c&text=Puzzled&desc=Short%20daily%20brain%20games)

# Puzzled

Short daily brain games at [puzzled.gg](https://puzzled.gg): a few minutes a
day, one shared puzzle for everyone, and a result card you can share without
spoiling the answer. Today's featured puzzle is free for everyone. Puzzled
Plus, a subscription that opens every other game, the archive of past days and
a family plan, is built but not on sale: no payment account is connected, so
checkout is closed and nothing is locked. Billing moves to Sylphx Money, the
platform's payments service, before it opens
([pricing and policy](docs/north-star/MONETIZATION.md)).

- Product vision: [docs/vision.md](docs/vision.md)
- Capabilities and their status: [docs/capabilities.md](docs/capabilities.md)

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

Server and browser errors go to Sylphx Observability through the Sylphx SDK
(Sentry is gone); see [docs/observability.md](docs/observability.md). Every
page is served with a strict, nonce-based Content Security Policy
([docs/reference/csp.md](docs/reference/csp.md)). CI runs on our own runners.

Every game implements the same module interface: a daily puzzle keyed to the
date in Hong Kong time, a run, a finish, and a result card.

## Develop

Requires [Bun](https://bun.sh) and a Rust toolchain.

```bash
bun install
bun run lint
bun run typecheck
bun run test
cargo test -p puzzled-core -p puzzled-server
```
