# Live verification harness (`scripts/verify-live.ts`)

Re-runnable readbacks of the **Live** layer from
[`docs/north-star/EVIDENCE-AND-ORACLES.md`](../north-star/EVIDENCE-AND-ORACLES.md) §1
for the capability graph in [`docs/capabilities.md`](../capabilities.md):
`PUZ-MODULE`, `PUZ-DAILY`, `PUZ-FREE`, `PUZ-SHARE`, `PUZ-PLUS`, `PUZ-MARKS`.

The harness is Bun + `fetch` only (no dependencies, no new packages) and it
never infers success from a proxy: every check prints `pass` / `fail` /
`unknown` plus the raw evidence behind it (HTTP status, timing, response
excerpts, SHA-256 fingerprints, and the `git_commit_sha` the target reports).

## Commands

```bash
# Read-only (default). Live readbacks against https://puzzled.gg.
bun scripts/verify-live.ts

# Same, via the repo-root alias.
bun run verify:live

# Machine-readable report on stdout.
bun scripts/verify-live.ts --base https://puzzled.gg --json

# Post-deploy: assert the deployed revision (prefix match either direction).
bun run verify:live --expected-sha <commit-sha>

# Write check: submits ONE genuine terminal (guest session row) plus the
# one-finish-per-(user, module, product day) re-submit probe.
bun scripts/verify-live.ts --play --guest <uuid>

# Honest-failure demo against a deliberately wrong base.
bun scripts/verify-live.ts --base https://example.com --json

# Regression self-test: synthetic local stubs (no network target, no writes).
# Proves the reviewed failure classes stay non-green and that a healthy stub
# can go green for the right reasons.
bun scripts/verify-live.ts --self-test
bun run verify:live:selftest
```

The script lives at the repo root because it has no app dependencies (root
alias: `bun run verify:live`; it is not wired into any CI workflow).
`--base <url>` overrides the target (default `https://puzzled.gg`),
`--timeout <ms>` the per-request timeout (default 20000), `--guest <uuid>` a
stable guest UUID (default: a fresh random UUID, printed in the output),
`--json` the report format, `-h/--help` usage.

`--self-test` starts throwaway local `node:http` stubs (127.0.0.1, random port)
and runs the full check pipeline against them in-process: a healthy control
stub must go green, and stub cases for the reviewed defects (health document
absent, rotation 5xx on both attempts, deep link behind a login wall,
grid-leak compare without a local solution, empty `puzzleDataJson`) must stay
non-green. It never touches the network target and never writes.

`--expected-sha <sha>` asserts the `git_commit_sha` reported by `/healthz`
(case-insensitive prefix match either direction, so a short SHA works). A
mismatch fails the `healthz` check and prints both values; without the flag the
expected revision is `unknown (not asserted: no --expected-sha)` and the check
stays a pure readback. Use it for post-deploy live verification.

Exit codes: `0` = no check failed and no indeterminate `unknown` remains;
`1` = at least one required check failed, or any check other than the explicit
read-only exemption reported `unknown`; `2` = invalid arguments.

The finish loop reports `unknown / not_attempted` in read-only mode and does not
fail the run for it. That is the only pass-exempt `unknown`: the run verdict is
derived from check status, so a check that goes `unknown` because its evidence
is missing is `indeterminate` and fails the run even if it forgot to label
itself.

## What it writes

Without `--play` the harness only reads (`GET /`, `GET /healthz`, `GET /readyz`,
`GET /pricing`, `GET /games/...`, `GET /manifest.webmanifest`, and Connect
`GetDaily` reads with a guest id — read-only requests; anonymous guest reads do
not persist anything server-side).

`--play` performs `POST /puzzled.v1.PuzzleService/SubmitGuess` twice for one
guest UUID. Against production (`puzzled.gg`) the first accepted terminal is a
real **guest session row** for that UUID, module, and product day; the second
submission is the expected `already_played` refusal. Use a fresh `--guest` per
run: a reused guest already has an accepted finish for the day, so the harness
reports the finish loop as `unknown / indeterminate` instead of pretending a
terminal was accepted.

The guest UUID is `crypto.randomUUID()` by default and is printed in both the
human and JSON output, so any run can be traced by the `guest_<uuid>` logical
id in server records.

