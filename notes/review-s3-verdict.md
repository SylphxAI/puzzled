# Independent review — PR #186 (S3 richness-1) — VERIFIER

Reviewer worktree: /data/sylphx/home/work/pz-rev-s3 — branch review/s3-richness — pushed to origin/review/s3-richness.
Author worktree /data/sylphx/home/work/pz-s3-rebase was NOT touched (no read, no write).
PR: https://github.com/SylphxAI/puzzled/pull/186 — head s3/richness-1 = 9f88d5993628d43d1dc132c1ed40161fba39dfea (baseRefName main, MERGEABLE, not draft).

## VERDICT: PASS (no blockers) — with 3 minor notes (all non-blocking) + 1 residual unverified risk

Commit graph: 561b1324c IS an ancestor of head. base..head = 19b71cd (feat), 99aa96d (docs), d90cac4 (docs skeleton),
fd97dce (fix .numeral), 88ee8cd (docs), 1ed25e6 (chore evidence), 9f88d59 (docs). 7 commits.
(The brief's 657dfb8/6976394 are pre-rebase SHAs; content maps to 19b71cd/99aa96d.)

## Evidence table (author numbers are CLAIMS; mine are reproduced)

| # | Check | Claim | Reproduced | Verdict |
|---|-------|-------|-----------|---------|
| 1 | Scope = 35 files, all apps/puzzled/** + notes/** | — | 17 app files (16 changed + 1 new script) + 18 notes files; nothing outside | OK |
| 2a | globals.css vs base EMPTY | dropped duplicate .numeral | `git diff 561b1324c..HEAD -- apps/puzzled/src/app/globals.css` -> EMPTY | OK |
| 2b | result-card.ts vs base EMPTY | no-spoiler model untouched | diff -> EMPTY (byte-identical) | OK |
| 2c | stats/page.tsx carries BOTH tokens | #184 amber-800 + S3 numeral/accent-warm | amber-800 :167 (untouched by S3 diff), accent-warm :177,:358, numeral :343,:351 | OK |
| 3 | 11 themes have stripe + glow; tile applies them | yes | theme-colors.ts fields :47-50; 11 entries :69/:80/:91/:102/:113/:124/:135/:146/:157/:168/:179 + fallback :203-204; game-tile.tsx glow :63, stripe :73, icon-chip ring :78, own-hue CTA :116; shell `hover:border-primary/30` removed (diff) | OK |
| 4 | Empty states warm, no be-the-first, archive real branch, guard tests green | yes | leaderboard empty.title/body rewritten (en-US :26-27, zh-CN, zh-HK; zh-TW block ADDED :10-13); stats modules.empty :110 (en-US/zh-CN/zh-HK); archive.json emptyTitle/emptyBody/emptyPlay (en-US :19-21); archive/page.tsx :161 `days.length === 0` warm card + play-today CTA :175. Guard: `bun test src/lib/i18n/` = 31 pass / 0 fail (6 files) — I ran it | OK (see note M1) |
| 5 | result-card palette ink #0e1226 + warm paper, display wordmark | yes | render :57 bg #0a0f1c->#0e1226, :65 text #f8fafc->#faf6ef (+ :66 muted), DISPLAY_FONT_FAMILY 'Space Grotesk' :26-28 used :195 (wordmark) + :207 (game name); notes/redesign-spec.md:7 "display = Space Grotesk" | OK |
| 6 | AE pairs ~11.5k home / ~45k games; warm corners; dims match | yes | ALL 8 pairs reproduced to the exact integer (below); 16 files, dims match per pair; corners srgb(250,246,239) in BOTH light before+after | OK |
| 7 | lint exit 0 / 26 infos; typecheck 2 ok; test 1214/6/5 (5 pre-existing) | yes | `bun run lint` (= biome check .) in apps/puzzled: LINT_EXIT=0, "Checked 888 files", "Found 26 infos" | lint OK; typecheck+full test NOT locally re-run (see M3) |
| 8 | CI 9/9 green, run 35817533332 | yes | `gh pr checks 186` = 9/9 pass; headRefOid 9f88d599… = the reviewed commit | OK |

### Item 6 — AE measurement (my recomputation, ImageMagick `compare -metric AE`)
| pair | dims (before = after) | my AE | author AE |
|---|---|---|---|
| desktop home-light | 1440x3751 | 11,481 | 11,481 |
| desktop home-dark | 1440x3751 | 11,671 | 11,671 |
| desktop games-light | 1440x4098 | 44,795 | 44,795 |
| desktop games-dark | 1440x4098 | 46,144 | 46,144 |
| mobile home-light | 390x6528 | 10,992 | 10,992 |
| mobile home-dark | 390x6528 | 11,042 | 11,042 |
| mobile games-light | 390x8888 | 33,786 | 33,786 |
| mobile games-dark | 390x8888 | 34,144 | 34,144 |

Corner probe (light): before/after home + games all `srgb(250,246,239)` = warm paper in BOTH (both post-skin) — matches brief.
Extra proof the "after" set really contains S3's per-game hues (and not just drift): colours present ONLY in after-desktop-light-games.png
at stripe-like counts — #00B8DB 3132px, #62748E 2092, #FF6900 2088, #FE9A00 2088, #8E51FF 2088, #F6339A 1046, #FF2056 1044,
#7CCF00 1044, #00A6F4 1044, #2B7FFF 684 — i.e. Tailwind v4's oklch values for cyan/slate/orange/amber/violet/pink/rose/lime/sky/blue-500.
(The classic hexes #10b981/#06b6d4/… do NOT appear anywhere: v4 ships the palette in oklch. A first probe with classic hexes returned 0 —
that is palette encoding, not missing stripes; the oklch RGBs are the correct key.) Removed-colour side is only AA remnants (12-21px), no element removed.

## What CI green (9/9) does NOT prove — and what I covered instead
- Accessibility / Lighthouse / SEO / Build / Migration / Rust / Security: real, but layout-level; they cannot see the
  screenshot provenance or hover states. Provenance covered by my AE + new-hue analysis above.
- "Unit Tests" pass says the no-spoiler render test (`result-card-render.test.ts`, unchanged) and the i18n catalogue guard
  pass on this SHA. I re-ran the i18n guard myself (31/0) but NOT the full suite (see M3).
- CI cannot judge copy tone (M1) or note-vs-tree accuracy (M2), and cannot exercise hover (R1).
- Screenshots in the PR are assets, not checked by CI at all; the 44,795/11,481 etc. numbers are only as good as the capture run —
  I verified the images reproduce those numbers and that the after images carry the new hues, but the exact capture conditions
  (dev server vs build, networkidle, lazy-scroll) are taken on the author's word.

## Minor notes (non-blocking)
- M1 — copy tone, zh leaderboard: the en-US rewrite ("the board is yours to set") drops the old "the first score could be yours"
  framing, but the zh bodies still read "榜首由你來定/決定" (zh-CN leaderboard.json:27, zh-HK :27, zh-TW :12) — i.e. "the top spot is
  yours to decide". That is the same first-place promise in a warmer costume, while the author's own note (notes/s3-richness-progress.md:45)
  claims "never be-the-first". If that's a literal product rule, the three zh leaderboard bodies want a reword. en-US is fine; no literal
  "no … yet / first score" leftover survives anywhere.
- M2 — stale prose inside the PR: notes/s3-richness-progress.md:12/:21/:38/:49 still say `.numeral` was appended/"EXTENDED" into globals.css;
  the final tree has globals.css identical to main (#184 owns .numeral at globals.css:1532, which the stats/console classes resolve against —
  globals.css:135/#246 register --color-accent-warm, so the classes are valid). fd97dce + notes/s3-rebase-progress.md item 2 correct this;
  the stale lines remain in the same PR. Docs hygiene only.
- M3 — gates not fully independently reproduced: I re-ran biome (exit 0 / 26 infos) and the i18n guard suite, and did NOT re-run
  typecheck or the full 1214-test suite (time budget). Those rest on the author's report plus CI on the identical SHA.

## Residual risk (unverified, low severity)
- R1 — hover-shadow precedence: game-tile root now carries BOTH `hover:shadow-lift` (game-tile.tsx:62) and colors.glow's
  `hover:shadow-[0_8px_24px_-6px_rgba(...)]` (:63). Same-specificity hover shadows; which one paints depends on Tailwind's emission order.
  Screenshots cannot show hover, and I did not run a hover probe. Both are legitimate values, so worst case is the lift shadow instead of the
  hue-tinted glow. Worth a 30-second hover check on the preview before merge.

## Reproduce (all from my worktree)
- scope: `git diff --name-status 561b1324c..9f88d59` (35 files)
- rebase: `git diff 561b1324c..HEAD -- apps/puzzled/src/app/globals.css` and `… daily/lib/result-card.ts` (both empty)
- AE: `cd notes/screenshots && compare -metric AE before-<p>.png after-<p>.png null:` for the 8 pairs
- lint: `cd apps/puzzled && bun run lint` -> exit 0, 26 infos
- guard: `cd apps/puzzled && bun test src/lib/i18n/` -> 31 pass, 0 fail
- CI: `env -u GH_TOKEN -u GITHUB_TOKEN gh pr checks 186 -R SylphxAI/puzzled`

Verdict: PASS. No blockers. M1 (zh copy) and R1 (hover) are worth a look before merge but neither contradicts an acceptance criterion of the slice.

---

## DELTA re-verification — head 01b352d (was 9f88d59), 2026-09-23 06:1x BST — VERDICT: DELTA PASS

Scope of delta: `git diff --stat 9f88d59..01b352d` = 4 files, +68/-12 — exactly
A apps/puzzled/scripts/s3-hover-probe.ts (43), M apps/puzzled/src/games/theme-colors.ts (22), M
apps/puzzled/src/shared/components/games/game-tile.tsx (2), M notes/s3-rebase-progress.md (13).
Nothing stray; nothing outside apps/puzzled/** + notes/**.

Content verified
- game-tile.tsx:62 — shell class string no longer carries `hover:shadow-lift` (tile still has hover:-translate-y-0.5, shadow-card,
  focus-within ring).
- theme-colors.ts — all 11 themes (:70,:81,:92,:103,:114,:125,:136,:147,:158,:169,:180) replace
  `hover:border-<hue>-500/60` with `hover:ring-2 hover:ring-<hue>-500/60`; per-hue glow shadow string unchanged;
  DEFAULT_GAME_COLORS (:204) keeps `hover:shadow-lift` for fallback themes.

Probe reproduced (my own worktree pz-rev-s3-delta at 01b352d, dev server :3511, chromium, fresh server restarted after checkout)
- Author probe `apps/puzzled/scripts/s3-hover-probe.ts`: PROBE_EXIT=0, JSON:
  `{"hovered": true, "boxShadow": "rgba(0,0,0,0) 0px 0px 0px 0px, rgba(0,0,0,0) 0px 0px 0px 0px, rgba(0,0,0,0) 0px 0px 0px 0px,
  oklab(0.695996 -0.162107 0.0511875 / 0.6) 0px 0px 0px 2px, rgba(16,185,129,0.45) 0px 8px 24px -6px}", "hasGlowShadow": true,
  "hasRing": true, "ok": true}`
- My independent probe (/tmp/rev-hover-independent.ts, own script): rest state = only shadow-card (no ring, no glow);
  hover state = `... oklab(0.696 -0.162 0.051 / 0.6) 0px 0px 0px 2px, rgba(16,185,129,0.45) 0px 8px 24px -6px`.
  hasLift = false — the --shadow-lift signature (globals.css:54 `0 18px 40px -18px … , 0 8px 16px -12px …`) is NOT applied on hover. veredict: DELTA-OK.

Root-cause claim (author's deeper find) corroborated independently
- On hover the tile's border-top-color resolves to `rgb(230, 220, 205)` == `var(--color-border)` (#e6dccd): the old
  `hover:border-<hue>-500/60` utility genuinely never painted.
- globals.css contains exactly one `@import "tailwindcss"` (line 1) and NO `@layer` directive before the
  `* { border-color: var(--color-border) }` block at globals.css:358-360 → that rule is unlayered and therefore outranks every
  layered Tailwind utility, app-wide. Confirmed by reading the file, not only by the probe.

Residual (non-blocking, cosmetic)
- `hover:ring-2` and the shell's `focus-within:ring-2 focus-within:ring-ring` set the same ring vars; a tile that is hovered AND
  focus-within resolves the ring colour by emission order (may show the focus ring colour). Cosmetic.
- The ring paints outside the border box; on a tight grid a later-DOM sibling tile can overlap its outer 2px. Cosmetic.
- The app-wide deadness of `border-*` colour utilities (many call sites, e.g. archive/page.tsx:128/152/193/216,
  games/page.tsx:138, difficulty-selection-view.tsx:53/61/69) is now DOCUMENTED but not fixed — deliberately out of this PR
  (root-cause fix = wrap the rule in @layer base, an app-wide visual change). Agreed with that call.

CI on the new head (run 35821244436, at 06:1x BST): 6 pass (Unit Tests, Lint & Type Check, SEO Contract, Migration Integrity,
Rust API, Security Scan), 3 pending (Accessibility, Build, Lighthouse Budgets) — NOT yet 9/9 at the time of this check.

Repro caveat for future reviewers: a fresh worktree CANNOT reuse the main clone's node_modules by symlink — turbopack aborts with
"Symlink [project]/apps/puzzled/node_modules is invalid, it points out of the filesystem root". Workaround used: `cp -al` (hardlink
copy) of root node_modules, apps/puzzled/node_modules and packages/ui/node_modules, then restart the dev server.

VERDICT: DELTA PASS — R1 closed (glow shadow now paints, lift no longer wins), the deeper border/layer finding independently
corroborated, no stray changes, nothing contradicts the earlier PASS.
