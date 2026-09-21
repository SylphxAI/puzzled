# TD-10 - delete the dead private code so grep tells the truth: proof

Branch debt/td10-dead-private-defs, based on d6a5f5616 (post-#169 main). Deletion commit c02ef29.

## Register vs current main

- Register (TD-10, measured @e590b5c): 115 `_`-prefixed private defs in 68 files.
- Re-measured on the merged post-#169 tree: **114 defs / 68 files / 107 unique names**.
  The one-def delta is real history: `git diff e590b5c..d6a5f5616e -- apps/puzzled/src` shows exactly
  one net `_`-def line change (`-const _localeFormats`), removed by an earlier PR.
- #169 (admin audit) shifted the 4 `lib/audit` defs by +22 lines; added/removed none of the register set.

## Method (reproducible)

- Enumerate: `rg -n -e '^(async )?function _[A-Za-z0-9_]+' -e '^const _[A-Za-z0-9_]+' .` with
  `-g '!node_modules/**' -g '!notes/**' -g '!.next/**'` -> 114 defs (`notes/td10/defs-before.tsv`).
- Per name count occurrences of `_name` (cw) and bare `name` (cb) across the WHOLE repo (packages, scripts,
  e2e-tests, messages, docs; node_modules/.next/notes excluded): `notes/td10/verify.sh`,
  matrix `notes/td10/verify-before.tsv`.
- **Dead = cw == 1 and cb == 0**: the only occurrence of the symbol is its own definition line
  (all 72 verified: single occurrence line == definition line; `notes/td10/single-occ-before.tsv`), and the
  bare name occurs nowhere, so nothing can reach it by rename or alias either.
- Delete with a TS-AST script that removes the exact declaration range, refuses exports and line mismatches:
  `notes/td10/delete-dead-defs.ts`; JSON report: `removed=72, skipped=[]`.

## Result

| stage | defs | files |
|---|---|---|
| before (post-#169) | 114 | 68 |
| deleted (proven dead) | **72** | 49 |
| after | **42** | 29 |

- Net change of the deletion commit: 49 files, +4 / -1092.
- 72/72 deleted names now have 0 occurrences repo-wide (`notes/td10/zero-check-after.txt`).
- Re-enumeration after: 42 defs (`notes/td10/defs-after.tsv`). After-matrix vs before-matrix
  (`notes/td10/verify-after.tsv`): the only deltas are the 72 deleted names -> 0/0, plus
  `_getTodayDateString` cb 5->4 (one of its bare-name refs lived inside a deleted def; still retained).
- Remaining 42 = 38 retained (guard hit) + 4 out-of-scope:
  - Retained (35 names): real references (cw>1) or bare-name occurrences (cb>0). Examples:
    `_getPuzzleCount` 6 defs (cw=6), `_isValidWord` (3/23), `_getSizeFromSeed` (1/17), `_isPangram` (1/14),
    `_impersonation` (1/11), `_escapeHtml` (4/0), `_useHaptic` (1/1). Full table `notes/td10/retain-before.tsv`.
  - Out of scope, not deleted (per brief): `_getLocaleDirection`, `_getLanguageFromLocale`,
    `_isChineseLocale`, `_isEnglishLocale` - all in `src/lib/i18n/config.ts` (2 refs each anyway).

## Follow-on cleanup (byproducts of the removals)

Removing the defs orphaned their sole remaining consumers; removed rather than parked:
- 5 types: `ConsentPreferences` (consent.ts), `DifficultySelectorProps` + `DifficultyOption`
  (difficulty-selector.tsx), `DailyPuzzleResults` (puzzle-generator/lib/generator.ts), `SoundToggleProps` (sound-toggle.tsx).
- 2 consts: `REFERRAL_CONFIG`, `CURRENCY_CONFIG` (lib/config/validation.ts) - their only consumers were the
  deleted zod schemas. (Note: biome's unused-variable fix had auto-renamed them to `_`-prefixed; they were
  then deleted instead of left as parked code.)
- unused imports pruned, incl. `import { z } from 'zod'` in validation.ts.

## Gates (all green, on the deletion head c02ef29)

- `bun run lint` (apps/puzzled): **0 errors / 0 warnings** (23 pre-existing infos, all in untouched files).
- turbo typecheck (`--filter=@sylphx/puzzled --filter=@sylphx/ui --concurrency=1`): **2/2 successful**
  (also ran cache-miss in the pre-commit hook: 1 successful, 16.06s).
- `env -u NODE_ENV bun test src`: **1144 tests / 1138 pass / 6 skip / 0 fail / 34655 expect() calls [104.06s]**.
  (the 6 skips are pre-existing server-only skips.)
- `SKIP_ENV_VALIDATION=true NODE_ENV=production bun run build`: **Compiled successfully in 20.7s;**
  118/118 static pages generated.
- Raw outputs: `notes/td10/gate-{lint,typecheck,tests,build}.txt`.

## Wide-pattern scan (informational, out of register scope)

`let`-style module state and nested defs were scanned separately: `notes/td10/wide-scan-extras.tsv`.
One extra unreferenced local (`_totalWinsToday`, games-overview.tsx:52) would also be dead by cw==1/cb==0;
left out of the register pattern for a follow-up.

## Branch mechanics

- The branch was brought onto post-#169 main WITHOUT force-push: merge f4c921c keeps the pre-#169 notes
  ref as a parent (same technique as td01's 26ddd42); the remote update was a fast-forward.
- No force-push, no merge, no enqueue by this run.