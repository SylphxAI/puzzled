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


## TD-03 (committed)
Edit: apps/puzzled/src/lib/i18n/config.ts (LOCALE_REGISTRY: tag, ogLocale, english, native, short, badge, fallback, formats;
+ localeFacts() projection; derived localeNames/localeShortNames/localeBadges/localeFallbacks/localeFormats/localeGroups),
apps/puzzled/src/lib/seo/metadata.ts (OG_LOCALES = localeFacts('ogLocale'); HREFLAG = localeFacts('tag')),
apps/puzzled/src/shared/components/layout/language-switcher.tsx (LOCALE_BADGES map deleted; reads localeBadges).
Kept: four dead private helpers untouched (register row #13 owns dead-code removal).
BEFORE evidence: notes/td03-verify-seo-before.txt = "20 results: 18 pass, 0 fail"; 18 URLs captured in notes/td03-before/.
Local checks on the TD-03 tree: typecheck exit 0; bun test src/lib/i18n src/lib/seo -> 37 pass, 0 fail; biome clean.


## TD-03 byte-identical proof (measured, base 7523ba9 -> 3c0f4b5)
Method: production build (SKIP_ENV_VALIDATION=true NODE_ENV=production NEXT_PUBLIC_APP_URL=https://puzzled.gg),
served with `bun run start -p 3014`, both revisions; 18 URLs captured (see capture-surface.sh) plus
`bun run verify:seo --base http://localhost:3014`.
- verify:seo BEFORE: "20 results: 18 pass, 0 fail" (notes/td03-verify-seo-before.txt)
- verify:seo AFTER : "20 results: 18 pass, 0 fail" (notes/td03-verify-seo-after.txt)
- `diff td03-verify-seo-before.txt td03-verify-seo-after.txt` -> no output (identical)
- raw HTML: 16/18 files differ, 2 identical (robots.txt, sitemap.xml) - the delta is confined to
  build-volatile tokens: /_next/static/<hash> asset paths, the RSC client-reference build id (`\"b\":\"...\"`)
  and the page's live `fetchedAt` read timestamp.
- CONTROL (same build captured twice, 30s apart): the SAME 16 files differ, proving that volatility is
  per-run, not caused by the change.
- After normalising exactly those three token classes: BASE vs TD-03 = 18/18 identical; control = 18/18 identical.
- Visible text (script/style stripped, tags stripped, whitespace collapsed): 0 differing files.
Scripts: notes/td03-final-proof2.py (normalisation + both comparisons), notes/capture-surface.sh.

## Next action
TD-02: set config.name to the translations name for the 13 drifting modules; update registry.test.ts:71/108;
add src/games/module-name-ssot.test.ts guard; mutation-proof it; rebuild + re-capture.


## TD-02 (committed with this note)
13 config names reconciled to the module's own translations/en.json name (the name every served surface resolves first):
block-slide Block Slide->Slides; crossword Crossword Mini->Mini Grid; cryptogram Cryptogram->Cipher;
killer-sudoku Killer Sudoku->Cage Sudoku; nonogram Nonogram->Paint; pattern-match Pattern Match->Match;
quad-words Quad Words->Quad; word-box Word Box->Frame; word-groups Word Groups->Threads; word-guess Word Guess->Five;
word-hive Word Hive->Hive; word-ladder Word Ladder->Rungs; word-search Word Hunt->Hunt.
registry.test.ts:71,108 updated (Word Guess -> Five) because they pinned the drifted value.
Guard: src/games/module-name-ssot.test.ts (5 tests). Mutation: block-slide reverted -> RED naming the offender; restored
(blob 59ae7042) -> GREEN. Guard run against base 7523ba9 (temp detached worktree, removed) -> RED naming all 13.
Local checks: test:unit 1079 pass / 6 skip / 0 fail; typecheck exit 0; biome clean.


## Recovery run (2026-09-21, resumed after pod kill)
- [x] 1. Staging verified: the 16-file TD-02 set (13 config.ts + guard test + registry.test.ts + this note; +120/-15); HEAD == refs/heads/debt/td02-td03-ssot == 5388514617b3001c88620441ff8cdfc0b926cede; ls-remote origin agrees.
- [x] 2. Staged-tree proof: env -u NODE_ENV bun test src/games/module-name-ssot.test.ts src/games/registry.test.ts src/lib/i18n
      => 34 pass / 4 skip / 0 fail; 8435 expect() calls; Ran 38 tests across 5 files. [243.00ms]; TEST_EXIT=0; guard suite 5/5 pass; raw: notes/td02-recovery-proof.txt.
      Restore integrity: git hash-object block-slide/config.ts == 59ae7042c6bdc9f6683f2ead439aa63da6113845 (verified by the recovery run).
- [x] 3. TD-02 commit + push (this note + notes/td02-guard-on-base.txt + notes/td02-recovery-proof.txt ride along).
- [ ] 4. PR + checks; PR URL + head sha appended below once open.
Resume note: if a later run resumes mid-step, read this section; the push, if unverified, is HEAD:refs/heads/debt/td02-td03-ssot.
