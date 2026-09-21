# TD-05 env schema - progress (branch debt/td05-env-schema)

Worktree: $HOME/workspace/.worktrees/github.com/SylphxAI/puzzled/td05-env
Base: origin/main = 7523ba9 (fetched 2026-09-21, still current). Remote branch = local = 53799c4079588bd5a65b98d183d0487838e4c32f.

## Findings (revision 7523ba9)
- Raw dot-reads: 79 total in apps/puzzled/src; 38 excluding lib/env.ts + test files (2 of the 38 are comments in site-origin.ts; 21 files incl. planned exceptions).
- Unique vars (38 lines): NODE_ENV x10, IDENTITY_API_ORIGIN x6, PORT x3, COMMERCE_API_ORIGIN x3, VERCEL_URL x2, NEXT_PUBLIC_SYLPHX_APP_ID x2, NEXT_PUBLIC_APP_URL x2, ADMIN_SECRET x2, REDIS_URL, OBSERVABILITY_API_ORIGIN, NEXT_PHASE, EVENTS_API_ORIGIN, DATABASE_URL, CRON_SECRET, COMMERCE_ENTITLEMENT_POLICY_ID, AI_API_ORIGIN (x1 each).
- lib/env.ts = homegrown EnvVar registry (no zod); SERVER_REQUIRED deliberately empty; FEATURE_VARS warns in dev only; only importer today = instrumentation.ts (env object getters currently unconsumed in src).
- Audit register row TD-05 (tech-debt-register.md): "Extend lib/env.ts to every var the app reads; expose typed accessors; forbid raw reads in app code by lint rule".
- Planned exceptions (recon): app/[locale]/admin/error.tsx (error.tsx excluded by touch limits); lib/identity/credentials.ts dynamic keyed reads (already injectable env param).

## Steps
1. [x] Recon (above).
2. [x] Read env.ts + all consumer files + tests + scripts.
3. [x] Baseline 2026-09-21 ~01:10:
   - `env -u NODE_ENV bun test src '.test.ts'` -> 1073 pass / 6 skip / 1 fail (1080 tests, 107 files, 132.98s).
     Fail: src/lib/api/connect-fetch.test.ts "mergeServerConnectInit > aborts when the api never returns HTTP" (4.64s; timing assertion SERVER_CONNECT_TIMEOUT_MS+1500 under parallel load).
   - Standalone re-run `env -u NODE_ENV bun test src tests -t 'aborts when the api never returns HTTP'` -> 1 pass / 0 fail. => pre-existing load flake; unrelated to env work; note in PR.
4. [x] Extend lib/env.ts: KNOWN_VARS (22 names) + 22 lazy raw getters; the 2 unconsumed defaulted getters replaced (raw semantics preserved; documented in PR). env.test.ts +2 tests (raw/lazy contract, inventory).
5. [x] Replace reads: 34 code lines in 18 files + 2 comment rewrites (site-origin.ts). AFTER count outside env.ts+tests = 2 (both planned: admin/error.tsx, lib/db/index.ts).
   Committed 2fd4beb (21 files, +309/-44); pre-commit hook: biome clean on 21 files + tsc --noEmit + e2e tsconfig OK (16.5s).
6. [ ] Prove: full suite, standalone typecheck, build; quote before/after counts.
7. [~] Pushed 2fd4beb to origin; PR next.

## Decisions (locked 2026-09-21)
- ALL env getters: raw + lazy (`string | undefined`). The 2 pre-existing getters are unconsumed in src and become raw: call sites need raw semantics (resolveSiteOrigin treats undefined as "not configured"; `=== 'development'` must stay false when NODE_ENV unset). Call-site defaults stay at their sites (`?.trim() || 'premium'`, resolver fallbacks, redis/db throws) => app behaviour identical.
- Left untouched (reported, not replaced):
  - app/[locale]/admin/error.tsx (explicit planned exception; 1 read).
  - lib/db/index.ts (TOUCH LIMITS: lib/db/** OFF-LIMITS; 1 raw DATABASE_URL read stays -> report as remaining).
  - lib/identity/credentials.ts (dynamic keyed reads; already has injectable env param).
  - Out of src-dot-read scope: drizzle.config.ts / atlas.hcl / scripts/** reads.
- Expected after-count (same command, excluding lib/env.ts + tests): 2 (admin/error.tsx + lib/db/index.ts). All other reads -> env getters.

## Next action
Step 6 proof (full suite + typecheck + build), then open PR. HEAD=2fd4beb (pushed).
