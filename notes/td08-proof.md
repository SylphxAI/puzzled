# TD-08 proof (head 0283412, branch debt/td08-query-surfaces)

Commands run from `apps/puzzled` with the CI unit-test env
(`env -u NODE_ENV DATABASE_URL='postgresql://test:test@localhost:5432/test' SKIP_ENV_VALIDATION=true`)
on base `be3f6dc` and head `0283412`.

## Lane results

| lane | base be3f6dc | head 0283412 |
| --- | --- | --- |
| unit (`bun run test:unit`, what CI's unit-tests job runs) | 1188 pass / 6 skip / 1 fail - 1195 tests, 124 files | 1205 pass / 6 skip / 1 fail - 1212 tests, 126 files |
| typecheck (`bunx turbo typecheck --filter=@sylphx/puzzled --filter=@sylphx/ui --concurrency=1`) | - | Tasks: 2 successful, 2 total; EXIT=0 |
| biome (`bunx biome check` on the 5 changed files) | - | no fixes applied (also enforced by lefthook pre-commit) |
| build (CI Build job) | - | <CI URL when the run completes> |

The single failing test is identical on base and head:
`(fail) schema/migration parity > drizzle schema and atlas migrations describe the same DDL`
- pre-existing on origin/main, untouched by this change; the +17 new tests are green.

## Mutation proof (throwaway copy /data/sylphx/home/tmp/td08-mut)

Copy: `tar -C <worktree>/apps -cf - puzzled | tar -C /data/sylphx/home/tmp/td08-mut -xf -`
(the worktree's node_modules symlinks travel with it; no hardlinks).

Mutation - the mapper drops one field:
`sed -i '/canPlay: res.canPlay,/d' .../src/lib/api/domain/daily.ts`
Landed check: `grep -c 'canPlay: res.canPlay'` -> `0`.

RED (`bun test src/lib/api/domain/`, RC=1) - full output `notes/td08-mutation-red.log`:

```
(fail) getServerDailyStatus against a Connect fixture > maps the fixture to the pinned DailyStatus (server cache()d accessor) [9.45ms]
(fail) client surface runs the same mapper over the same fixture > fetchDailyStatusForClient equals the server mapping plus adapter fields [0.72ms]
(fail) mapDailyStatus > pins every field of a completed lost session [0.34ms]
...
 14 pass
 3 fail
 20 expect() calls
Ran 17 tests across 2 files. [229.00ms]
```

(each failure is `- Expected - 1 / + Received + 0` - the dropped field.)

Restore: `cp <worktree>/apps/puzzled/src/lib/api/domain/daily.ts` back; md5:

```
e2ba6662af5e39c252a8a40b3e3b2920  (copy)
e2ba6662af5e39c252a8a40b3e3b2920  (worktree)
```

GREEN (RC=0) - `notes/td08-mutation-green.log`:

```
 17 pass
 0 fail
 24 expect() calls
Ran 17 tests across 2 files. [220.00ms]
```

Worktree untouched after the sweep: `git status --porcelain` -> empty.

## Field-value parity (why this is not a behaviour change)

- Server accessors: the mapper is the previous hand-mapping moved verbatim;
  pinned against a Connect fixture over the real connect-web client
  (`daily.adapters.test.ts`: values + request URL/body/cookie).
- Client query bodies: shared fields identical; deltas only where the surfaces
  had diverged (D1/D2, notes/td08-before.md) and only on `useDailyStatus` /
  `useTodaysPuzzle`, which have 0 call sites.
- Cache keys (`queryKeys.*`) and React `cache()` wrappers unchanged.
