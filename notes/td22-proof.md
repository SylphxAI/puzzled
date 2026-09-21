# TD-22 gate proof (head 1decd97, rebased on d1fae28)

Run on this pod, 2026-09-21. Commands match CI's own steps (.github/workflows/ci.yml).

## Unit suite
ci step: `bun run test:unit` in apps/puzzled, env NODE_ENV=test DATABASE_URL=postgresql://test:test@localhost:5432/test SKIP_ENV_VALIDATION=true
extra env: SCHEMA_PARITY_DEV_URL=postgresql://postgres@127.0.0.1:55433/parity_dev?search_path=public&sslmode=disable (pod-local dev Postgres, left from the TD-04 leg)
->
```
1176 pass
 6 skip
 0 fail
 34883 expect() calls
Ran 1182 tests across 121 files. [88.68s]
EXIT=0
```
Note: TD-04's parity gate (merged #175) exits 2 unless a dev database resolves; the same suite run without SCHEMA_PARITY_DEV_URL fails that one test with `no dev database available` - an environment gap, not a regression (the gate is fail-closed by design; CI's runner provides a host postgres, per the script header and notes/td04-schema-parity.md). Standalone gate run with the dev db: exit 0 (`OK: src/lib/db/schema.ts and atlas/migrations describe the same DDL`).

## Typecheck (CI step)
cmd: env -u NODE_ENV SKIP_ENV_VALIDATION=true NODE_OPTIONS=--max-old-space-size=5120 bunx turbo typecheck --filter=@sylphx/puzzled --filter=@sylphx/ui --concurrency=1
-> @sylphx/ui cache hit; @sylphx/puzzled: `tsc --noEmit && tsc --noEmit -p tsconfig.e2e.json`; Tasks: 2 successful, 2 total (5.577s)
Honesty note: an earlier attempt of the identical command failed spuriously because it ran concurrently with next build rewriting `.next/types/validator.ts` (TS2307 './routes.js'); with the build settled the command passed. The race, not the change.

## Lint (CI step)
cmd: cd apps/puzzled && bun run lint
-> LINT_EXIT=0; Checked 870 files in 462ms. No fixes applied. Found 23 infos (all pre-existing; none reference the touched files).

## Production build (CI step)
cmd: cd apps/puzzled && SKIP_ENV_VALIDATION=true NODE_ENV=production bun run build
-> Compiled successfully in 3.9s; Finished TypeScript in 8.9s; Generating static pages 118/118 in 176ms; EXIT=0

## Route assert (CI step after build)
cmd: cd apps/puzzled && node scripts/assert-document-route.mjs
-> GET / document ok status=200 bytes=384339 ms=1563; ASSERT_EXIT=0

## Parity gate standalone
cmd: cd apps/puzzled && bash scripts/check-schema-parity.sh (SCHEMA_PARITY_DEV_URL as above)
-> schema-parity: OK: src/lib/db/schema.ts and atlas/migrations describe the same DDL; GATE_EXIT=0
