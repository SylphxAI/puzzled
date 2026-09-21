# TD-15 progress - one difficulty vocabulary

STATUS: implemented; mutation proof done (notes/td15-mutation.md); local gate2
(suite/typecheck/lint/build) in flight; PR next.
BRANCH: debt/td15-difficulty-vocab (worktree td15)
BASE: b199007999789d862ac236b94ba010b1c3ff18e1

## Commits so far
1. skeleton (notes)
2. before-map (notes/td15-before.md)
3. code: helper + legend + hero + oracle test + common.json keys
4. notes: mutation + progress

## Next action
- fold gate2 results into notes/td15-proof.md; push; open the one Ready PR
  with the before/after map + proof + mutation + status; report.

## Design recap
- src/lib/i18n/difficulty.ts: DIFFICULTY_LEVELS = easy|medium|hard|tricky +
  difficultyLabelKey(n) -> common.difficulty.<level>. Numeric legend (word-groups
  how-to-play) resolves through it; game-page hero reads common.difficulty too.
- messages: en-US + tricky; zh-HK/zh-CN labels carry the translated strings the
  game layer already shipped (D4-adjacent copy move, called out in the PR);
  zh-TW/en-GB inherit (no overlay delta).
