# TD-08 progress

- 2026-09-21 - branch `debt/td08-query-surfaces` off `be3f6dc` (origin/main after the
  queue landed #178/#179).
- Pushed: `f798e46` (before-map), `0283412` (domain module + server/hooks convergence
  + 17 pins). Proof: `notes/td08-proof.md`.
- Next: open PR; watch CI lanes; paste CI URLs into the PR body; independent review
  arrives as a PR verdict; queue/merge is the owner's call.
- Raw logs: `notes/td08-mutation-red.log`, `notes/td08-mutation-green.log`.

## Recovery worker takeover (2026-09-21 late evening)

- Original worker died mid-flight. Recovered state: worktree was clean at 6e47ba4;
  moved .worktrees/.../puzzled/td08 -> .../td08f per handoff; node_modules symlinks
  intact; origin/main still be3f6dc (no rebase needed yet).
- Re-verified from the branch itself: createServerApi -> NONE in apps/puzzled/src;
  mapDailyStatus/mapTodaysPuzzle single-sourced in lib/api/domain/daily.ts and used
  by both server accessors and hooks helpers; useDailyStatus/useTodaysPuzzle have
  0 call sites; 0283412..6e47ba4 is notes-only. Adapter tests (17 tests / 2 files)
  and mutation logs read.
- Progress mirrored to $HOME/work/pz-program/notes/td08-progress.md on each step.
- Next: full gates (unit/typecheck/lint/build), own mutation re-run, push refspec,
  open PR.
- 2026-09-21 late evening - Full local gates re-run on td08f (head 1cc6ca0),
  from apps/puzzled:
  * unit (CI lane command + env): 1205 pass / 6 skip / 1 fail -> 1212 tests
    across 126 files (86.88s), unit-exit=1 only because of the known parity test
    "schema/migration parity > drizzle schema and atlas migrations describe the
    same DDL" - it cannot run here ("schema-parity: no dev database available")
    and fails identically at base be3f6dc in a scratch worktree. Not ours.
  * typecheck: exit 0 (tsc --noEmit both configs).
  * lint: exit 0 (biome check ., 876 files, only pre-existing info hints).
  * build: first attempt failed - TurbopackInternalError "Symlink
    [project]/apps/puzzled/node_modules is invalid" (worktree symlinked
    node_modules; same trap as notes/td15-proof.md). After materialising real
    node_modules (bun install, 554 packages, 4.12s) the identical command built
    green: "Compiled successfully in 8.5s", 118/118 static pages, build-exit=0.
  * Raw logs: $HOME/work/pz-program/notes/td08f-{unit,typecheck,lint,build,build2}.log
- Next: re-run the mutation proof from scratch, then push refspec + open PR.
