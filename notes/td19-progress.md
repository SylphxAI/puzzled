# TD-19 progress checkpoint

Branch: `debt/td19-idempotency`; cut from `origin/main` at **be3f6dc** (#178/#179 landed while recon was
running — the first fetch showed d1fae28; the worktree ended up based on their heads).
Worktree: `$HOME/workspace/.worktrees/github.com/SylphxAI/puzzled/td-19`.

## Recon trace (re-measured on be3f6dc)

Submit path, end to end (paths relative to `apps/puzzled/src`):

1. `games/shared/use-game-session.ts:255-352` — `endGame`; the daily/archive record decision is
   `games/shared/finish-recording.ts:30-51` (`finishRecordingFor`, called at `:272`), then
   `saveResult(...)` at `:278`.
2. `features/gamification/hooks/use-save-game-result.ts:81-182` — `saveResult` → `mutation.mutateAsync`
   (`:95`); `savedRef` is reset in the catch (`:176`) so a failed save may be retried.
3. `lib/api/hooks.ts:216-283` — `useSaveResult`; its inline `mutationFn` (`:227-271`) calls
   `admitSubmitGuessViaConnect` (`:235-244`). **No request key is sent anywhere on this path.**
4. `lib/connect/puzzle-admission.ts:71-89` — `admitSubmitGuessViaConnect` → `submitGuess` (`:84`),
   converting thrown errors into the fail-closed `{ok:false,error}` shape.
5. `lib/connect/puzzle-client.ts:86-104` — builds `SubmitGuessRequestSchema` with the message fields only.
   The proto (`proto/puzzled/v1/puzzle.proto:73-87`) has **no idempotency field** (`reserved 2` is the
   removed seed).
6. Transport: `lib/connect/transport.ts` — Connect-web to the Rust api (sole Connect authority, ADR-170);
   the guest identity already rides as a request header via the interceptor (`:76-82`, uses
   `X-Puzzled-Guest-Id`), so a companion header is the transport's existing pattern.

**Where retry-after-timeout happens:** `lib/api/provider.tsx:30-33` sets react-query
`mutations.retry = 1` — one automatic re-run of `mutationFn` **with the same variables**. The key must be
stable there, i.e. stamped before the mutation is invoked, never inside `mutationFn`.

## Before-map: where the write / mapping actually live

**Server side is Rust** (`crates/puzzled-server`, the api service built from this repo — CI
`.github/workflows/ci.yml` build job compiles it after protoc 36.1):

- **The write:** `crates/puzzled-server/src/capabilities/puzzle_play/adapters/game_sessions_db.rs:356-459`
  `persist_validated_session`; `INSERT ... ON CONFLICT (user_id, puzzle_id) DO NOTHING` (`:425`) →
  `Ok(None) => Err("already_played")` (`:449`); the **ritual partial unique index**
  (`game_sessions_ritual_user_game_day_uidx`, `apps/puzzled/atlas/migrations/20260812010000_ritual_one_finish_per_day.sql:31-33`)
  is caught by `is_unique_violation` (`:453-455`, `:461-469` — Postgres `23505`) → also
  `"already_played"`.
- **The mapping:** `crates/puzzled-server/src/bootstrap/connect_puzzle.rs` `submit_guess` (`:432`):
  pre-check `has_completed_session`/`has_ritual_completion` (`:583-600`, `AlreadyExists` at `:598`) and
  the persist branch (`:632-657`, `AlreadyExists` at `:652`). A unique violation surfaces as
  `AlreadyExists / "already_played"` — not `Internal`.
- **Client interpretation (TS, already present):** `lib/connect/already-played.ts:4-11`
  (`isAlreadyPlayedError`) + `lib/api/hooks.ts:257-266` → `{success:true, error:'already_played'}`.

So the register's "treat a unique-violation as success in the API mapping" half is already implemented on
both sides (Rust maps 23505 → already_played; the client accepts it). **The remaining TD-19 gap is the key
itself** — nothing names the submission intent on the wire, and a server-side consumer could not replay the
accepted result instead of inferring it from an index violation.

## What this branch does (before → after)

- NEW `lib/idempotency-key.ts`: `mintIdempotencyKey()` (`crypto.randomUUID`, guest-day-id fallback),
  `IDEMPOTENCY_KEY_HEADER = 'X-Puzzled-Idempotency-Key'`, `withIdempotencyKey()` (stamp-once per intent).
- `lib/api/hooks.ts`: mutationFn extracted to exported `submitSaveResult`; `useSaveResult` returns
  `mutate`/`mutateAsync` wrappers that stamp the variables **once, before the mutation starts** — the
  `retry: 1` re-run re-sends the same key. `SaveResultInput.idempotencyKey?` forwarded to the wire.
