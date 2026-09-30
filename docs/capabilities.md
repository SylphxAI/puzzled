# Capabilities

What Puzzled can do, in what state, and where the code is. Destination is
[vision.md](vision.md); this table is not a plan, and a status is what an
end-to-end test measured, not what the code intends
([format](https://github.com/SylphxAI/owner/blob/main/standards/docs.md#capability-table)).
Cite the ID column.

| ID | Capability | Status | Code | Depends on |
| --- | --- | --- | --- | --- |
| PUZ-MODULE | Game protocol: day key, finish, result card, entitlement ([game-protocol.md](game-protocol.md)) | supported | `crates/puzzled-core/src/capabilities/puzzle_play` | none |
| PUZ-DAILY | Daily play across the catalog; any admitted game completes in about 5 to 15 minutes with a result card | supported | `apps/puzzled/src/games` | PUZ-MODULE |
| PUZ-FREE | Free daily finish: every product day a guest can finish at least one puzzle without payment or account, with a result card; the featured rotation flips at Hong Kong midnight; no billing read sits on the play path | supported | `crates/puzzled-server/src/capabilities/puzzle_play` | PUZ-MODULE |
| PUZ-NSM | Daily puzzle completers ([metrics.md](metrics.md)): recomputable from finish records, excluding archive, practice, entertainment, admin, dry-run and duplicates | supported | `crates/puzzled-core/src/capabilities/puzzle_play/domain/ritual_completion.rs` | PUZ-MODULE |
| PUZ-HABIT | Gentle return: a player can return the next day and find today's puzzle without push; streaks and milestones derive from accepted days; a missed day does not erase history, paid access or identity | supported | `crates/puzzled-server/src/capabilities/gamification` | PUZ-FREE |
| PUZ-SHARE | Non-spoiler share: text and card plus a game and `date=` link leak no solution; home does not dump the full catalog on cold users | supported | `apps/puzzled/src/features/daily/lib/share-text.ts` | PUZ-DAILY |
| PUZ-CONTENT | Daily-puzzle pipeline and server grading: every game's puzzle generated and stored 14 days ahead with a 30-day archive (19 games), hourly on Compute and at start-up, a missing day generated on first read; word games graded per guess (`CheckGuess`); clients play from a solution-free payload and the answer returns only with the accepted finish | supported | `crates/puzzled-server/src/capabilities/daily_pipeline` | PUZ-MODULE |
| PUZ-PLUS | Puzzled Plus: every game, archive, stats and a family plan; a player buys through Sylphx Money's hosted checkout, entitlements unlock paid play, the 14-day first-subscription refund and period-end cancellation hold, and a failed entitlement read refuses paid play. Policy in [monetization.md](monetization.md); the Stripe code is deployed but closed (no keys, nothing sold or locked) | blocked-on-platform | `crates/puzzled-server/src/capabilities/money` (switches on with `SYLPHX_MONEY_API_KEY`, a dedicated billing:read + billing:write key; never `SYLPHX_API_KEY`) | PUZ-FREE, Sylphx Money subscriptions (cloud#9152) |
| PUZ-TRYIT | Tryit conversion report: a sign-up with a Tryit `ref` (`utm_source=tryit`, kept in `puzzled_attr` after analytics consent) is queued in `tryit_conversions`, sent once to Tryit with a 3 second cap and retried every ten minutes on failure for 29 days; only the `ref` is sent; a first paid invoice is reported the same way | supported | `crates/puzzled-server/src/capabilities/tryit_conversions` | PUZ-OBS |
| PUZ-OBS | Errors to Sylphx Observability through the Sylphx SDK, no third-party error service: api panics and every 5xx (service, release, route template, message, stack) are scrubbed of emails, tokens, JWTs, keys and card-like numbers, deduplicated per fingerprint for 10 seconds and queued (64) for one worker that drops when full. Needs the environment key to carry `observability:ingest` (cloud#9450). See [observability.md](observability.md) | supported | `crates/puzzled-server/src/observability.rs` | none |
| PUZ-ORIGIN | Original content: daily puzzles are original or public domain, never another publisher's daily; entertainment games are play, not advice | supported | `crates/puzzled-core/src/capabilities/puzzle_play/generate` | PUZ-MODULE |
| PUZ-MARKS | No third-party marks as slugs or player titles ([catalog.md](catalog.md#names)); `crowns` and `duo` are canonical, `queens` and `tango` only redirect | supported | `crates/puzzled-core/src/capabilities/puzzle_play/domain/game_slugs.rs` | none |

## Boundaries

- **Live check:** on `https://puzzled.gg` a guest finishes today's featured
  puzzle without payment or account through Connect `PuzzleService`, then
  shares a non-spoiler card with a `?date=` link. `bun run verify:live` runs the
  read-only subset ([reference/live-verification.md](reference/live-verification.md)).
  `/healthz` and `/` returning 200 only show reachability.
- **This repository owns** `sylphx.toml` (the `web` and `api` Dockerfiles, path
  prefixes, health paths, and the Atlas migration Job on the `api` image) and the
  Atlas migrations in `apps/puzzled/atlas/migrations/`. `api` is the single
  runtime writer of the schema; web is presentation only, with no database.
- **Consumed:** a Sylphx Auth end-user session, checked with Auth once per
  request. `auth_subjects` maps the exact subject text Auth published to
  Puzzled's own player id (`uuid`), so both `principal-<uuid>` and the TypeID
  `usr_...` form (Auth's move, cloud#10008) reach the same player; never decode
  the new form. Compute's signed tick receipts (EdDSA JWT, `aud` equal to the
  exact URL) are the only admission for JobsService and `/internal/compute/*`.
- **Never:** a second play authority (REST `/api/v1`, Hono, client
  `isComplete`); another publisher's daily grid; third-party marks as titles;
  kube, route or deployment-spec writes; `{project}.api.sylphx.com` or a
  mega-client (owner ADR-038); a schedule or tick writer (Compute owns due
  time; JobsService handlers only receive); treating a GitHub check or deploy
  status as proof the product works.
