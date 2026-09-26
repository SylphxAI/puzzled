![Puzzled](https://mark.sylphx.com/api/v1/mark/hero.svg?type=grid&color=0%3A9a3412%2C50%3Af97316%2C100%3Afb923c&text=Puzzled&desc=Short%20daily%20brain%20games)

# Puzzled

Short daily brain games at [puzzled.gg](https://puzzled.gg): a few minutes a
day, one shared puzzle for everyone, and a result card you can share without
spoiling the answer. Today's featured puzzle is free for everyone; Puzzled
Plus, a subscription, opens every other game, the archive of past days and a
family plan ([pricing and policy](docs/north-star/MONETIZATION.md)).

- Product vision: [docs/vision.md](docs/vision.md)
- Capabilities and their status: [docs/capabilities.md](docs/capabilities.md)

## How it is built

```text
browser -> /puzzled.v1.*, /healthz, /readyz -> api (Rust)
Stripe  -> /webhooks/stripe                 -> api (Rust)
ops     -> /observability/test              -> api (Rust)
        -> everything else                  -> web (Next.js)
```

- **api** ([crates/puzzled-server](crates/puzzled-server)): a
  [Connect](https://connectrpc.com) RPC server. It is the only service that
  decides game results and the only one that writes to the database. It
  also owns Puzzled Plus: the entitlement, the money ledger and the Stripe
  integration (Stripe is the payment processor).
- **core** ([crates/puzzled-core](crates/puzzled-core)): the game rules,
  answer checking and scoring, with no I/O.
- **web** ([apps/puzzled](apps/puzzled)): the Next.js site. It renders pages
  and calls the api through a generated Connect client.
- **db**: PostgreSQL, with schema migrations managed by Atlas.

Server and browser errors go to Sylphx Observability; see
[docs/observability.md](docs/observability.md).

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
