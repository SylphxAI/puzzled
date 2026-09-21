# TD-18 proof (base moved: recon on fd9f061, rebased onto d1fae285)

Tree: debt/td18-entitlement, worktree td-18. Commands from apps/puzzled unless noted.
The rebase happened because TD-04/TD-20/TD-21 landed while this branch was open.

## 0. Rebase + conflict resolution (raw)

  origin/main moved fd9f061 -> d1fae285 while the branch was open:
    d1fae28 refactor(share): converge result sharing on one helper with catalogue-resolved names (TD-21) (#177)
    7824db5 refactor(logging): one logging seam for levels, redaction and correlation (TD-20) (#176)
    b340057 test(db): guard drizzle schema / atlas migration parity (TD-04) (#175)

  git rebase origin/main  -> one conflict, apps/puzzled/src/lib/api/server.ts:
    HEAD   (main): import { logger } from '@/lib/logger'
    branch       : import { withPresentationDeadline } from '@/lib/presentation-document'
  Resolution: keep both imports (the body auto-merged; the TD-20 logger.error call at
  'home.personal-result-read-failed' is kept and the isPremium resolution is mine).
  Rebase result: 5002e28 (code) + fafd13a (notes) on d1fae28.

  Merge-order probes (git merge-tree --write-tree HEAD <ref>):
    OK   debt/td04-schema-parity      (already landed)
    OK   debt/td21-share-helper       (already landed)
    CONFLICT debt/td20-logger-seam    (already landed; pre-rebase check)
    CONFLICT debt/td22-casts          (not landed; that branch will need to rebase
                                       onto the logger call the same way this one did)
    CONFLICT origin/main (pre-rebase) (the conflict resolved above)

## 1. Local gate (raw), rebased tree

- Suite: env -u NODE_ENV SKIP_ENV_VALIDATION=true bun run test
  -> 1188 pass / 6 skip / 1 fail, 34,908 expect() calls,
     Ran 1195 tests across 124 files [90.39s], exit 1.
  The one fail is TD-04's schema/migration parity gate and it is environmental:
     "schema-parity: no dev database available; set SCHEMA_PARITY_DEV_URL=postgresql://...
      or provide docker/host postgres" -> check-schema-parity.sh status=2
  It reproduces identically on PRISTINE d1fae285 with this change absent:
     base worktree (detached d1fae285), single file:
     -> 0 pass / 1 fail, Ran 1 test across 1 file, exit 1
  CI on main for d1fae285 is green (Actions run 35569576439, conclusion success), so the
  gate runs where a dev database exists; this pod has none.
- Baseline for the delta (same command, detached d1fae285 in the td18-base worktree):
  -> 1175 pass / 6 skip / 1 fail (the same env-only gate), 34,882 expect() calls,
     Ran 1182 tests across 121 files [86.01s], exit 1.
  Delta branch - base: +13 pass, +3 files, +26 expect() calls - exactly the three new
  test files below; no other test moved.
- Typecheck: bun run typecheck -> exit 0.
- Lint: bun run lint -> exit 0 (the 23 reported infos are pre-existing useTemplate
  infos in the S3 result-card files, present on main).
- Build: cd <worktree> && bun install (554 packages, 2.46s) then
  env NEXT_PUBLIC_APP_URL=https://puzzled.gg SKIP_ENV_VALIDATION=true bun run build
  -> exit 0 (next build 16.3.3/Turbopack; symlinked node_modules fails the earlier
  Turbopack root check, a real install is required - same as TD-15).

## 2. New tests (raw)

  bun test src/lib/billing/server.test.ts src/lib/identity/react.test.ts \
      src/features/monitoring/components/session-replay-provider.billing.test.ts
  -> 13 pass / 0 fail, 26 expect() calls, Ran 13 tests across 3 files [508.00ms], exit 0.

- src/lib/billing/server.test.ts - the gate re-evaluates the authority on the request
  (enabled admits, disabled locks; unreachable answers free); the threaded snapshot
  carries the plan.
- src/lib/identity/react.test.ts - the chrome renders the server snapshot; a premium
  answer from anywhere else (fetch stub) cannot flip a free verdict and is never
  fetched; the pricing gate keeps the current-plan state for entitled viewers and does
  not flip a free verdict.
- src/features/monitoring/components/session-replay-provider.billing.test.ts - the
  replay sampling decision follows the server value (premium -> 25, free/guest stays
  default, stale premium claim cannot raise it).

## 3. Mutation

notes/td18-mutation.md: restoring the removed client authority (useBilling fetch+state)
-> 6 fail / 7 pass, exit 1; restore from the saved fixed file -> 13 pass / 0 fail,
exit 0. The worktree was never mutated (git status unchanged; the copy took it).

## 4. What is NOT changed (deliberate)

- /api/identity/billing route stays: a server-authoritative read; after this change
  nothing in the browser calls it (the client no longer resolves its own copy).
- Server access gates (canAccessGame, Connect serve/submit, archive admission) are
  untouched: they were already the authority.
- billing UI and the S3 result surface render the same strings for entitled users;
  the mismatch direction tightens to the server value (that is the point).
