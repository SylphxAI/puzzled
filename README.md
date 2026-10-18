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
ops     -> /observability/test              -> api (Rust)
        -> everything else (/api/health)    -> web (Next.js)
```

- **api** ([crates/puzzled-server](crates/puzzled-server)): a
  [Connect](https://connectrpc.com) RPC server. It is the only service that
  decides game results and the only one that writes to the database. Its
  daily-puzzle pipeline generates and stores every game's puzzle 14 days
  ahead (19 games), on an hourly Compute schedule, and grades guesses on the
  server, so the browser never holds an answer. Puzzled Plus is Sylphx Money's:
  the api asks Money for entitlements, creates its checkout sessions and reads
  its price list, and keeps only the family membership list.
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

### Daily Web Push configuration

The existing manifest/icons and install prompt are reused; `/sw.js` adds
notification reception without caching puzzles or account data. Daily browser
reminders use the existing Compute job and the player's saved local time/time
zone (#299), but send RFC 8291 encrypted Web Push directly from the Rust api
rather than the legacy Events device adapter. Services confirms the platform
has no Web Push yet. `PushSender` separates delivery from the reminder job;
`DirectVapidSender` is its only implementation. A future platform Notify sender
can replace it without changing reminder targeting or the job. Events still
sends win-back email.

Ops must set these on the **api** service (not the web build):

- `VAPID_PUBLIC_KEY`: URL-safe unpadded base64 of the 65-byte uncompressed P-256
  public key. `GetWebPushConfig` exposes only this public value to the browser.
- `VAPID_PRIVATE_KEY`: matching URL-safe unpadded base64 32-byte private key.
  Store it as a secret; never commit it or print it in logs.
- `VAPID_SUBJECT`: operator contact URI (`mailto:` or `https:`), used as the
  VAPID JWT subject.

A signed-in player opts in from Settings > Notifications, chooses a reminder
time, and can disable notifications there. iOS requires home-screen installation
(iOS 16.4+). A denied permission is not retried automatically. Subscriptions use
the existing player-keyed table with UUIDv7 ids minted in code; no new migration
is needed. Account erasure removes them through the existing erasure inventory;
unsubscribe/sign-out revoke the browser endpoint, and 404/410 deliveries prune
expired endpoints. The reminder claim is once per player per local day: if any
browser receives it, the claim stays held even when another endpoint fails.
Only a retryable failure with no successful delivery releases the claim for the
next tick. The keys are set on the production api. On 2026-10-05 a real
browser (Firefox, Mozilla push service) on a test account received the 18:45
UTC reminder and opened it: the click closed the notification and opened
`https://puzzled.gg/`. The test account was then deleted in Settings.
