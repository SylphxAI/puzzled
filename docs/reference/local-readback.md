# Local full-stack readback (`scripts/local-stack.ts`)

Run the whole [`scripts/verify-live.ts`](live-verification.md) check set against
a **local** stack — the real `crates/puzzled-server` binary, the real
`apps/puzzled` web build, and a real Postgres with the Atlas migrations
applied — instead of only the Connect surface.

## Layer

This is a **Local** readback, not a Live claim. It answers "is the product loop
correct in the revision I built?" while the platform Release path is what
answers "is production serving it?". A green local run never upgrades a Live
check: Live stays `bun run verify:live --base https://puzzled.gg
--expected-sha <sha>`.

Use it when:

- the deployed revision is older than the fix you want to verify, and you need
  the same assertions to be falsifiable *now*;
- a change touches the finish loop (submit / terminal / one-finish-per-day /
  completion readback) and unit tests alone would not prove the wiring;
- you want the post-deploy expectations from
  [`live-verification.md`](live-verification.md) rehearsed before a Promote.

## Requirements

- `bun`, `cargo`, and the `atlas` CLI on PATH (see the repo root `AGENTS.md`).
- A **scratch** Postgres database. Never point `DATABASE_URL` at a database
  that serves players: the `--play` run writes a real guest finish row.
- Node/Cargo dependencies installed (`bun install`, and the crate builds).

## Steps

```bash
# 1. Scratch database + schema (Atlas is the only migration writer).
psql -h localhost -U postgres -c 'CREATE DATABASE puzzled_local_readback;'
export DATABASE_URL="postgres://postgres:postgres@localhost:5432/puzzled_local_readback?sslmode=disable"
atlas migrate apply --dir file://apps/puzzled/atlas/migrations --url "$DATABASE_URL"

# 2. api — the Rust authority (owns Postgres). GIT_COMMIT_SHA makes /healthz
#    report the revision, which is what --expected-sha asserts against.
GIT_COMMIT_SHA=$(git rev-parse HEAD) PUZZLED_HTTP_PORT=8787 DATABASE_URL="$DATABASE_URL" \
  cargo run -p puzzled-server &

# 3. web — presentation only; it must boot without DATABASE_URL and reach the
#    api through API_INTERNAL_URL (the platform injects the same value).
(cd apps/puzzled && API_INTERNAL_URL=http://127.0.0.1:8787 PORT=3000 bun run dev)

# 4. ingress — mirrors the sylphx.toml split: Connect namespace + probes go to
#    the api, everything else to the web service.
PUZZLED_API_PORT=8787 bun scripts/local-stack.ts
```

`--base http://127.0.0.1:9999` is enough to pass: the harness accepts a
loopback canonical when the target host is loopback, and `marks-scan` accepts
localhost origins for a local target.

To rehearse the **public-host** path as well (the canonical / JSON-LD origin a
real visitor gets), map the product hostname to loopback for the duration of
the run and remove it afterwards:

```bash
echo '127.0.0.1 puzzled.gg' | sudo tee -a /etc/hosts   # temporary, optional
bun run verify:live --base http://puzzled.gg:9999 --play --json
sudo sed -i '/127\.0\.0\.1 puzzled\.gg/d' /etc/hosts   # then remove it
```

With that mapping the canonical resolves to `https://puzzled.gg` (public hosts
are always https), which is what production must advertise. Without it the
local run still passes; it just never exercises the non-loopback branch of the
origin resolver. A production build ignores a loopback
`NEXT_PUBLIC_APP_URL` and falls back to `https://puzzled.gg`, so a local
*production* `next build` also does not need the mapping.

## What the local run can and cannot assert

| Check | Locally | Why |
| --- | --- | --- |
| `free-slug-discovery`, `daily-serve`, `premium-fail-closed` | pass | Real GetDaily against the real schema and rotation. |
| `finish-loop` | pass on a revision that records honest losses | Terminal recorded, `hasCompleted` on re-read, second submit refused `already_played`. On a revision that still hard-codes the win claim this check fails with `Invalid win claim …` — that failure is the point of the check, not a local artifact. |
| `web-document`, `marks-scan` | pass | The web layer is what renders canonical/JSON-LD/CTA; loopback targets are accepted as-is. |
| `share-deep-link` | `unknown` | The harness cannot solve the free module, so the solution signature stays unknown; the landing-page shape and non-spoiler checks still run. |
| `healthz` `git-commit-sha` | pass when launched with `GIT_COMMIT_SHA` | The api reads `SYLPHX_GIT_COMMIT_SHA`/`GIT_COMMIT_SHA`/`GIT_SHA`/`GITHUB_SHA` and omits the field when unset. Without it the sub-check is `fail` (200 + no sha), so step 2 sets it from `git rev-parse HEAD`. |

## What a green local `finish-loop` proves

`SubmitGuess` → `200 valid=true status=lost` (an honest give-up is a terminal,
not an "Invalid win claim"), `GetDaily` re-read → `hasCompleted=true` with the
completed session, and a second terminal → `409 already_played`. The row the
run writes is a qualifying ritual finish, so the North Star recipe is
recomputable against it:

```sql
-- daily puzzle completers for one product day (Asia/Hong_Kong day key)
SELECT COUNT(DISTINCT user_id)::bigint AS daily_puzzle_completers
FROM game_sessions
WHERE day_key = 'YYYY-MM-DD'
  AND is_ritual = true
  AND module_class = 'puzzle_ritual'
  AND status IN ('won', 'lost');
```

The same statement is published in Rust as
`crates/puzzled-core/.../ritual_completion.rs` (`DRC_RECOMPUTE_SQL`) and
asserted by `crates/puzzled-server` tests, so the local run closes the loop
from client submission to the metric definition.
