# S3 first slice — progress handover

Branch `s3/day-surface` off `origin/main` = `e590b5c`. Worktree
`/data/sylphx/home/workspace/.worktrees/github.com/SylphxAI/puzzled/s3-day`.
Host/HOME: `/data/sylphx/home`; every git/gh call carries `env -u GH_TOKEN -u GITHUB_TOKEN`.

## Host gotchas found on the way (worth keeping)

- Creating a worktree on this host fails with `Too many open files` when the pod's
  real fd budget is exhausted (the reported `ulimit -n` is 1048576; a file-creating
  probe dies around 20-500 fds). Workaround used: `git worktree add --no-checkout`,
  then `git read-tree HEAD && git checkout-index -a -f` repeated until
  `git status --porcelain` is clean.
- `chromium.launch()` (playwright's headless shell) hangs in `page.screenshot` and in
  a raw CDP `Page.captureScreenshot` on this host, while `page.title()` works.
  `chromium.launch({ channel: 'chromium' })` (the full chromium build,
  `chromium-1208/chrome-linux64/chrome`) with
  `--no-sandbox --disable-dev-shm-usage --disable-gpu` captures fine.

## TASK 0 — difficulty copy resolves everywhere (commit 7f33225)

**Defect.** The home featured-game card bound
`games.<slugToCamelCase(slug)>.difficulty.<level>` with no fallback, the `games`
namespace is `resolveGameMessages(locale)` (`src/lib/i18n/request.ts`), and only
`sudoku` carried a `difficulty` block. The other four difficulty-capable modules
(`block-slide`, `killer-sudoku`, `nonogram`, `queens`/`crowns`) had none, so the
page printed raw key paths. `crowns` is today's rotation slot
(`ordinal0(2026-09-20) % 5 == 2`).

**Fix.** `difficulty` name blocks for the four modules that lacked them; real
`difficultyDescriptions` blocks for all five; each config's `descriptionKey`
repointed at the descriptions block (it used to point at the same block the chip
reads). zh overlays for queens and sudoku carry translated names and descriptions.

**Guard.** `src/lib/i18n/difficulty-copy.test.ts` — every registered config × every
locale × labelKey / descriptionKey / the path the render sites build.

**Mutation proof** (throwaway at `~/work/pz-s3-mutation`: `src`+`tests` copied by tar,
`node_modules` symlinked — never the worktree, never a hardlink tree):

| Tree / mutation | Edit landed | Result |
| --- | --- | --- |
| base content (`git show e590b5c:…queens/{translations/en.json,config.ts}`) | `grep -c difficultyDescriptions` = 0, `grep -c "difficulty"` = 0 | **red**, 2 fail (both defect tests) |
| M1: drop the `difficulty` block from `queens/translations/en.json` | `grep -c '"difficulty"'` = 0 | **red**, 1 fail — names test, offender `{en-US, crowns, easy, games.crowns.difficulty.easy}` |
| M2: `descriptionKey` → `games.queens.difficultyDescriptions.missingLevel` | `grep -n missingLevel` = line 31 | **red**, 1 fail — descriptionKey test only |
| head | — | **green**, 4 pass / 0 fail / 603 expect() calls |

## TASK 1 + 2 — the day surface and its scoped tokens (commits 5d8fc20, 4158d4e)

`home-day.tsx` (with `day-countdown.tsx` and `features/home/lib/day-boundary.ts`)
replaces `home-hero.tsx`; `page.tsx` passes `getPuzzleNumber(todaysFreeGame)` and the
day label; `TrustBand` carries the three bullets below the day; the replaced hero
copy and `playersTodayNone` are deleted from all five catalogues;
`.day-surface` in `globals.css` plus `Space_Grotesk` in the locale layout hold the
scoped display-face token and tile radius/shadow scale.

## TASK 3 — evidence

Trees: base `e590b5c` in `~/work/pz-s3-before` (git archive; the clone was never
switched), branch tip in the worktree. Both built with
`SKIP_ENV_VALIDATION=true NODE_ENV=production bun run build` and served with
`bun run start -p 4322` / `-p 4321`.

| File | What |
| --- | --- |
| `~/work/pz-program/evidence/s3/before-home-390.png` | base `/` at 390x844 |
| `~/work/pz-program/evidence/s3/before-home-1440.png` | base `/` at 1440x900 |
| `~/work/pz-program/evidence/s3/before-games-1440.png` | base `/games` at 1440x900 |
| `~/work/pz-program/evidence/s3/after-home-390.png` | branch `/` at 390x844 |
| `~/work/pz-program/evidence/s3/after-home-1440.png` | branch `/` at 1440x900 |
| `~/work/pz-program/evidence/s3/after-games-1440.png` | branch `/games` at 1440x900 |

Captured with `node shots.mjs <url> <out> <w> <h>` (playwright, `channel: 'chromium'`).
The two `/games` captures are byte-identical (md5 `4a0f33172b`) — that surface is
untouched by this branch, and it shows the capture path is deterministic.

**Raw-key sweep** (`~/work/pz-program/sweep-raw-keys.py <base-url>`), visible text only,
script/style stripped, eight surfaces:

- base `e590b5c` on 4322: `/` → **3 raw keys** (`games.crowns.difficulty.easy`,
  `…medium`, `…hard`); `/games`, `/games/crowns`, `/games/word-guess`, `/pricing`,
  `/support`, `/login`, `/signup` → 0.
- branch on 4321: **0 raw keys, 0 `undefined`/`NaN`** on all eight.

## TASK 4 — direction doc

`docs/program/website-refactor/s3-direction.md` — diagnosis (8 claims, each citing a
live URL, a file:line or a command output), direction, and what the slice leaves out.

## Checks run

- `bunx tsc --noEmit` clean; `bunx biome check .` clean (840 files).
- `NODE_ENV=test DATABASE_URL=… SKIP_ENV_VALIDATION=true bun run test:unit` (CI's own env):
  **1074 pass, 6 skip, 0 fail, 32978 expect() calls**, 1080 tests / 107 files.
- `bun run build` succeeds on both trees.

## Left open

The result card (register G3) is not implemented; the shell outside `.day-surface`
keeps the indigo palette and card radius scale; the shelf's Premium/Unlock badges and
the nav are recorded in the direction doc, not changed.
