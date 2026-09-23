# Imagery v2 — final state (2026-09-23)

Branch `feat/imagery-v2` (worktree
`/data/sylphx/home/workspace/.worktrees/github.com/SylphxAI/puzzled/imagery-v2`)
— pushed, no PR opened (imagery lane only, per the brief).

## Delivered
- **A. Brand mark v2** — `public/brand/mark.svg` (midnight ink ground, three warm
  paper tiles, the fourth lit amber) and `public/brand/mark-mono.svg` (single
  `currentColor`, fourth tile hollow). `src/shared/components/brand/mark.tsx`
  mirrors it (tones: tile / inverse / mono).
- **B. One game-icon language** for all 19 games: 24px grid, 2px round-cap
  `currentColor` strokes, 1px construction lines at 35%, and exactly one warm
  accent detail per icon painted with `text-accent-warm`. Art lives in
  `src/shared/components/ui/game-icon.tsx` (GAME_ICON_ART); each
  `src/games/*/icon.tsx` is a three-line wrapper. The sudoku `<text>` glyphs are
  gone (no glyphs anywhere in the set).
- **C. OG cards** — `src/app/[locale]/og/route.tsx` wears the skin (ink ground,
  warm paper text, amber badge, mark tile with a warm rim). Search-param API
  unchanged (`title/subtitle/eyebrow/badge/theme`); theme keys still match
  `src/games/theme-colors.ts` but resolve to ink-tuned glow hues, default =
  brand warm. Title uses **Space Grotesk 700**, vendored at
  `public/fonts/space-grotesk-700.ttf` (OFL, see `public/fonts/OFL.txt`) because
  next/og (satori) parses TTF/OTF/WOFF and next/font only emits WOFF2; the read
  is optional, so a missing file falls back to the built-in sans.
- **D. Favicons/app icons** — `scripts/generate-brand-icons.ts` now parses
  `public/brand/mark.svg` (it used to carry its own copy of the old indigo
  gradient), emits absolute-coordinate SVG, and rasterises with
  rsvg-convert → ImageMagick → headless Chromium (one attempt each, 45s timeout:
  the browser is what wedged before). All 14 PNGs + `favicon.png` +
  apple-touch regenerated; `manifest.webmanifest` paths unchanged and valid.
- **Preview sheets** in `notes/screenshots/`: `icon-sheet-before.png` /
  `icon-sheet-after.png`, `mark-before.png` / `mark-after.png`,
  `og-before.png` / `og-after.png` (1200x630), rendered by
  `bun run scripts/imagery-preview.tsx --shots` (Playwright, system Chromium,
  `deviceScaleFactor: 2`). The "before" side is read from `scripts/.before-art`
  + `scripts/.before-icons` + `scripts/_og-before.tsx`, extracted with
  `git show origin/main:<path>` and deleted before committing.

## Gates (worktree, HEAD)
- `bunx biome check --write <changed>` — clean (1 info: a suggested template
  literal in the generator, not applied because it is an unsafe fix).
- `bun run typecheck` (tsc + e2e tsconfig) — pass.
- `bun run test` — result recorded below; the two non-imagery failures are
  environmental/pre-existing (see below).
- `bun run build` — compiles and type-checks; route table prints (standalone).

## Known non-imagery test failures (not from this lane)
- `getBaseUrl` / `getServerBaseUrl` (4) — fail on a clean main checkout too
  (verified in the canonical clone at ad89b83).
- `schema/migration parity` — needs the migrator/DB, absent here.
- The corpus suite `player-facing mark corpus` DID fail on this branch first:
  my wrappers passed `queens` / `tango` as string literals, and CATALOG §3.2
  bans those third-party titles in copy surfaces. Fixed by referencing art by
  property (`GAME_ICON_ART.queens`) instead of a slug string; the suite is
  green again.

## Next actions for the next run
1. Review the six preview sheets first; nothing else needs re-running to
   review. Re-run them with `bun run scripts/imagery-preview.tsx --shots`
   after re-extracting the before-art (commands are in that script header).
2. Landing is a separate lane: this branch is pushed with no PR. If it is
   rebased onto `feat/redesign-atmosphere` (PR #184), no conflicts are expected
   — that PR owns `globals.css` / `nav-items.ts`, which this lane never touched.
3. Optional polish: pass `-depth 8` to the ImageMagick raster path (the
   committed PNGs are 16-bit per channel and larger than needed).
4. Optional: the icon accent relies on `--color-accent-warm`; both main and
   PR #184 define it, so no action unless the token is renamed.
