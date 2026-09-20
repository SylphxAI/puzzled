# TD-05 env schema - progress (branch debt/td05-env-schema)

Worktree: $HOME/workspace/.worktrees/github.com/SylphxAI/puzzled/td05-env
Base: origin/main = 7523ba9 (fetched 2026-09-21). Open PRs at start: only #153 (s2/quality-gates; ci.yml, e2e a11y, notes/s5) - no overlap.

## Findings (revision 7523ba9)
- Raw dot-reads: 80 total in src; 38 excluding lib/env.ts + test files, across 21 files.
- Unique vars (38 reads): NODE_ENV x10, IDENTITY_API_ORIGIN x6, PORT x3, COMMERCE_API_ORIGIN x3, VERCEL_URL x2, NEXT_PUBLIC_SYLPHX_APP_ID x2, NEXT_PUBLIC_APP_URL x2, ADMIN_SECRET x2, REDIS_URL, OBSERVABILITY_API_ORIGIN, NEXT_PHASE, EVENTS_API_ORIGIN, DATABASE_URL, CRON_SECRET, COMMERCE_ENTITLEMENT_POLICY_ID, AI_API_ORIGIN (x1 each).
- lib/env.ts = homegrown EnvVar registry (no zod); SERVER_REQUIRED deliberately empty; FEATURE_VARS warns in dev only; only importer today = instrumentation.ts.
- Plan: single module, lazy raw getters (webpack inlines NEXT_PUBLIC_*/NODE_ENV at literal member expressions; server names never inlined to client).
- Planned exceptions: app/[locale]/admin/error.tsx (error.tsx = excluded by touch limits); lib/identity/credentials.ts dynamic keyed reads (injectable env param for tests).
- Schema var inventory adds (from credentials.ts): IDENTITY_API_KEY, IDENTITY_ORGANIZATION_ID, COMMERCE_API_KEY, EVENTS_API_KEY, OBSERVABILITY_API_KEY, AI_API_KEY.

## Steps
1. [x] Recon: register rows read; worktree from fetched origin/main 7523ba9; open PRs checked.
2. [x] Read: env.ts + all 21 consumer files + tests + scripts.
3. [ ] Baseline: targeted env tests; full bun test src.
4. [ ] Extend lib/env.ts (KNOWN_VARS registry + raw typed getters).
5. [ ] Replace 38 reads in 19 files (+reword 2 comments in site-origin.ts).
6. [ ] Prove: before/after counts, tests, typecheck, build.
7. [ ] Commit + push + PR.

## Next action
Baseline tests; then edit lib/env.ts + call sites.