- `lib/connect/puzzle-domain.ts`: `SubmitGuessInput.idempotencyKey?` — the typed seam.
- `lib/connect/puzzle-client.ts`: attach the key as a per-call Connect header (`CallOptions.headers`) when
  present.
- **Deferred (out of lane):** a Rust consumer of the header. Headers are readable without a proto change
  (precedent `crates/puzzled-server/src/bootstrap/identity.rs:62-68` reads the guest header via
  `ctx.headers()`); adding a proto field would require buf regeneration on both sides plus a 23505-path
  change. Notes + PR state the seam and the exact place the Rust lane consumes it.

## Status

- [x] recon (trace + before-map above)
- [ ] implement + tests
- [ ] mutation proof
- [ ] gates (unit / typecheck / lint / build)
- [ ] PR

## Recovery pass (worker 2, 2026-09-21 late)

- Found: prior worker left uncommitted implementation in this worktree — modified
  `lib/api/hooks.ts`, `lib/connect/puzzle-client.ts`, `lib/connect/puzzle-domain.ts`; new
  `lib/idempotency-key.ts`, `lib/idempotency-key.test.ts`, `lib/api/save-result-idempotency.test.ts`.
  No commits, no push, no PR had happened; work reviewed and adopted (not thrown away).
- Re-verified anchors on `be3f6dc`: `lib/api/provider.tsx:30-33` `mutations: { retry: 1 }`;
  `puzzle-product-authority.ts:55-63` passes the whole `SubmitGuessInput` through (key survives);
  `validateSubmitGuessInput` (puzzle-domain.ts:58-65) does not reject the extra field.
- Next: focused tests → full gates → mutation proof → PR.

- Focused tests green (recovery pass): `env -u NODE_ENV bun test src/lib/idempotency-key.test.ts src/lib/api/save-result-idempotency.test.ts`
  → `7 pass / 0 fail, 19 expect() calls` (bun test v1.4.2).
- Implementation committed. Next: full gates (bun test, typecheck, lint, build), mutation proof, PR.

## Gates + mutation proof (recovery pass, head 1c5ecfa code)

- Full suite: `env -u NODE_ENV bun test` → **1195 pass / 6 skip / 1 fail**, 34,927 expect(), 1202 tests / 126 files / 93.06s.
  The 1 fail is TD-04's `schema/migration parity` gate refusing to skip without a dev DB:
  `schema-parity: no dev database available; set SCHEMA_PARITY_DEV_URL=postgresql://... or provide docker/host postgres` (status=2).
  Reproduced on pristine `be3f6dc` (this change absent, scratch worktree, just that file): `0 pass / 1 fail` — same status=2 message.
  This pod has no postgres server and no docker daemon (client tools only); my diff touches no schema/atlas/scripts path.
- Typecheck `bunx tsc --noEmit` exit 0; `-p tsconfig.e2e.json` exit 0 (empty output both).
- Lint `bun run lint` exit 0 — `Checked 876 files in 365ms. No fixes applied. Found 23 infos.` (none in TD-19 files).
- Build `NEXT_PUBLIC_APP_URL=https://puzzled.gg SKIP_ENV_VALIDATION=true bun run build` exit 0 — `✓ Compiled successfully in 13.8s`, `Finished TypeScript in 14.4s`, 118/118 static pages.
- Mutation A — regenerate key per retry attempt (`hooks.ts`, fresh mint per mutationFn run): retry test RED,
  `Expected: "2902bfc2-..." Received: "e7a461c7-..."` at the same-key assertion; `0 pass / 2 fail`, exit 1. Restore → clean tree → `7 pass / 0 fail`, exit 0.
- Mutation B — re-stamping an already-stamped intent regenerates (`idempotency-key.ts`): unit test RED
  (`Expected: "cc5d18f3..." Received: "2aef8e23..."`); `4 pass / 1 fail`. Restore → `5 pass / 0 fail`, exit 0.
- Evidence copies: `$HOME/work/pz-program/notes/td19-evidence-{unit,gates,mutation,base-parity}.txt`.

## Status
- [x] recon — [x] implement — [x] tests — [x] gates — [x] mutation proof — [ ] PR (next)

## PR

- PR #180: https://github.com/SylphxAI/puzzled/pull/180 — base `main` (`be3f6dc`), head `debt/td19-idempotency`.
- Not enqueued, not merged (per brief). Branch head at PR time: 5b4761c (code 1bc9826 + notes commits).