Re-running with the same `--guest` is safe (and read-only for the finish
loop): the daily serve then reports `hasCompleted=true` for that guest and the
finish loop reports `unknown / indeterminate` ("already has an accepted finish
for this module/product day") instead of submitting a second terminal.

The report never republishes a solution: the submitted terminal payload and any
locally solved grid appear as a byte count plus SHA-256, not as grid content.

## What each check proves

| Check id | Assertion | Raw evidence recorded |
| --- | --- | --- |
| `healthz` | `GET /healthz` is 200 and reports `git_commit_sha` (the live revision identity); with `--expected-sha`, that SHA must match the expected value | status, timing, body, reported SHA, expected SHA + match/mismatch |
| `readyz` | `GET /readyz` is 200, every dependency not explicitly marked `required: false` is `ok`, and its SHA matches `/healthz` | dependency array, `slice`, `stub`, SHA pair |
| `web-document` | `GET /` is 200 `text/html`; the canonical URL is not a localhost origin when the target is a real domain; the served HTML has a same-origin anchor to `/games/<today's free slug>` (one optional locale prefix; nested/off-site paths do not count) | canonical URL, matching and rejected hrefs, rendered-text excerpt |
| `free-slug-discovery` | across the five rotation slugs (`word-guess`, `word-groups`, `crowns`, `sudoku`, `crossword`) exactly one `GetDaily` is 200 and the others are 403 `premium_required` (fail-closed); the served `puzzleDate` equals the local `Asia/Hong_Kong` day key; a 5xx/transport failure is retried once per slug and stays `indeterminate` — never a pass | per-slug HTTP status, Connect `code`/`message`, timings, verdict classification, both attempts when retried, server vs local day key |
| `daily-serve` | the free slug returns 200 with a `puzzleDataJson` object carrying at least one key, a boolean/absent `hasCompleted` (false for a fresh guest), and no answer/solution keys anywhere in the response | parsed keys, `puzzleDate`/`puzzleNumber`/`mode`/`stub`, recursive key-scan findings |
| `finish-loop` (`--play`) | a genuine terminal is accepted server-side, `hasCompleted=true` + `completedSession` come back on re-read, and a second terminal for the same guest + module + product day is refused `already_played` | solver plan, both submit responses, re-read body |
| `share-deep-link` | `/games/<free>?date=<product-day>` ends on the module path (`/games/<free>`, one optional locale prefix, same origin) with 200 HTML after a documented same-origin redirect; the landing carries no solution-shaped JSON keys and no locally solved solution signature. The harness *requests* the documented module+`?date=` shape, but the app-side `formatRitualShareText` output is not observed here — no format/non-spoiler claim is made. Without a local solution (modules the harness cannot solve) the signature compare is `unknown` | path, redirect chain, final path/origin, content type/bytes, leak-pattern hits, signature count + redacted SHA-256s |
| `premium-fail-closed` | anonymous `GetDaily` for a past `puzzle_date` is 403 `premium_required`; `/pricing` is 200 and reachable from a gated (non-free) module page | archive request body, pricing response, `/pricing` hrefs on the gated surface |
| `marks-scan` | `CATALOG` §3.2 marks do not appear in `title` / meta / `JSON-LD` / manifest `short_name`-class fields, and no `JSON-LD`/canonical URL is a localhost origin on a non-local host; marks anywhere else are reported as warnings with exact context; a manifest that cannot be observed makes the dimension `unknown`, not a silent pass | per-target SHA-256, hard failures with zone + context, warnings with context, manifest fields/URL/state |

Product day key: `Asia/Hong_Kong` calendar date (fixed UTC+8, no DST — the same
shift the Rust `product_day_key` applies). The harness prefers the
`puzzleDate` the server serves on the free `GetDaily` (recorded as
`productDayKeySource: server GetDaily puzzleDate`), and *asserts* it equals the
local HKT date (`product-day-key-matches-hkt`); it falls back to the local HKC
date for the summary when discovery fails.

## Evidence-layer statement (what this does NOT prove)

This is **Live**-layer evidence only, for the revision the target itself
reports. It does **not** establish:

- **Source / CI / Landed**: nothing about the git history, tests, or review of
  the responded revision.
- **Artifact / Released / Deployed**: no image digest, provenance, SBOM, or
  rollout readback. `liveRevision` is the `git_commit_sha` the target *claims*
  on `/healthz`; the harness does not verify that mapping. `--expected-sha`
  strengthens this from a self-reported readback to an asserted match with the
  deploy you expected, but the claim is still self-reported — it does not
  establish digest, provenance, or rollout state.
- **North Star metric**: completing one guest ritual is not `daily puzzle
  completers`. Recomputing the metric from canonical `game_sessions` rows
  remains the
  [metric oracle](../north-star/NORTH-STAR-METRIC.md) — this harness does not
  query the warehouse.
- **Coverage**: authenticated/premium journeys (P4/P5), admin (P7), non-rotation
  modules beyond today's free slug, client-rendered DOM state (the harness reads
  served HTML, not a browser), email/push, and the share text as rendered in the
  product UI (`formatRitualShareText` output is **not** observed; only the
  requested module+`?date=` link and the landing leak checks are).
