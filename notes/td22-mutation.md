# TD-22 mutation proof (scratch copy, never the worktree)

Scratch: `$HOME/work/td22-mut` - a real copy of the worktree with node_modules symlinked.
Script: `$HOME/work/td22-mut.sh`; raw log: `$HOME/work/td22-mutation-raw.log` (verbatim below).
Run against head `1decd97` (rebased on `d1fae28`).

Two claims are proven:

1. **The boundary still enforces the typed submission.** M1 calls the registry wrapper with a wrong
   submission type; `tsc` fails with a readable message at that argument; reverting is green.
2. **The erasure is gone.** M2 lets a consumer treat a value that used to be `any` as a concrete type;
   at head it fails to compile (`unknown` is not assignable), while the *same* consumer mutation compiles
   against origin/main's `GameConfig<any, any, any, any>` boundary + old registry (M2b, exit 0) - i.e. the
   new view changes the type system's behaviour exactly where claimed.

## Raw (verbatim)

```
=== TD-22 mutation battery (scratch: /data/sylphx/home/work/td22-mut/apps/puzzled) ===
worktree head: 1decd97

## M1: wrong submission type at the registry call site (head code)
232:export function validateAndScore(
246:	return config.validateAndScore(solution, puzzleData, { status: 'win', attempts: 1, timeSpentMs: 1, data: null })
src/games/registry.ts(246,57): error TS2322: Type '"win"' is not assignable to type '"won" | "lost"'.
M1_EXIT=2
M1_REVERTED_EXIT=0


## M2: a consumer treats the erased value as a concrete type (head code)
59:		const misusedSolution: string = result.solution
src/games/registry.server.ts(59,9): error TS2322: Type 'unknown' is not assignable to type 'string'.
M2_EXIT=2

## M2b: same consumer mutation against origin/main types+registry (old any boundary)

M2B_OLD_EXIT=0

## restore scratch to head and verify clean
RESTORED_EXIT=0

SCRATCH_SRC_IDENTICAL_TO_HEAD
## DONE
```

Recipe (re-cut from scratch): copy the app tree (`tar` minus node_modules/.next), symlink
node_modules, apply the mutation with `sed`, run `./node_modules/.bin/tsc --noEmit -p tsconfig.json`,
restore the original file from the worktree with `cp` (never `git checkout --`).

Note: no runtime narrowing changed anywhere in this PR, so there is no runtime behaviour to
regression-test; `lib/redis.ts` is outcome-identical by construction (parse success -> parsed value,
failure -> raw string), and the repo has no redis unit test file to extend (recorded in the PR).
