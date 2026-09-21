# TD-05 env schema - progress (branch debt/td05-env-schema)

Worktree: $HOME/workspace/.worktrees/github.com/SylphxAI/puzzled/td05-env
Base: origin/main = 7523ba9. HEAD = 9bb56fc (pushed; remote ref read back).

## Findings (revision 7523ba9)
- Raw dot-reads: 38 outside lib/env.ts + tests (2 of them comments in site-origin.ts; 21 files), incl. planned exceptions admin/error.tsx + credentials.ts.
- lib/env.ts: homegrown EnvVar registry; SERVER_REQUIRED empty; env object getters were unconsumed; only importer = instrumentation.ts.
- Register row TD-05: "Extend lib/env.ts to every var the app reads; expose typed accessors; forbid raw reads by lint rule."

## Steps
1. [x] Recon.
2. [x] Read env.ts + all consumer files + tests + scripts.
3. [x] Baseline: full suite 1073 pass / 6 skip / 1 fail (connect-fetch timing flake; passes standalone) - 132.98s.
4. [x] lib/env.ts: KNOWN_VARS (22) + 22 lazy raw getters; 2 unconsumed defaulted getters now raw (documented). env.test.ts +2 tests.
5. [x] Replaced 35 raw reads in 19 files + 2 comment rewrites (site-origin.ts).
6. [x] Prove at 9bb56fc:
   - AFTER count = 1 (only app/[locale]/admin/error.tsx:41 - the named exception). BEFORE = 38 (7523ba9), same command: git grep -n -F 'process.env.' <rev> -- apps/puzzled/src | grep -v '\.test\.' | grep -v 'lib/env\.ts' | wc -l
   - Suite: 1076 pass / 6 skip / 0 fail (1082 tests, 107 files, 80.07s). Typecheck exit 0. Build exit 0.
   - Correction at 9bb56fc: lib/db/index.ts DATABASE_URL swapped too - register cites it, the 19-file arithmetic includes it; ONLY admin/error.tsx + credentials.ts are named exceptions (TOUCH LIMITS zone list read as wander-guard; documented in PR).
7. [~] HEAD 9bb56fc pushed; opening PR next.

## TD-06 plan (branch debt/td06-admin-audit; worktree .worktrees/github.com/SylphxAI/puzzled/td06-audit @ 7523ba9)
- New AuditAction value 'admin_access': schema.ts enum + atlas migration (ALTER TYPE ... ADD VALUE IF NOT EXISTS) + refresh atlas.sum via: atlas migrate hash --dir file://apps/puzzled/atlas/migrations (CI parity: ci.yml "Verify migration checksums").
- lib/audit: add logAdminAccessAttempt({method, success, ip, userId?}) -> audit_logs row (action/resourceType 'admin_access', resourceId = method, actorId = userId ?? null, metadata {method, success, ip}); internal try/catch kept.
- admin-api.logAdminAccess: redis.setex(30d copy) -> logAdminAccessAttempt; Redis stays ONLY as the rate-limit counter (RateLimiterRedis) + console.warn kept.
- UI surface: messages actions.admin_access in all 5 locales; audit-log-filters ACTION_TYPES += 'admin_access'.
- Mutation proof: test fails when the audit write is reverted (red/green quoted).

## Next action
Open TD-05 PR; then implement TD-06 steps above.
