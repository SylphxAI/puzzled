# ADR-170 — Clean-break north star: sole Connect, sole Rust executor, content tool

- **Status:** Accepted
- **Date:** 2026-08-09
- **Supersedes:** ADR-169 transitional residual sections (job I/O authority,
  dual REST surface, "sole Connect" partial claims)
- **Relates to:** ADR-168 (transport north star), ADR-169 (capability shape)

## Product North Star (related)

Engineering stack decisions in this ADR serve the product North Star package:

- [docs/north-star/README.md](../north-star/README.md) — Habitual Ritual Completers (HRC) is the executive North Star Metric; Daily Ritual Completers (DRC) is the atomic input; free daily ritual floor; module protocol.
- Player product floors outrank clean-break convenience: [DELIVERY-AUTHORITY.md](../north-star/DELIVERY-AUTHORITY.md).

This ADR does **not** redefine the product NSM; it defines the sole play and transport authority required for honest finishes and entitlements. Polar formulas live in the North Star package and in `puzzled_core::puzzle_play::ritual_completion`.

## Context

The strangler cutover left dual authorities: a hand-rolled REST `/api/v1`
surface on the Rust server plus a Hono REST client layer in the web app, a web
residual job executor, orphaned generated-code trees, an unwired Connect
transport, and client-trusted play results (solutions leaked, submissions
accepted unvalidated, completion flags client-supplied). This ADR records the
clean-break end state that replaces all of it.

## Decision

### 1. Transport: sole Connect

- The only app↔api protocol is Connect RPC (`proto/puzzled/v1`).
- The REST `/api/v1` surface and the Hono client layer are deleted.
- Browser identity: the Platform session cookie (`__sylphx_<env>_session`,
  HttpOnly 5-minute JWT) is verified by the api service; Bearer tokens remain
  for service callers. `x-user-id`-style client identity is never trusted.
- Transport resolution: production browser = same-origin (edge-routed
  path_prefixes); server = `API_INTERNAL_URL`; explicit
  `NEXT_PUBLIC_CONNECT_URL` override; dev = `127.0.0.1:3001`.

### 2. Play: server-authoritative

- Solutions never leave the server (`solution_json` deleted from the contract).
- Puzzles are served from the content store (`daily_puzzles`) with solutions
  held server-side; sudoku additionally has deterministic on-server
  generation as a fallback.
- `SubmitGuess` requires verified identity **or** stable guest-day id
  (`X-Puzzled-Guest-Id` / `puzzled_guest_id` → `guest_<uuid>`), derives the
  served puzzle (`puzzle_id`/`puzzle_date`, never a client seed), validates the
  final submission against the server's solution via the pure per-game dispatch
  (all 17 games), rejects already-played, and persists verified results.
  Guests count toward DRC on free-rotation finishes; premium/archive remain
  auth + entitlement gated.
- Completion is server-derived; `has_completed` client input is deleted.

### 3. Services (Connect)

| Service | Responsibility |
| --- | --- |
| HealthService | liveness/readiness |
| PuzzleService | GetPuzzle (practice), GetDaily (daily/archive), SubmitGuess |
| StatsService | leaderboard, percentile, user stats, history, today overview |
| PreferencesService | profile, username, push/email preferences |
| GamificationService | streak info, streak freezes (admin add) |
| AdminService | announcements, settings, audit logs, DLQ, games overview/analytics, system health (exact admin scope) |
| JobsService | retention jobs (daily-reminder, win-back-emails) via Platform BaaS HTTP; `x-app-secret` auth |

### 4. Content model

- Runtime generation is deleted. `scripts/generate-content.ts` is a standalone
  content tool (procedural + LLM via existing generators) that imports daily
  puzzles ahead of time into the content store. The api service serves and
  validates from that store.
- `streak-at-risk` is not an app job: streak state is platform-owned and
  campaigns belong to platform engagement tooling.

### 5. Premium gating (server-enforced)

- Archive reads and non-rotation games require an active premium subscription
  (Platform `/billing/subscription`, app-secret auth, fail-closed to free).
- The daily free-rotation game (**product day-key** day-of-year rotation in
  `Asia/Hong_Kong`, same SSOT as DRC) is playable by everyone, including guests.
  Legacy UTC dual-oracles in residual billing tests are not product authority.

### 5.1 Ritual completion / DRC + HRC instrumentation (S0)

- After server-validated `SubmitGuess`, the api persists the finish on
  `game_sessions` with `day_key`, `module_class`, `is_ritual`, `finish_kind`
  when the finish qualifies as a daily `puzzle_ritual` (sole path — no client
  emission, no dual event bus).
- \(\mathrm{DRC}(D)\) recomputes as distinct `user_id` where
  `day_key = D AND is_ritual AND module_class = 'puzzle_ritual'`
  (`compute_drc`).
- \(\mathrm{HRC}(D)\) (product North Star) recomputes as distinct `user_id`
  with ≥ 4 distinct DRC days in the trailing 7 product days ending \(D\)
  (`compute_hrc`). S0 is oracle existence; HRC may be 0.

### 6. Lifecycle and evidence

- The repo is **dev-phase until live proof**: both images must build from the
  Dockerfiles, tests green, and an end-to-end play→save→leaderboard→premium
  round trip must be demonstrated on a deployed environment before any
  production claim.

## Residual register

The transitional residuals registered in ADR-169 are **zeroed**:

| Former residual | Disposition |
| --- | --- |
| `/api/v1` REST + Hono client | deleted |
| web residual job executor (`platform-jobs` webhook, `lib/jobs`, `lib/dlq`) | deleted; JobsService is sole executor |
| `api/cron/*`, `api/jobs/*`, `vercel.json`, `x-internal-call` | deleted |
| `/api/flags` stub | deleted; Platform SDK flags are authority |
| retired `packages/sdk` fork | deleted |
| solution leakage / accept-any submit / client `has_completed` / client score | deleted (server-authoritative play) |
| root `src/` orphan tree | moved into the app workspace |
| broken PWA (`sw.ts` absent) | removed |
| legacy locale redirects / dead game slugs | removed |
| `INITIAL_SUPERADMIN_EMAIL` / `ADMIN_SECRET` / `INIT_SECRET` / VAPID / QStash / CRON_SECRET | removed from docs/env |
| monitoring console shim | removed (SDK error tracking) |

## Validation

- `cargo test -p puzzled-core -p puzzled-server`, `cargo clippy -D warnings`
- `bun run test:unit`, `bunx tsc --noEmit`, `next build` (typecheck enforced)
- `bun run check:proto-buf` (baseline-first breaking gate), `check:platform-boundary`
- CI builds web + Rust release images; clippy without `-A dead_code`
- Architecture tests: sole-Connect router, jobs executor is sole Rust,
  server-only boundary, no REST reintroduction
