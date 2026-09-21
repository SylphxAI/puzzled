# TD-15 before-map (base b199007999789d862ac236b94ba010b1c3ff18e1, post-TD-01 main)

All counts re-measured on origin/main. Paths relative to apps/puzzled unless noted.

## Shape 1 - the shared label block (messages/*/common.json)
- difficulty block present in 3 of 5 locale files today: en-US, zh-HK, zh-CN.
  (register said 5 x; TD-01 collapsed en-GB and zh-TW to overlays: en-GB has no
  common.json at all; zh-TW common.json exists but carries no difficulty keys.)
- en-US: easy Easy / medium Medium / hard Hard.
- zh-HK and zh-CN: English placeholders (Easy/Medium/Hard) - untranslated
  (surface-audit D4 territory, owner localization).
- refs: grep -rn 'common\.difficulty' src | wc -l = 21.

## Shape 2 - game configs declare labelKey + descriptionKey
- 5 configs x 3 levels: labelKey 15 total, descriptionKey 15 total.
- descriptionKey form is 'games.<camel>.difficultyDescriptions.<level>'
  (register wrote .difficulty. - corrected here).
- Runtime readers of labelKey/descriptionKey: none - only lib/i18n/difficulty-copy.test.ts
  reads them. The game page builds its own game-layer key (shape 4).

## Shape 3 - the numeric variant (word-groups legend)
- t('difficulty.0'..3') x 4 refs, all src/games/word-groups/components/how-to-play.tsx:47,51,55,59.
- values in src/games/word-groups/translations/*.json: en Easy/Medium/Hard/Tricky;
  zh-HK+zh-TW 簡單/中等/困難/棘手; zh-CN 简单/中等/困难/棘手.
- The 4th level is real: category.level 0..3 is gameplay data (types.ts CategoryLevel;
  puzzles.ts every puzzle has levels 0..3; CATEGORY_COLORS; solved-category.tsx;
  word-groups-game.tsx share emoji ['...'][level]).
  => the vocabulary keeps a 4th level.

## Shape 4 - game-layer label duplicates + the leaky reader
- 6 modules carry their own difficulty label blocks in their translations
  (block-slide/killer-sudoku/nonogram/queens/sudoku: difficulty.easy/medium/hard;
  word-groups: difficulty.0..3) = 19 keys x 4 locales = 76 values across 24 files.
  zh values are consistent: 簡單/中等/困難 (zh-HK, zh-TW) and 简单/中等/困难 (zh-CN).
- leaky reader: app/[locale]/(main)/games/[slug]/page.tsx:124-128 builds
  games.<camel>.difficulty.<level> (readMessage fallback = raw level word) ->
  GamePageHero chips (features/catalog/components/game-page-hero.tsx:157).
- sudoku translations re-declare easy/medium/hard (register): still true; off-limits here.

## Who reads what at runtime
- common.difficulty: difficulty-selection-view.tsx; difficulty-selector.tsx
  (DifficultyBadge + a dead _DifficultySelector); already-completed-view.tsx;
  minimal-header.tsx via DifficultyBadge.
- games.<camel>.difficulty.<level>: only games/[slug]/page.tsx (hero chips).
- games.<camel>.difficultyDescriptions.<level>: no runtime reader found (config + test only).
- numeric t('difficulty.N'): only the word-groups legend.

## Labels each surface shows today (easy/medium/hard)
- pickers, badges, hero on home (common.*): en EN; zh EN placeholders.
- game-page hero chips (game layer): en EN; zh Chinese (translated since #155/#162).
- word-groups legend: en EN; zh Chinese (+Tricky/棘手).
=> zh is internally split (common placeholders vs game layer translated); a
   convergence that reads only common would regress the zh hero/legend strings.

## Proof harness
- apps/puzzled/scripts/i18n-resolved-catalogue.ts (dump/compare/parity), TD-01 helper.
- BEFORE dump: /data/sylphx/home/work/pz-program/td15/resolved-before/ (scratch, not committed).
  sha256 per locale: en-US 8562c8c2ddbe6b23056ceb5cc67f10cb99e8a5c166804b12d0ce5df84fa5f400,
  en-GB 9372c36664890ce0b72366fdbd48e725ce2f38129a7bc8d54a98c867532a8c67,
  zh-HK 83f78a51f482defec159c56e8b364b6409a4de59c9784362e2a90eebd5edd7d8,
  zh-TW 93db995c59b2cfb694b1914cfbc1dc484c48e71655b2d207e13833db0bb71820,
  zh-CN 983e7797ea12acc27c7d7be95d68d47992bb059542f04952e47a2b32660f1ce4.
- guards to keep green: message-catalogue.test.ts (overlay deltas no-op; per-namespace
  structure parity vs en-US), game-messages.test.ts, difficulty-copy.test.ts.
