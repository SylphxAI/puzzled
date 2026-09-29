# Puzzled

Daily light brain games: nineteen puzzles, one always free. Owner: SylphxAI
(Sylphx Apps). Start with [README.md](README.md), then [docs/vision.md](docs/vision.md)
for the goal and what we will not do.

## What to optimise

The North Star is **daily puzzle completers** (players who finish at least one
daily puzzle per product day; [docs/metrics.md](docs/metrics.md)). Prefer changes
that make finishing, sharing and returning faster, and judge them by that
number and by D7 retention, not by how many features exist.

## Commands

```bash
bun run lint
bun run typecheck
bun run test
bun run build
bun run check:proto-buf
cargo test -p puzzled-core -p puzzled-server
cargo clippy -p puzzled-core -p puzzled-server -- -D warnings
atlas migrate hash --dir file://apps/puzzled/atlas/migrations   # after touching a migration
```

Run the narrowest affected check first; the full workspace is for the end.

## Architecture in brief

- `crates/puzzled-core`: game rules, grading and policy, no I/O (functional core).
- `crates/puzzled-server`: the Rust api, the only service that decides results
  and writes to the database (imperative shell). Connect RPC is the sole transport.
- `apps/puzzled`: the Next.js site, presentation only. It calls the api through
  a generated Connect client.
- Daily puzzles are generated, validated and stored by the Rust pipeline
  (`crates/puzzled-server/src/capabilities/daily_pipeline`), 14 days ahead. The
  TypeScript generators stay only as the reference implementation the Rust ports
  are tested against (`apps/puzzled/scripts/export-generator-fixtures.ts`).
- Why one authority: a client that holds an answer or asserts a finish can be
  cheated, and two write paths drift. So do not add TypeScript backend logic
  (jobs, generation, database writes) or a REST `/api/v1` or Hono layer, and do
  not put answers in any client payload. Rationale in
  [ADR-170](docs/adr/ADR-170-clean-break-north-star.md).

## Gotchas the code will not teach you

- **No manual catalogue writes:** `config/commercial/catalogue.json` is applied
  to Sylphx Money only by `.github/workflows/money-catalogue.yml`; change prices,
  features and seats by PR to that file.

- **Day key is `Asia/Hong_Kong`, computed on the server.** Never derive "today"
  from a client clock or UTC; the shared daily puzzle and the finish rule depend on it.
- **One finish per `(user, game, day_key)`.** Keep the already-played guard even
  when a deterministic generator gives no `puzzle_id`.
- **The free daily puzzle never reads billing.** A failed entitlement read must
  refuse paid play and leave the free floor open. Payments run only through
  Sylphx Money; Puzzled holds no Stripe code or keys
  ([docs/monetization.md](docs/monetization.md)).
- **Migrations are forward-only in production.** Use expand then contract, run
  `atlas migrate hash` after editing, and take the next free migration number
  because open branches also add migrations.
- **Shared SDK and UI packages stay generic.** Put Puzzled-specific behaviour in
  this repository, so the packages remain reusable.
- **Secrets stay out of git:** no database URLs, Redis or auth credentials, or
  customer data.
- **The auth subject is Auth's id, not ours.** `auth_subjects` maps it to our
  player id; do not decode the ids ([docs/capabilities.md](docs/capabilities.md#boundaries)).
- **Show no "Sylphx" branding in user-facing copy.** The operator's legal name
  belongs only in the footer copyright line and legal pages.
- **Games are named descriptively.** No third-party marks as slugs or titles
  ([docs/catalog.md](docs/catalog.md#names)); `queens` and `tango` directories
  hold the `crowns` and `duo` games.

## CI and the merge queue

The queue runs only the fast gate (`ci.yml`: lint, typecheck, secret scan,
affected unit tests, and the migration lane when `apps/puzzled/atlas/` changes).
`verify.yml` runs the full suite (production web build, release binary,
database-backed Rust tests, SEO, accessibility, Lighthouse) after merge and
nightly, and marks the commit `verified`. A draft runs the gate only; a pull
request marked ready also runs the affected suite. See the
[optimistic-merge guide](https://github.com/SylphxAI/.github/blob/main/docs/optimistic-merge.md).

## Done means

A claim covers its own layer: local tests are not landed source, and a `200`
from `/healthz` is not a working product
([owner standard](https://github.com/SylphxAI/owner/blob/main/standards/docs.md#claims-stay-inside-their-layer)).
After a deploy, run `bun run verify:live --expected-sha <commit>`
([docs/reference/live-verification.md](docs/reference/live-verification.md)): it
checks the free daily path, that no answer reaches the client, and that the
deployed revision is the one you shipped; add `--play` to submit one guest finish.

## Where things live

| Topic | Doc |
| --- | --- |
| Goal, users, non-goals, targets | [docs/vision.md](docs/vision.md) |
| What exists and its status | [docs/capabilities.md](docs/capabilities.md) |
| Metric definitions and alerts | [docs/metrics.md](docs/metrics.md) |
| Rules every game follows | [docs/game-protocol.md](docs/game-protocol.md) |
| Game list, naming, admission | [docs/catalog.md](docs/catalog.md) |
| Growth loop and ranked backlog | [docs/growth.md](docs/growth.md) |
| Pricing, refunds, ads | [docs/monetization.md](docs/monetization.md) |
| Brand, tokens, page list | [docs/design/README.md](docs/design/README.md) |
| Errors, CSP, CI, live checks | [docs/observability.md](docs/observability.md), [docs/reference/](docs/reference) |
| Decisions | [docs/adr/](docs/adr) |

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
