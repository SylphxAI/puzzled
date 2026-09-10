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
```

The script lives at the repo root because it has no app dependencies (root
alias: `bun run verify:live`; it is not wired into any CI workflow).
`--base <url>` overrides the target (default `https://puzzled.gg`),
`--timeout <ms>` the per-request timeout (default 20000), `--guest <uuid>` a
stable guest UUID (default: a fresh random UUID, printed in the output),
`--json` the report format, `-h/--help` usage.

`--expected-sha <sha>` asserts the `git_commit_sha` reported by `/healthz`
(case-insensitive prefix match either direction, so a short SHA works). A
mismatch fails the `healthz` check and prints both values; without the flag the
expected revision is `unknown (not asserted: no --expected-sha)` and the check
stays a pure readback. Use it for post-deploy live verification.

Exit codes: `0` = no check failed and no indeterminate `unknown` remains;
`1` = at least one required check failed, or a check could not be determined
(including unreachable target); `2` = invalid arguments.

The finish loop reports `unknown / not_attempted` in read-only mode and does not
fail the run for it.

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
| `readyz` | `GET /readyz` is 200, every `required` dependency is `ok`, and its SHA matches `/healthz` | dependency array, `slice`, `stub`, SHA pair |
| `web-document` | `GET /` is 200 `text/html`; the canonical URL is not a localhost origin when the target is a real domain; the served HTML links to today's free module | canonical URL, href inventory for `/games/...`, rendered-text excerpt |
| `free-slug-discovery` | across the five rotation slugs (`word-guess`, `word-groups`, `crowns`, `sudoku`, `crossword`) exactly one `GetDaily` is 200 and the others are 403 `premium_required` (fail-closed); a 5xx/transport failure is retried once per slug and stays `indeterminate` — never a pass | per-slug HTTP status, Connect `code`/`message`, timings, verdict classification, both attempts when retried |
| `daily-serve` | the free slug returns 200 with non-empty `puzzleDataJson`, a boolean/absent `hasCompleted` (false for a fresh guest), and no answer/solution keys anywhere in the response | parsed keys, `puzzleDate`/`puzzleNumber`/`mode`/`stub`, recursive key-scan findings |
| `finish-loop` (`--play`) | a genuine terminal is accepted server-side, `hasCompleted=true` + `completedSession` come back on re-read, and a second terminal for the same guest + module + product day is refused `already_played` | solver plan, both submit responses, re-read body |
| `share-deep-link` | `/games/<free>?date=<product-day>` is 200 HTML (or a documented same-origin redirect), the landing does not leak the solution, and the path matches `formatRitualShareText` semantics (module + `?date=`, non-spoiler) | path, redirect chain, content type/bytes, leak-pattern hits, solved-grid comparison |
| `premium-fail-closed` | anonymous `GetDaily` for a past `puzzle_date` is 403 `premium_required`; `/pricing` is 200 and reachable from a gated (non-free) module page | archive request body, pricing response, `/pricing` hrefs on the gated surface |
| `marks-scan` | `CATALOG` §3.2 marks do not appear in `title` / meta / `JSON-LD` / manifest `short_name`-class fields, and no `JSON-LD`/canonical URL is a localhost origin on a non-local host; marks anywhere else are reported as warnings with exact context | per-target SHA-256, hard failures with zone + context, warnings with context, manifest fields |

Product day key: `Asia/Hong_Kong` calendar date (fixed UTC+8, no DST — the same
shift the Rust `product_day_key` applies). The harness prefers the
`puzzleDate` the server serves on the free `GetDaily` (recorded as
`productDayKeySource: server GetDaily puzzleDate`) and falls back to the local
HKC date for the summary when discovery fails.

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
  product UI (`formatRitualShareText` semantics are asserted on the path/format).
- **Continuity**: a green run is a point-in-time observation of one product
  day, not a guarantee of the next day's rotation, content, or deploy.

A check that cannot obtain its evidence never reports `pass`: a liveness or
readiness probe that does not return 200 is a `fail`; a rotation probe that
only returns 5xx/transport failures after its one retry is `unknown` /
`indeterminate`; a non-product page makes the mark scan `unknown`. `unknown`
with reason `indeterminate` keeps the run non-green, exactly like a `fail`.
