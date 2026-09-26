# Puzzled

Short daily brain games at [puzzled.gg](https://puzzled.gg): a few minutes a
day, one shared puzzle for everyone, and a result card you can share without
spoiling the answer. Every game is free to play.

- Product vision: [docs/vision.md](docs/vision.md)
- Capabilities and their status: [docs/capabilities.md](docs/capabilities.md)

## How it is built

```text
browser -> /puzzled.v1.*, /healthz, /readyz -> api (Rust)
        -> everything else                  -> web (Next.js)
```

- **api** ([crates/puzzled-server](crates/puzzled-server)): a
  [Connect](https://connectrpc.com) RPC server. It is the only service that
  decides game results and the only one that writes to the database.
- **core** ([crates/puzzled-core](crates/puzzled-core)): the game rules,
  answer checking and scoring, with no I/O.
- **web** ([apps/puzzled](apps/puzzled)): the Next.js site. It renders pages
  and calls the api through a generated Connect client.
- **db**: PostgreSQL, with schema migrations managed by Atlas.

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