- **Continuity**: a green run is a point-in-time observation of one product
  day, not a guarantee of the next day's rotation, content, or deploy.

A check that cannot obtain its evidence never reports `pass`. A liveness or
readiness probe that returns a non-200 **response** is a `fail`; a transport
failure with no response is `unknown`. A rotation probe that only returns
5xx/transport failures after its one retry is `unknown`/`indeterminate` (a 5xx
is not evidence about the premium gate). A non-product page makes the mark scan
`unknown`. Every `unknown` except the explicit read-only finish-loop exemption
(`not_attempted`) keeps the run non-green, exactly like a `fail`.

Response bodies are read with a hard 4 MiB cap (`bodyTruncated`,
`bodySha256Scope`) so a hostile or misbehaving `--base` cannot force unbounded
memory; `--timeout` bounds each request. Whole-document **negative**
assertions — the mark scan, the localhost-origin scan, the landing
solution-key/signature scans — report `unknown` when the backing body was
truncated, so a page cut off at the cap can never green a "no marks / no leak"
claim.

On days whose free module the harness cannot solve (`word-guess`,
`word-groups`, `crossword`), the share signature compare has no local solution
to check and reports `unknown`, so read-only runs are structurally non-green
on those days. That is by design; run on a solvable free day (`sudoku`,
`crowns`) or accept the `unknown`.

## Post-deploy expectations (2026-09-11 fix set)

A deployed revision at or after `328009a` must flip these Live readbacks that
the pinned 2026-08-25 revision (`git_commit_sha=3675ab73…`, observed
2026-09-11) fails. Treat any still-red row as an incomplete deploy, not as a
harness problem:

| Readback | Pinned 2026-08-25 revision | Expected after the deploy |
|---|---|---|
| canonical / JSON-LD origin | `http://localhost:3000` | `https://puzzled.gg` (no `og:url`/`og:image`; the origin-bearing card field is `twitter:image` on `/` only) |
| served home HTML CTA | 0 free-game hrefs, "today's progress unavailable" | bounded hero (free module first) + `See all games` |
| `/games` catalog | 404 | 200, every registry module with CATALOG player titles |
| `/games/crowns` | 308 -> `/games/games/crowns` -> 404 | 200 on the canonical module path |
| `/crowns`, `/duo` inbound aliases | alias hop breaks (double prefix) | redirect to `/games/crowns` / `/games/duo`, final 200 |
| `/privacy`, `/terms` (anonymous) | 307 to `/login` | public 200 |
| `number-path`, `pip-place` (anonymous) | `404 unknown_game` | `403 premium_required` (known module, fail-closed) |
| marks scan on `/` and the free module | 8 hard hits (`Wordle`, `Connections` in meta/JSON-LD) | 0 hard hits |
| finish loop (`--play`) | pass (server-authoritative) | still pass; one finish per `(user, module, day_key)` |

Two different probe families cover the table. Run both and keep the raw
output with the record that claims the deploy.

```bash
# 1) Harness (healthz/readyz, rotation fail-closed, daily serve, share deep
#    link, premium fail-closed, marks scan, finish loop):
bun run verify:live --expected-sha <deployed-sha> --play --json

# 2) Surfaces the harness does not probe (compare each result to the table):
curl -sS -o /dev/null -w 'games %{http_code} %{url_effective}\n' -L https://puzzled.gg/games
curl -sS -o /dev/null -w 'crowns %{http_code} %{url_effective}\n' -L https://puzzled.gg/games/crowns
curl -sS -o /dev/null -w 'alias %{http_code} %{url_effective}\n' -L https://puzzled.gg/crowns
curl -sS -o /dev/null -w 'alias %{http_code} %{url_effective}\n' -L https://puzzled.gg/duo
curl -sS -o /dev/null -w 'privacy %{http_code} -> %{redirect_url}\n' https://puzzled.gg/privacy
curl -sS -o /dev/null -w 'terms %{http_code} -> %{redirect_url}\n' https://puzzled.gg/terms
curl -sS -X POST https://puzzled.gg/puzzled.v1.PuzzleService/GetDaily \
  -H 'content-type: application/json' -d '{"gameSlug":"number-path"}'
curl -sS -X POST https://puzzled.gg/puzzled.v1.PuzzleService/GetDaily \
  -H 'content-type: application/json' -d '{"gameSlug":"pip-place"}'
```

A green harness run alone is not the deploy evidence for this table: the
harness has no check for `/games`, the alias/legal routes, or the two new
modules. And on days whose free module the harness cannot solve
(`word-guess`, `word-groups`, `crossword`) the share signature compare is
`unknown` by design (see above), so the command exits non-zero on a complete
deploy — run it on a `sudoku`/`crowns` day or accept the documented `unknown`.
