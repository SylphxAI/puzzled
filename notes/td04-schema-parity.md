# TD-04 — schema.ts / atlas-migrations parity gate

Branch `debt/td04-schema-parity`, based on `origin/main` = b199007 at branch time.
Main has since advanced to fd9f061 (TD-10/15/16/17 merges); none of them touch
`schema.ts`, `atlas/` or `scripts/` — the merge queue integrates.

## The defect (register row TD-04, re-verified at current main)

- `apps/puzzled/src/lib/db/schema.ts`: 14 `pgTable(`;
- `apps/puzzled/atlas/migrations/`: **5** files (register counted 4 — TD-06 added
  `20260921030000_audit_action_admin_access.sql` in #169), baseline with 14 `CREATE TABLE`;
- CI's Migration Integrity job checks only `atlas.sum` freshness and no uncommitted
  `.sql` (`grep -n drizzle .github/workflows/ci.yml` -> 0). Nothing compared the two
  copies: a column added to only one side compiles, typechecks and unit-tests green,
  then fails in production on the first query.

## What landed

1. `apps/puzzled/scripts/check-schema-parity.sh` — the gate.
2. `apps/puzzled/src/lib/db/schema-parity.test.ts` — runs it in the existing Unit Tests
   job (discovered by `bun run test:unit` = `bun test src '.test.ts'`). No `.github/**`
   edit, no new dependency, `atlas/migrations` untouched.

### Mechanism (free-tier Atlas; no Pro features)

1. `DOTENV_CONFIG_QUIET=true node_modules/.bin/drizzle-kit export > $WORK/schema.sql`.
   (dotenv v17 writes `[dotenv@...] injecting env (0) from .env.local ...` to *stdout*;
   Atlas then executes it as SQL: `…:1: pq: syntax error at or near "["`.)
2. `atlas migrate diff --dir file://$WORK/migrations --dev-url <pg> --to file://$WORK/schema.sql parity-check`,
   where `$WORK/migrations` is a *copy* of `atlas/migrations` whose sum was re-hashed.
   Atlas replays the migrations on the disposable dev Postgres and writes
   `<ts>_parity-check.sql` containing the statements that reconcile the two trees.
3. A new `.sql` file in the copy => drift; file printed as evidence; exit 1.
   No new file => synced; exit 0. Exit 2 => the gate could not run (see below).

Notes:
- The register proposed `atlas migrate diff --dry-run`. On Atlas v1.3.0 that aborts (raw):
  `Abort: migrate diff --dry-run is available only to Atlas Pro users.` The
  write-to-a-copied-directory form above is the free equivalent. stdout/stderr are empty
  in both the synced and drifted cases — the emitted file is the signal (verified).
- Atlas refuses any migrations-vs-file diff without a dev database
  (`Error: --dev-url cannot be empty`), including file-to-file; `docker://` dev URLs
  need a Docker daemon. Dev-db resolution order in the script:
  `SCHEMA_PARITY_DEV_URL` -> docker (`docker://pgvector/pgvector/pg18/dev`, the repo's
  own dev URL from `atlas.hcl`) -> host postgres via `sudo -n -u postgres` with a
  throwaway role+database (the sibling-product runner pattern used by identity,
  viszy.ai, commerce, cloud, compute, observability on `sylphx-linux-standard`) -> else
  exit 2 with the actionable message.
- Atlas binary: PATH `atlas`, else pinned download v1.3.0 from
  `release.ariga.io/atlas/atlas-linux-amd64-v1.3.0`
  (sha256 `cfc773e5b4e845bc01d680390c174648938a7f88bf30e5a2c83ae85217c21587`), cached at
  `${XDG_CACHE_HOME:-$HOME/.cache}/puzzled-atlas`. The Migration Integrity job already
  downloads `atlas-linux-amd64-latest` per run (unpinned); the gate pins its download.

## Mutation evidence

Throwaway tree `/tmp/pz-mut1` (real copy of the worktree, `node_modules` symlinked),
dev db = local PostgreSQL 16.2 on 127.0.0.1:55433.

Baseline — green:
```
$ SCHEMA_PARITY_DEV_URL=… bun test src/lib/db/schema-parity.test.ts
(pass) schema/migration parity > drizzle schema and atlas migrations describe the same DDL [3774.64ms]
 1 pass
 0 fail
```
(Same test in the real worktree: `[2347.44ms]`.)

Mutation A — `user_preferences` gains `parityProbe: text('parity_probe')` in schema.ts only:
```
error: check-schema-parity.sh failed (status=1, signal=none)
schema-parity: DRIFT: src/lib/db/schema.ts and atlas/migrations disagree; atlas would emit:
----- 20260921050542_parity-check.sql
-- Modify "user_preferences" table
ALTER TABLE "user_preferences" ADD COLUMN "parity_probe" text NULL;
(fail) schema/migration parity … [2670.97ms]        -> 0 pass / 1 fail
```
Restore (schema.ts sha256 equals the worktree copy, `f0788203…`) -> `(pass) [3796.41ms]`.

Mutation B — stray `CREATE TABLE "stray_probe"` added as a new migration file, schema.ts
untouched, `atlas.sum` deliberately NOT updated:
```
schema-parity: diffing 6 migration files against the exported schema
----- 20260921120001_parity-check.sql
-- Drop "stray_probe" table
DROP TABLE "stray_probe";
(fail) … [3385.98ms]                                -> 0 pass / 1 fail
```
Restore (file removed) -> `(pass) [2713.25ms]`. Both directions are covered (ADD / DROP).

No-fake-pass control — no dev db, `docker` and `sudo` stubbed to fail:
```
error: check-schema-parity.sh failed (status=2, signal=none)
schema-parity: no dev database available; set SCHEMA_PARITY_DEV_URL=postgresql://... or provide docker/host postgres
(fail) … [934.91ms]
```

Pinned-download branch (no `atlas` on PATH, cold cache): downloaded, sha256-verified,
exit 0; cached `~/.cache/puzzled-atlas/atlas-v1.3.0` sha256 = `cfc773e5…`; second run
cache-hit, exit 0.

## Checks (local, at this candidate)

- Full unit suite (task-literal `env -u NODE_ENV bun test src`, `SCHEMA_PARITY_DEV_URL` exported):
  **1142 pass / 6 skip / 0 fail, 34668 expect() calls, 1148 tests across 117 files, 99.50s**
  (first run under higher host load: 110.56s). New test in-suite: `[2640.17ms]` —
  ~2.6% of the suite (derived); on a cold CI runner add one pinned Atlas download.
- CI-shape `NODE_ENV=test DATABASE_URL=… SKIP_ENV_VALIDATION=true bun run test:unit`:
  **exit 0, 107s — 1149 pass / 6 skip / 0 fail, 34687 expect() calls, 1155 tests / 118 files**
  (one extra file vs the plain `bun test src`: the CI command's two positional filters are
  OR-ed, so it also picks up `tests/billing.test.ts`). New test in-suite: `[2366.46ms]`.
- Typecheck (CI shape: `bunx turbo typecheck --filter=@sylphx/puzzled --filter=@sylphx/ui --concurrency=1`):
  **2 successful / 2 total, Time 12.852s, exit 0**.
- Biome (`bun run lint`): **exit 0, 863 files checked, 23 pre-existing infos** (none from the new files).
- Production build (`SKIP_ENV_VALIDATION=true NODE_ENV=production bun run build`): **exit 0, 27s**;
  no tracked file mutated by the build (`git status --porcelain` shows only the two new files).

## Coverage / limits (honest scope)

- Covers schema.ts <-> atlas/migrations DDL parity in **both directions** (proven by A/B).
- Does NOT: reconcile any live database; replace the Migration Integrity job's checks
  (`atlas.sum` freshness, no-uncommitted-`.sql` — both stay); catch drift in statements
  Atlas normalizes away (e.g. index storage parameters) or in data.
- Requires a dev database by design (Atlas requirement). On a runner with neither docker
  nor host postgres the unit lane goes red with the exit-2 message — deliberate, never a
  silent skip. Wiring a dedicated CI step (pinned atlas + explicit provisioning) is the
  cleaner follow-up and needs a `.github` owner; deferred.
- Uses whatever `atlas` is on PATH when present (local dev); pinned v1.3.0 download when
  absent (CI).
