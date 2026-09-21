# TD-14 - Day-key parsing done twice - progress

Branch: debt/td14-day-key-parse
Worktree: $HOME/workspace/.worktrees/github.com/SylphxAI/puzzled/td-14
Base: origin/main = 7523ba9ef74eb80567a44b033b02394f91cf28a0 (fetched + verified 2026-09-21; branch pre-created at this base, clean).

## Goal (register TD-14)
lib/product-day.ts DAY_KEY_PATTERN (isValidDayKey, ordinal0FromDayKey) vs
features/daily/lib/archive-days.ts its own DAY_KEY_PATTERN + shiftDayKey. Export ONE
parseDayKey from lib/product-day.ts; use in archive-days; delete the duplicate regex.
Tests incl. edge cases the two copies treated differently.

## Design (decided 2026-09-21)
parseDayKey(value: string | undefined | null): DayKeyParts | undefined - shape-only
(trim + /^(\d{4})-(\d{2})-(\d{2})$/ -> {year,month,day}), documented. Zero behaviour
change: isValidDayKey layers the calendar round-trip; ordinal0FromDayKey and archive
shiftDayKey keep throwing invalid_day_key on shapes that do not parse. Edge cases the
copies treated differently (2026-02-30, 2026-13-01 -> parse accepts, isValidDayKey
false, arithmetic normalises via Date.UTC) pinned in tests.

## Steps
1. [x] Recon at 7523ba9: both files read; usages listed (free-rotation, archive page,
   share-text, finish-recording). Third copy found in features/console/lib/finish-activity.ts
   (returns a numeric stamp; NOT this row - out of scope, noted for a possible future row).
2. [x] Notes checkpoint (this commit).
3. [ ] Edits: product-day.ts (parseDayKey + rewire isValidDayKey/ordinal0FromDayKey);
   archive-days.ts (import parseDayKey, delete pattern, rewire shiftDayKey);
   tests in product-day.test.ts + archive-days.test.ts.
4. [ ] Run tests (product-day, archive-days + neighbours); quote output.
5. [ ] Commit + push; open PR.

## Next action
Apply edits (step 3).

## Notes
- Host exports NODE_ENV=production -> run tests as: env -u NODE_ENV bun test ...
- Host quirk: shell calls often return 'exit undefined' but execute anyway - verify state
  before retrying; never blind-retry destructive commands.
- push: env -u GH_TOKEN -u GITHUB_TOKEN git push origin HEAD:refs/heads/debt/td14-day-key-parse
