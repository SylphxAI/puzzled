# S3 first slice — progress handover

Branch `s3/day-surface` off `origin/main` = `e590b5c`. Worktree
`/data/sylphx/home/workspace/.worktrees/github.com/SylphxAI/puzzled/s3-day`.
Host/HOME: `/data/sylphx/home`; every git/gh call carries `env -u GH_TOKEN -u GITHUB_TOKEN`.

## TASK 0 — difficulty copy resolves everywhere (committed)

**Defect.** The home featured-game card binds
`t('games.<slugToCamelCase(slug)>.difficulty.<level>')` with no fallback
(`src/app/[locale]/(main)/page.tsx`), the `games` namespace is
`resolveGameMessages(locale)` (`src/lib/i18n/request.ts`), and only `sudoku`
carried a `difficulty` block. The other four difficulty-capable modules
(`block-slide`, `killer-sudoku`, `nonogram`, `queens`/`crowns`) had none, so the
live home page printed `games.crowns.difficulty.easy`, `…medium`, `…hard` as
literal text. `crowns` is today's rotation slot (`FREE_GAME_ROTATION` index
`ordinal0(2026-09-20) % 5 == 2`), which is why the live page shows that module.

**Fix.** `games/<slug>/translations/en.json` gains a `difficulty` name block for
the four modules that lacked it, and every one of the five difficulty-capable
modules gains a real `difficultyDescriptions` block. Each config's
`descriptionKey` now points at `games.<module>.difficultyDescriptions.<level>`
(it used to point at the same block the chip reads, i.e. at the *name*), so the
declared description is a description. The zh overlays that exist for these
modules (`queens`, `sudoku` × zh-HK/zh-TW/zh-CN) carry translated names and
descriptions; the rest resolve through the declared English fallback.

**Guard.** `src/lib/i18n/difficulty-copy.test.ts` scans every registered game
config (`GAME_CONFIGS`), and for each `difficultyLevels` entry × each of the five
locales asserts that `labelKey` resolves in the `common` catalogue, that
`descriptionKey` resolves in the resolved `games` catalogue, and that the path
the render sites actually build (`games.<camel>.<difficulty>.<level>`) resolves.
A missing key renders as its own dotted path, so that is asserted too.

**Mutation proof** (throwaway at `~/work/pz-s3-mutation`: `src`/`tests` copied by
tar, `node_modules` symlinked — never the worktree, and never a hardlink tree):

| Tree / mutation | Edit landed | Result |
| --- | --- | --- |
| base content (`git show e590b5c:…queens/{translations/en.json,config.ts}`) | `grep -c difficultyDescriptions` = 0, `grep -c "difficulty"` = 0 | **red**, 2 fail (both defect tests) |
| M1: drop the `difficulty` block from `queens/translations/en.json` | `grep -c '"difficulty"'` = 0 | **red**, 1 fail — names test, first offender `{en-US, crowns, easy, games.crowns.difficulty.easy}` |
| M2: `descriptionKey` → `games.queens.difficultyDescriptions.missingLevel` | `grep -n missingLevel` shows line 31 | **red**, 1 fail — descriptionKey test only |
| head | — | **green**, 4 pass / 0 fail / 603 expect() calls |

Each red was followed by restoring the file from the worktree and re-running
green; the worktree's own `git status` stays as committed.

## Next

TASK 1 day surface, TASK 2 scoped tokens, TASK 3 evidence, TASK 4 direction doc.
