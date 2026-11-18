# Live verification harness (`scripts/verify-live.ts`)

Re-runnable post-deploy checks of the **Live** layer from
[live layer](https://github.com/SylphxAI/owner/blob/main/standards/docs.md#claims-stay-inside-their-layer)
for the capability graph in [`docs/capabilities.md`](../capabilities.md):
`PUZ-MODULE`, `PUZ-DAILY`, `PUZ-FREE`, `PUZ-SHARE`, `PUZ-MARKS`, and the
anonymous half of `PUZ-PLUS`. Every game offers today's daily to a fresh
visitor. A passive read returns metadata, not the board, and does not spend a
pick. An explicit start for a distinct game claims a pick. Once Plus is on
sale, the fourth distinct start and past-day play require Plus. The featured
rotation suggests a game; it does not decide which games are free.

The harness is Bun + `fetch` only (no dependencies, no new packages) and it
never infers success from a proxy: every check prints `pass` / `fail` /
`unknown` plus the raw evidence behind it (HTTP status, timing, response
excerpts, SHA-256 fingerprints, and the `x-revision-sha` header the router
stamps on `/healthz`).

## Accessibility quarantine

The shared browser axe gate temporarily quarantines only its `document-title`
assertion while asynchronous hydration removes and restores an otherwise correct
page title. All other axe rules, behavioural accessibility checks, CSP and
production-transport terminal regressions remain enforced. Raw axe violations,
including title findings, remain attached to each audit; a green gate does not
claim title conformance during this quarantine.

[Issue #322](https://github.com/SylphxAI/puzzled/issues/322) owns the separate
hydration root fix (ops/title-fix builder) and explicit removal criteria: prove
stable/atomic localized metadata through hydration and navigation, add a
deterministic regression, restore normal title enforcement, and verify full
merged-main accessibility, CSP terminal tests and production readback. Do not
retry the flaky assertion or broaden this quarantine.

The language-popup motion quarantine from #547 is removed. `test:a11y` includes
`language-menu.e2e.ts`: it holds first-visit guest admission, opens the menu,
then releases the cookie response and verifies that the header and open menu
survive the RSC refresh. The shared and private layouts keep the same Suspense
boundaries so React preserves client state. Before hydration, language triggers
are disabled and show a loading spinner with `aria-busy`.

Popup motion checks drive the browser clock before opening and wait explicitly
for lazy content. Both motion preferences are checked on the first entrance and
after reopening; a static popup and an absent popup validate the measurement.
The first reduced-motion entrance may jump directly from its mount style to
the settled endpoint, but must not interpolate or move repeatedly. Reopened
reduced-motion popups must keep one transform throughout the measurement.

## Commands

```bash
# Read-only (default). Live checks against https://tryit.fun.
bun scripts/verify-live.ts

# Same, via the repo-root alias.
bun run verify:live

# Machine-readable report on stdout.
bun scripts/verify-live.ts --base https://tryit.fun --json

# Post-deploy: assert the deployed revision (prefix match either direction).
bun run verify:live --expected-sha <commit-sha>

# Only against an approved target: bootstraps a guest, starts three games,
# tests the cap if Plus is on sale, and writes one Sudoku finish.
bun scripts/verify-live.ts --play

# Failure demo against a deliberately wrong base.
bun scripts/verify-live.ts --base https://example.com --json

# Regression self-test: loopback stub only, no production calls or writes.
# Proves the reviewed failure classes stay non-green and that a healthy stub
# can go green for the right reasons.
bun scripts/verify-live.ts --self-test
bun run verify:live:selftest
```

The script lives at the repo root because it has no app dependencies (root
alias: `bun run verify:live`; it is not wired into any CI workflow).
`--base <url>` overrides the target (default `https://tryit.fun`),
`--timeout <ms>` the per-request timeout (default 20000), `--json` the report
format, and `-h/--help` usage. `--guest <uuid>` is an optional run label in
the report's `guestId` field, not a credential; each play run uses a newly
issued guest cookie. The cookie is not reported.

`--self-test` runs both modes against throwaway HTTP stubs on loopback. The
stub checks that read-only sends no bootstrap, start, grading, or submit
requests. The play cases check the write order, same-origin guest cookie,
started board, fourth-pick refusal, and accepted and duplicate terminals.
Missing evidence (for example, repeated 5xx responses or a missing solved
signature in play mode) stays non-green. All dates are pinned. No external
service is contacted.

## What each check proves

| Check id | Assertion | Raw evidence recorded |
| --- | --- | --- |
| `healthz` | `GET /healthz` is 200 with exactly `{"status":"ok"}` and `Cache-Control: no-store`, and the router's `x-revision-sha` header names the serving revision; with `--expected-sha`, that SHA must match the expected value | status, timing, body, `cache-control`, `x-revision-sha`, expected SHA + match/mismatch |
| `readyz` | `GET /readyz` is 200 with exactly `{"status":"ok"}` (the api answers 503 `{"status":"not_ready"}` unless its Postgres ping succeeds) and `Cache-Control: no-store`, and its `x-revision-sha` matches `/healthz` | status, body, `cache-control`, SHA pair |
| `web-document` | `GET /` is 200 HTML, does not point to a localhost canonical on a real domain, and links to the day's featured game (same origin, one optional locale prefix). This checks the homepage suggestion, not access. | canonical URL, matching and rejected hrefs, rendered-text excerpt |
| `free-slug-discovery` | Anonymous `GetDaily` returns HTTP 200 for every catalog game, whether Plus is on sale or not. A 5xx or transport failure is retried once per game; a repeated failure is indeterminate. | per-game statuses, Connect errors, timings, both attempts when retried |
| `daily-serve` | Each cold response identifies the requested game and today's Hong Kong date, has `requiresStart: true` and `canPlay: true`, and omits `puzzleDataJson`, completion, and solution keys. This does **not** establish playable board delivery. | flags, dates and board presence for each game, leak key paths |
| `start-daily` (`--play`) | Bootstrap a fresh `__Host-puzzled_guest` cookie, then POST `StartDaily` with `{gameSlug,difficulty,puzzleDate}` for Sudoku, Word Guess, and Nonogram using the same cookie and browser origin. Each response must wrap a playable board as `{daily: <GetDailyResponse>}`, without answer keys. When `ListPlans` says Plus is on sale, a fourth distinct start (Crowns) must return 403 `plus_required` with no board. No fourth start is attempted when sales are closed. | bootstrap status, start requests, HTTP and Connect status, keys found, sales state |
| `finish-loop` (`--play`) | Build a terminal from the Sudoku board returned by `StartDaily`; submit using that session and puzzle identity. Verify `hasCompleted=true` and `completedSession` on re-read and 409 `already_played` on a duplicate. | solver plan, response statuses and hashes, completion readback |
| `share-deep-link` | `/games/<slug>?date=<product-day>` ends on a same-origin module path with 200 HTML and no solution-shaped JSON keys. The harness chooses the documented URL; it does not see the app generate share text. | path and redirect chain, content type, leak-pattern hits |
| `share-solution-signature` (`--play`) | Compare a locally solved Sudoku grid from `StartDaily` against the anonymous share landing. Read-only explicitly skips this comparison; play without a unique solution is indeterminate. | signature count, fingerprints and hits, not solution contents |
| `archive-open` | For yesterday, anonymous `GetDaily` is 200 (with yesterday's date) while Plus is not on sale and 403 `plus_required_archive` once it is. For today + 2 it is 400 `future_puzzle_date`. Unreadable sale state or a 5xx/transport failure is indeterminate. | ListPlans status, past and future responses, Connect errors, timings |
| `marks-scan` | the [catalog](../catalog.md#names) marks do not appear in `title` / meta / `JSON-LD` / manifest `short_name`-class fields, and no `JSON-LD`/canonical URL is a localhost origin on a non-local host; marks anywhere else are reported as warnings with exact context; a manifest that cannot be observed makes the dimension `unknown`, not a silent pass | per-target SHA-256, hard failures with zone + context, warnings with context, manifest fields/URL/state |

The product day is the Asia/Hong_Kong calendar date (UTC+8, no DST). The
harness checks every cold response against that date. The report attributes
the day to the featured game's response only when it agrees with the local
Hong Kong date; otherwise it shows the local expectation.

## Evidence-layer statement (what this does NOT prove)

This is **Live**-layer evidence only, for the revision the serving router
reports. It does **not** establish:

- **Source / CI / Landed**: nothing about the git history, tests, or review of
  the responded revision.
- **Artifact / Released / Deployed**: no image digest, provenance, SBOM, or
  rollout check. `liveRevision` is the `x-revision-sha` the router *claims*
  on `/healthz`; the harness does not verify that mapping. `--expected-sha`
  strengthens this from a self-reported check to an asserted match with the
  deploy you expected, but the claim is still self-reported — it does not
  establish digest, provenance, or rollout state.
- **North Star metric**: completing one guest ritual is not `daily puzzle
  completers`. Recomputing the metric from canonical `game_sessions` rows
  remains the
  [metric recompute](../metrics.md) — this harness does not
  query the warehouse.
- **Coverage**: all catalog games are probed for cold metadata, not for board
  quality or finish acceptance. Play samples three starts and one finish. It
  does not cover signed-in or paid play, admin, the archive UI, client-rendered
  DOM state, email or push, or the app's generated share text.
- **Continuity**: a green run is a point-in-time observation of one product
  day, not a guarantee of the next day's rotation, content, or deploy.

A check that cannot obtain its evidence never reports `pass`. A liveness or
readiness probe that returns a non-200 **response** is a `fail`; a transport
failure with no response is `unknown`. A daily probe that only returns 5xx or
transport failures after its one retry is indeterminate. A non-product page
makes the mark scan unknown. Only the three checks deliberately skipped in
read-only mode (starts, finishing, and solution-signature comparison) can be
`not_attempted`. An indeterminate check keeps the run non-green, just like a
failure.

Response bodies are read with a hard 4 MiB cap (`bodyTruncated`,
`bodySha256Scope`) so a hostile or misbehaving `--base` cannot force unbounded
memory; `--timeout` bounds each request. Whole-document **negative**
assertions — the mark scan, the localhost-origin scan, the landing
solution-key/signature scans — report `unknown` when the backing body was
truncated, so a page cut off at the cap can never green a "no marks / no leak"
claim.

### Daily percentile verification

`GetTodayPercentile` now reads the admitted viewer's **accepted** daily finish,
not the score/status/counts in the request. Send `gameSlug` and the result's
`dayKey`; the API checks that day against Asia/Hong_Kong today. Responses are
private/no-store and contain aggregate counts, never other players' rows.

The denominator includes every accepted, non-excluded daily ritual win/loss
for that game/day, including the viewer. Wins sort above losses. Within the
same outcome: Word Hive and Word Groups use higher accepted score; Word Guess,
Quad Words, Arithmo and Word Box use fewer attempts; Cryptogram uses fewer
accepted hints then faster elapsed time; other games use faster elapsed time.
Only strictly worse results are beaten; ties (including self) remain in the
denominator. Percentile is rounded `100 * beaten / total`, withheld below ten.

`dispatch` distinguishes `empty_cohort`, `insufficient_cohort`,
`accepted_finish_required`, `different_day`, `unavailable_data` and a real
`product_db_sessions` percentile. Legacy Cryptogram rows without accepted hint
metadata yield unavailable data rather than inventing zero hints. No-database
and failed reads also invent neither a count nor a percentile.

Populated verification belongs in the migrated throwaway database tests
(`daily_percentile_tests`), never in production. The live harness marks all
Connect requests with `x-puzzled-verification`; accepted finishes bearing that
header (or the older harness user agent) are excluded from comparisons. The
marker can only opt out; it grants no identity, acceptance or ranking authority.
The read-only harness remains the production default. A fresh production
percentile read must agree with the serving SHA and these isolated fixtures;
do not seed or export personal production rows to prove a percentile.

The separate [retained checkout check](checkout-journey.md) verifies unpaid
production checkout. It has its own synthetic fixture and does not imply a
Stripe Test Mode payment receipt.
