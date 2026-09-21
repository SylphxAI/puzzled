# TD-14 - Day-key parsing done twice - progress

Branch: debt/td14-day-key-parse
Worktree: $HOME/workspace/.worktrees/github.com/SylphxAI/puzzled/td-14
Base: origin/main = 7523ba9ef74eb80567a44b033b02394f91cf28a0 (fetched + verified 2026-09-21).

## Goal (register TD-14)
lib/product-day.ts DAY_KEY_PATTERN (isValidDayKey, ordinal0FromDayKey) vs
features/daily/lib/archive-days.ts its own DAY_KEY_PATTERN + shiftDayKey. Export ONE
parseDayKey from lib/product-day.ts; use in archive-days; delete the duplicate regex.
Tests incl. edge cases the two copies treated differently.

## Design (2026-09-21)
parseDayKey(value: string | undefined | null): DayKeyParts | undefined - shape-only
(trim + /^(\d{4})-(\d{2})-(\d{2})$/ -> {year,month,day}), documented: isValidDayKey
layers the calendar round-trip; ordinal0FromDayKey and archive shiftDayKey keep throwing
invalid_day_key on shapes that do not parse. Zero behaviour change; edge cases the copies
treated differently (2026-02-30, 2026-13-01 -> parse accepts, isValidDayKey false,
arithmetic normalises via Date.UTC) pinned in tests.

## Steps
1. [x] Recon at 7523ba9 (both files + usages; third copy noted out-of-scope in
   features/console/lib/finish-activity.ts - numeric stamp, not this row).
2. [x] Notes checkpoint f9590c7 (pushed).
3. [x] Edits done: product-day.ts (+parseDayKey, rewire isValidDayKey/ordinal0FromDayKey),
   archive-days.ts (import parseDayKey, pattern deleted, shiftDayKey rewired),
   tests: product-day.test.ts (+parseDayKey describe), archive-days.test.ts (+2 gate tests).
4. [x] Tests: 28 pass / 0 fail / 71 expect (2 files, td14-tests.txt covers 6 files:
   58 pass / 0 fail / 138 expect). Lint: biome clean (lefthook capture). Typecheck:
   tsc --noEmit + e2e passed (td14-typecheck2.txt tcexit=0; pre-commit hook turbo
   typecheck 12.8s successful in td14-hook-typecheck.txt).
   NOTE: worktree had no node_modules; ran 'bun install --frozen-lockfile' (554 pkgs, 22.5s).
5. [x] Commit ae46b76 'refactor(daily): read every day key through one shared parseDayKey (TD-14)';
   push pending at note time (host network flaky).
6. [x] Pushed (c561d7e); PR https://github.com/SylphxAI/puzzled/pull/167 opened (head c561d7e3817f48fe0bb9cdfaab77e4f5c101ea24, base main).

## Next action
Done - TD-14 complete (PR open for review).

## Evidence files ($HOME/work/pz-program/notes/)
- td14-tests.txt (58 pass / 0 fail / 138 expect, 6 files)
- td14-typecheck2.txt (tcexit=0), td14-hook-typecheck.txt (pre-commit: biome + turbo typecheck OK)
- td14-install.txt (bun install, exit 0)

## Notes
- Lefthook pre-commit runs biome + turbo typecheck on apps/puzzled/** commits - commits
  take ~15-20s while hooks run; do not re-issue a commit while hooks are running.
- Host quirk: shell calls often return 'exit undefined' but execute anyway - verify state
  before retrying.
