# TD-18 progress

Base: fd9f061 (origin/main). Branch: debt/td18-entitlement. Worktree: td-18.

Done:
- recon + consumer map: notes/td18-before.md (three shapes; client consumers C1-C4;
  no client-side access gate exists - the defect is the chrome resolving its own copy).
- convergence: getServerBilling (React-cached, one EvaluateEntitlement per request);
  hasPremiumAccess derives from it; the locale layout threads the snapshot as data
  (PlatformProvider/SylphxProvider billing prop -> BillingContext); useBilling is
  derive-only (no fetch, no client evaluation); getServerPersonalDailyResults
  resolves the fact internally instead of accepting a loose boolean.
- tests: src/lib/identity/react.test.ts, src/features/monitoring/components/
  session-replay-provider.billing.test.ts, src/lib/billing/server.test.ts (13 tests).
- mutation proof: notes/td18-mutation.md (6 fail -> restore -> 13 pass).
- gates so far: lint exit 0 (infos only are pre-existing), typecheck exit 0,
  full suite 1164 pass / 6 skip / 0 fail, 34,855 expect() calls,
  Ran 1170 tests across 120 files [86.60s].

Rebased onto d1fae285 (TD-04/20/21 landed while this branch was open): one
conflict in apps/puzzled/src/lib/api/server.ts (TD-20 logger import vs this
change's presentation-document import) resolved by keeping both; tests, lint,
typecheck, suite and build re-run on the rebased tree - see notes/td18-proof.md
for all raw numbers.

Next:
1. push the rebased commits and open ONE PR titled about TD-18; body: the
two-authority problem, the design, the consumer table (before/after), mutation
raw, suite status (incl. the env-only TD-04 gate failure that reproduces on
pristine d1fae285).
2. await independent review; the queue will merge once checks are green.
3. note for the queue: debt/td22-casts rewrites the same logger line in
   lib/api/server.ts and will need the same style of rebase.
