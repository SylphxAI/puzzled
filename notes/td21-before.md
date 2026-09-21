# TD-21 before-map: result sharing per site (base b199007)

Branch: debt/td21-share-helper. Worktree: $HOME/workspace/.worktrees/github.com/SylphxAI/puzzled/td-21.
Base: origin/main = b199007999789d862ac236b94ba010b1c3ff18e1 (fetched 2026-09-21), after #163 (TD-02 name SSOT) and #164 (S3 result card).
Scope: the register row TD-21 - result sharing re-implemented per game; the shared module name is a literal.

## The 20 share call sites (file:line on the base)

| Site (apps/puzzled/src/...) | gameName source | mechanics before |
| --- | --- | --- |
| games/word-guess/word-guess-game.tsx:174 | literal Five | :181-186 share sheet -> clipboard + toast tShare(copied) |
| games/word-groups/word-groups-game.tsx:178 | literal Threads | :184-188 share sheet -> clipboard + toast |
| games/word-hive/word-hive-game.tsx:160 | literal Hive | :166-170 share sheet -> clipboard + toast |
| games/crossword/crossword-game.tsx:103 | literal Crossword Mini | :108 clipboard only (silent) |
| games/sudoku/sudoku-game.tsx:90 | literal Sudoku | :95 clipboard only |
| games/nonogram/nonogram-game.tsx:139 | literal Paint | :143 clipboard only |
| games/word-ladder/word-ladder-game.tsx:136 | literal Rungs | :140 clipboard only |
| games/arithmo/arithmo-game.tsx:137 | literal Arithmo | :142 clipboard only |
| games/pattern-match/pattern-match-game.tsx:111 | literal Match | :115 clipboard only |
| games/block-slide/block-slide-game.tsx:112 | literal Slides | :116 clipboard only |
| games/queens/queens-game.tsx:90 | literal Crowns | :94 clipboard only |
| games/tango/tango-game.tsx:84 | literal Duo | :88 clipboard only |
| games/word-box/word-box-game.tsx:106 | literal Frame | :110 clipboard only |
| games/quad-words/quad-words-game.tsx:152 | literal Quad | :156 clipboard only |
| games/killer-sudoku/killer-sudoku-game.tsx:120 | literal Cage Sudoku | :124 clipboard only |
| games/cryptogram/cryptogram-game.tsx:110 | literal Cipher | :114 clipboard only |
| games/word-search/word-search-game.tsx:141 | literal Hunt | :145 clipboard only |
| games/number-path/number-path-game.tsx:127 | literal Path | :131 clipboard only |
| games/pip-place/pip-place-game.tsx:210 | literal Spots | :216 clipboard only |
| features/daily/components/already-completed-view.tsx:88 | gameName prop (caller-resolved) | :103-108 share sheet -> clipboard + own toast |

Also in the share path: features/daily/components/game-result.tsx:112 builds the card model name via
tGames(slugToCamelCase(gameType) + .name, { defaultValue: gameType }) - resolves from the catalogue but with a weaker fallback (raw slug) than the TD-02 resolver uses.

## Families
- share-first (4): word-guess, word-groups, word-hive, already-completed-view. try/catch swallows cancel.
- copy-only (16): every other module; they never attempt the share sheet and give no feedback.
All 20 build their text through the shared formatRitualShareText (features/daily/lib/share-text.ts) and call getBaseUrl(origin) themselves.
The duplication that remains per site: the gameName literal, the origin call, and the share/clipboard dance.

## TD-02 name resolver (reused, not reinvented)
- Name = catalogue key games.<camel>.name where camel = slugToCamelCase(slug); copy lives in games/<slug>/translations/<locale>.json (en canonical + overlays).
- Pieces: readMessage(reader, key, fallback) at features/catalog/lib/catalog.ts:135; slugToCamelCase and playerTitle at lib/game-slug.ts:48/:31.
- Guard: games/module-name-ssot.test.ts pins config.name == catalogue name == PLAYER_TITLE for all 19.
- No single function resolve-name-for-slug existed; the new helper adds exactly that.

## Literal vs catalogue name (all 19 checked against games/translations/en.json)
- 18/19 literals equal the catalogue name; share text stays byte-identical after the change.
- 1 drift: crossword shares as Crossword Mini while every served surface says Mini Grid
  (TD-02 evidence: Mini Grid served 2x, Crossword Mini 0x). The share text is corrected to Mini Grid.

## Deliberately NOT converted (reasons)
- app/[locale]/(main)/settings/referrals/referrals-client.tsx:44-46 - invite share (title/text/url from the referrals i18n; no game result, no module name). Different payload; out of TD-21 scope.
- features/daily/lib/share-result-card.ts - the S3 card decision table (image + caption). It stays; the caption it falls back to is the result share text this helper builds.
- games/module-conformance.ts:70 - conformance oracle over module configs (name from config, not a user surface). Not a share site.

## Intended behaviour delta (deliberate, to be called out in the PR)
- The 16 copy-only sites now go through the same share-sheet-first flow (one share semantics for all results).
- Clipboard fallback path unchanged; no new user-visible strings; a toast only where the site already had one.

