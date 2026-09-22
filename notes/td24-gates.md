# TD-24 gates (CI shape), run 2026-09-22 ~00:05 BST on the 2f88742 tree

- Unit suite: `cd apps/puzzled && env -u NODE_ENV SKIP_ENV_VALIDATION=true DATABASE_URL='postgresql://test:test@localhost:5432/test' bun run test:unit`
  -> `1194 pass / 6 skip / 1 fail / 34924 expect() calls / Ran 1201 tests across 125 files. [88.17s]`
  The single fail is `schema/migration parity > drizzle schema and atlas migrations describe the same DDL`, which needs a dev postgres (docker daemon down on this host); it fails identically at base be3f6dc2 (reproduced by the predecessor leg on td24-base) and on the sibling TD-11 leg. CI provides DATABASE_URL; 0 failures otherwise.
- Lint: `cd apps/puzzled && bun run lint` (biome check .) -> rc=0: `Checked 875 files in 421ms. No fixes applied. Found 23 infos.`
- Typecheck (uncached): `env -u NODE_ENV SKIP_ENV_VALIDATION=true NODE_OPTIONS='--max-old-space-size=5120' bunx turbo typecheck --filter=@sylphx/puzzled --filter=@sylphx/ui --concurrency=1 --force`
  -> rc=0: `2 successful, 2 total; Cached: 0 cached, 2 total; Time: 9.507s` (a cached pass at 139ms ran first).
- Build: `cd apps/puzzled && env SKIP_ENV_VALIDATION=true NODE_ENV=production bun run build` -> rc=0 (`next build` compiled successfully; full route listing emitted).
- Raw logs on the work host: /tmp/td24-suite-full.txt, /tmp/td24-lint.txt, /tmp/td24-typecheck-forced.txt, /tmp/td24-build.txt.
