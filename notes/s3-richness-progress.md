# S3 richness-1 — per-game identity, warmth, numerals, result-card skin

Branch: s3/richness-1 off origin/main (7dd8e93). Worktree: s3-richness.
Direction SSOT: notes/redesign-spec.md (branch feat/redesign-atmosphere, PR #184) — read first.
Rule: globals.css + nav-items.ts are EXTENDED, never rewritten (PR #184 owns them).

## Verified premises (2026-09-22)
- S3 day-surface slice IS on main: home-day.tsx (312 lines), day-countdown.tsx,
  .day-surface token block in globals.css (~474-556), --font-day-display-family (Space_Grotesk).
- Result card G3 IS on main: src/features/daily/lib/result-card.ts + result-card-render.ts
  (1080x1080 canvas, per-module palette cross-checked to theme-colors pattern rgba triple).
- .numeral class lives on feat/redesign-atmosphere ONLY (globals.css:1531); main has only .tnum.
- /pricing already out of NAV_ITEMS on feat/redesign-atmosphere (verify against main at nav edit).

## Plan
A. game-tile.tsx + theme-colors.ts: accent stripe, icon chip ring, hover glow in the module's own hue
   (all four sites today-lineup + /games use GameTile — one component change covers both).
B. leaderboard/stats empty copy: 'the first score could be yours' + bare 'No module has a finished
   session yet.' -> warm, invitation copy in en-US/en-GB/zh-CN/zh-HK; archive gets a proper empty
   branch (archiveDays length 0).
C. stats: .numeral (new token, extended into globals.css) on streak/times/counts; celebration moments
   -> --color-accent-warm.
D. result-card-render.ts: cardPalette bg/text/muted from the redesign spec (#0e1226 ink / warm paper),
   wordmark in display face. No-spoiler model untouched — assert tests still green.

## Next action
1. write notes/s3-richness-progress.md + code edits (A-D)  <- HERE
2. typecheck + unit tests (bun run test:unit) + build
3. screenshots before/after -> notes/screenshots/ (restart dev server before shots — stale CSS incident)
4. commit + push every step to s3/richness-1
## STATE UPDATE (2026-09-22 17:06, post cut-off continuation)
Premises re-verified earlier this session against the tree at origin/main (7dd8e93):
- S3 day surface ON main: home-day.tsx (312 lines), day-countdown.tsx, .day-surface token block
  (globals.css ~474-556), --font-day-display-family (Space_Grotesk preload:false).
- Result card G3 ON main: result-card.ts + result-card-render.ts (1080x1080 canvas).
- notes/redesign-spec.md on feat/redesign-atmosphere (PR #184) read as direction SSOT:
  ink #0e1226 / warm paper #faf6ef, Space Grotesk display, .numeral tabular, game hues own tiles.
- .numeral on main: NOT present before my change (only .tnum) -> added, extending globals.css.

### Code changes ALREADY APPLIED in worktree s3-richness (branch s3/richness-1):
A. theme-colors.ts: +stripe/+glow fields on all 11 themes (static class strings).
   game-tile.tsx: accent stripe (colors.stripe), icon chip ring-2 ring-white/25,
   hover glow (colors.glow) replaces shell hover:border-primary/30, CTA text in colors.text.
   One component change covers today-lineup + /games tiles (both use GameTile).
B. empty-state copy rewritten (warm, never be-the-first, never bare) in leaderboard.json,
   stats.json modules.empty, archive.json empty* keys in en-US/en-GB/zh-CN/zh-HK/zh-TW.
   archive/page.tsx: real empty branch for days.length === 0 (warm card + play-today CTA),
   was an unguarded empty <ul> grid.
C. globals.css: .numeral token appended after .tnum (mono + tabular; EXTENDED, not rewritten).
   console-chrome.tsx: ConsoleStat value gets .numeral; STAT_TONES.streak -> text-accent-warm.
   stats/page.tsx: streak/best values get .numeral; streak chip + Flame icon -> accent-warm.
D. result-card-render.ts: bg 0a0f1c -> 0e1226 (ink), text f8fafc -> faf6ef (warm paper),
   textMuted -> rgba(250,246,239,0.62), wordmark + game title in DISPLAY_FONT_FAMILY
   (Space Grotesk first in stack). Model untouched - no-spoiler guarantee is code-identical.

### IN FLIGHT / NEXT
1. git add/commit/push s3/richness-1 (last attempt hit host EMFILE during git add -A; retry,
   staged explicitly by path if it persists)  <- HERE
2. bun run typecheck + bun run test:unit (result-card-render.test.ts is the no-spoiler gate)
3. build (bun run build) - check for a sibling build first
4. notes/screenshots before/after via apps/puzzled/scripts/redesign-shots.ts pattern;
   RESTART dev server before shots (stale HMR after checkout is a real incident)
5. final push + report
