# TD-02 / TD-03 SSOT dedup - run note (branch debt/td02-td03-ssot)

Worktree: $HOME/workspace/.worktrees/github.com/SylphxAI/puzzled/td-ssot
Base: origin/main = 7523ba9ef74eb80567a44b033b02394f91cf28a0

## State
- [x] 1. Recon read: register TD-02/TD-03 rows; s3-direction.md.
- [x] 2. Source recon (below).
- [ ] 3. BEFORE capture: prod build (NEXT_PUBLIC_APP_URL=https://puzzled.gg, SKIP_ENV_VALIDATION=true NODE_ENV=production),
      serve on :3014, run `bun run verify:seo --base http://localhost:3014` + capture raw HTML of a URL set.
- [ ] 4. TD-03 edit (config.ts registry + metadata.ts + language-switcher.tsx).
- [ ] 5. AFTER capture + diff (byte-identical requirement).
- [ ] 6. TD-02 name reconciliation (config.name <- translations en.json name).
- [ ] 7. Guard test + mutation proof; unit lane.
- [ ] 8. PR + independent review.

## Recon facts (measured at 7523ba9)
TD-03 site count: 8 keyed tables, all real:
  lib/i18n/config.ts: locales, localeNames, localeShortNames, localeFallbacks, localeGroups, _localeFormats(dead),
  lib/seo/metadata.ts: OG_LOCALES, HREFLANG; shared/components/layout/language-switcher.tsx: LOCALE_BADGES
  (+ region hints 'Hong Kong'/'Taiwan'/'Mainland China' inline at :256-260 - NOT covered by the row; report as remaining).
  Note: register says "nativeNames"/"languageGroups"/"localeFormats"; real exports are
  localeNames/localeGroups/_localeFormats (dead). Same facts, different names.
TD-02 (13/19 drift), config.name vs games/<slug>/translations/en.json name:
  block-slide 'Block Slide'/'Slides'; crossword 'Crossword Mini'/'Mini Grid'; cryptogram 'Cryptogram'/'Cipher';
  killer-sudoku 'Killer Sudoku'/'Cage Sudoku'; nonogram 'Nonogram'/'Paint'; pattern-match 'Pattern Match'/'Match';
  quad-words 'Quad Words'/'Quad'; word-box 'Word Box'/'Frame'; word-groups 'Word Groups'/'Threads';
  word-guess 'Word Guess'/'Five'; word-hive 'Word Hive'/'Hive'; word-ladder 'Word Ladder'/'Rungs';
  word-search 'Word Hunt'/'Hunt'.  (6 agree: arithmo, number-path, pip-place, queens, sudoku, tango.)
Canonical side = translations name, evidence:
  - messages.games = resolveGameMessages(locale) (lib/i18n/request.ts:426) builds the `games` namespace FROM games/<slug>/translations/*.json
  - catalogue card title: readMessage(tRoot, 'games.<camel>.name', playerTitle(slug)) (games/page.tsx:77, catalog.ts titleKey/canonicalTitle)
  - game page: readMessage(tGames, '<camel>.name', config.name) (games/[slug]/page.tsx:117)
  - stats/leaderboard: same translations-first pattern
  - PLAYER_TITLE (lib/game-slug.ts) agrees with the translations name for ALL 19 modules
  secondary surfaces that show config.name today (and so change): archive page, admin games-overview, home lineup name prop.
Existing tests to update: src/games/registry.test.ts:71,108 assert name 'Word Guess' -> 'Five'.
Extra duplicate found (OUT of scope, report): src/lib/api/hooks.ts:854 GAME_NAMES (same 19 names as PLAYER_TITLE).

## Next action
Wait for BEFORE build; start server :3014; save verify:seo output + HTML captures under notes/td03-before/.

