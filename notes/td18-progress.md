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

Next:
1. production build (needs a real bun install in the worktree - symlinked
   node_modules fails Turbopack's filesystem-root check).
2. base-suite run on fd9f061 (scratch worktree) for the honest delta.
3. push, open ONE PR titled about TD-18; body: two-authority problem, design,
   consumer table (before/after), mutation raw, suite status.
4. merge-order check against the queued branches (debt/td04, td20, td21).
