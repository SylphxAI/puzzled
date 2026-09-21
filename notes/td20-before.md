# TD-20 census: console.* before -> after

Base `origin/main` = `b199007999789d862ac236b94ba010b1c3ff18e1`; migration commit `bbdf9ac`.

## Reproduce
```bash
# before (extract the base tree, same method as the register)
mkdir -p /data/sylphx/home/work/pz-td20-base
cd <worktree> && git archive origin/main apps/puzzled/src | tar -x -C /data/sylphx/home/work/pz-td20-base
rg -n 'console\.(log|info|warn|error|debug)' /data/sylphx/home/work/pz-td20-base/apps/puzzled/src | wc -l   # 52
# after
cd <worktree>/apps/puzzled && rg -n 'console\.(log|info|warn|error|debug)' src | wc -l                              # 10
```

## Result
- **before: 52 hits** = 42 production sites across 19 files + 10 hits in 2 test files (console silencers)
- **after: 10 hits**, all in the same two test files (`generator.test.ts` 7, `report-boundary-error.test.ts` 3); production sites: **0**

Production counts before (per file, under `apps/puzzled/src/`):
- features/puzzle-generator/lib/generator.ts 11
- app/api/email/unsubscribe/route.ts 7
- lib/env.ts 4
- app/[locale]/(main)/page.tsx 3
- features/monitoring/components/session-replay-provider.tsx 2
- app/[locale]/(main)/games/[slug]/game-play-area.tsx 2
- lib/report-boundary-error.ts 1
- lib/redis.ts 1
- lib/audit/index.ts 1
- lib/api/server.ts 1
- games/shared/use-game-session.ts 1
- features/puzzle-generator/lib/validators/connections.ts 1
- features/push/components/notification-preferences.tsx 1 (JSDoc example)
- features/monitoring/components/global-error-handler.tsx 1
- features/admin/lib/admin-api.ts 1
- app/global-error.tsx 1
- app/api/admin/models/route.ts 1
- app/[locale]/(main)/pricing/pricing-client.tsx 1
- app/[locale]/(main)/games/[slug]/game-daily-fallback.tsx 1

## Broad match (plain `console\.`, includes prose in comments)
- before: 59; after: 17 (after = the 10 test-file hits + 7 prose mentions in comments; the seam module itself adds none to this pattern)

## Exclusions
- `packages/ui/src/components/toast.tsx:210` - outside `apps/puzzled/src/**` touch limits (packages/ui is TD-12 territory).
- Test-file console references are silencers/spies, not log sites; kept, because the seam maps `info`->`console.log` and `debug`->`console.debug` so existing silences still hold.
