# TD-20 proof - gates on the merged tree

Head: `ba611f2` (`debt/td20-logger-seam`, includes merge of `origin/main` `fd9f061`).
Commands run in `apps/puzzled` with `env -u NODE_ENV`:

## Full suite (`bun run test`)
```
1159 pass
6 skip
0 fail
34856 expect() calls
Ran 1165 tests across 118 files. [103.80s]
SUITE_RC=0
```

## Typecheck (`bun run typecheck`)
```
$ tsc --noEmit && tsc --noEmit -p tsconfig.e2e.json
TYPECHECK_RC=0
```

## Biome (`bun run lint`)
```
Checked 865 files in 455ms. No fixes applied.
Found 23 infos.   (pre-existing; none in the changed files)
LINT_RC=0
```

## Production build (`bun run build`)
```
BUILD_RC=0 (route table rendered; raw log kept)
```

## Census (merged tree, `apps/puzzled/src`)
```
levels (log|info|warn|error|debug): 10   (all in the two test files)
any console\.: 17   (10 test-file hits + 7 prose mentions in comments)
```

Raw logs: `/data/sylphx/home/work/pz-program/notes/td20-{suite,typecheck,lint,build}-merged.txt`.

## Merge-order note
Base `b199007`. Before the PR, `origin/main` advanced to `fd9f061` (#171-#174 merged).
Merge `ba611f2` resolved exactly one conflict: in `generator.ts`, TD-10 (#171) deleted the dead
`_generateDailyPuzzles` (which held 5 of the migrated sites); resolution keeps the deletion.
The remaining 6 generator sites were re-applied; everything else auto-merged.
