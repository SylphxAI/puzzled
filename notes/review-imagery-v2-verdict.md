# Review verdict — feat/imagery-v2 (PR #185, SylphxAI/puzzled)

Reviewer: independent verifier subagent. Own worktree: .worktrees/github.com/SylphxAI/puzzled/review-imagery-v2,
branch review/imagery-v2. Head reviewed: 9ae09fb77013ea7d15752d50d82ef7ca2b2fab5d (= PR #185 headRefOid, OPEN,
non-draft). Base: origin/main 7dd8e93. All evidence below reproduced locally at the head; the author's worktree
(.worktrees/.../imagery-v2) and branch were never touched (feat/imagery-v2 still at 9ae09fb on origin).

## Verdict: PASS — no blockers. 4 non-blocking notes (N1-N4).

### 1. Ancestry & scope — PASS
- git merge-base --is-ancestor 7dd8e93 3a2e979 -> YES; 3a2e979^ = 7dd8e939c6a0e33aa898a2014af76c0321fb7e86 (exact base).
- 5 commits on base: 3a2e979, 65815a8, 9ea7196, 28d95e3, 9ae09fb. 50 files changed, ALL under apps/puzzled/** (43)
  and notes/** (7). No stray edit outside the two allowed trees.

### 2. Icon system — PASS
- 19 wrappers src/games/*/icon.tsx, each 8 lines, thin: import createGameIcon + GAME_ICON_ART; body is
  createGameIcon(GAME_ICON_ART.<slug>). Art in src/shared/components/ui/game-icon.tsx (237 lines) with exactly
  19 keys (count matched folder set).
- No <text> anywhere in wrappers, game-icon.tsx or mark.tsx (grep).
- Contract preserved: GameIconProps = SVGProps<SVGSVGElement> + size?: number; size default 24; viewBox 0 0 24 24;
  currentColor stroke, round caps; aria-hidden="true" default overridable by caller spread; className passthrough.
- Vocabulary: 2px strokes, thin=1px at 35% opacity, one warm accent detail per icon via text-accent-warm, dash helper.
- Tests: bun test src/games/module-conformance.test.ts src/games/registry.test.ts -> 21 pass, 4 skip, 0 fail.

### 3. Banned-title fix 28d95e3 — PASS (fix proven load-bearing)
- Diff: 19 wrappers 2+/2- (createGameIcon('queens') -> createGameIcon(GAME_ICON_ART.queens) etc.) + game-icon.tsx
  comment/type tweaks. No allowlist added.
- No string-arg createGameIcon calls remain (git grep, rc=1).
- Corpus oracle apps/puzzled/src/lib/player-facing-identity.test.ts (CATALOG SS3.2 marks; scans TSX copy under
  src/app|features|games|shared, messages, translations, manifest, configs, puzzles data, achievements):
  at head -> 6 pass / 0 fail, incl. "contains no CATALOG §3.2 publisher marks".
  Proof of necessity: same suite run in a detached worktree at pre-fix 9ea7196 -> 5 pass / 1 FAIL
  ("contains no CATALOG §3.2 publisher marks"). The only non-doc change between 9ea7196 and head is 28d95e3.
- ALLOWED_INTERNAL unchanged (3 gamification ids); ALLOWED_GENERIC TANGO entry pre-existing.

### 4. OG cards — PASS
- src/app/[locale]/og/route.tsx (169 lines): same five search params as base (title/subtitle/eyebrow/badge/theme);
  clamped, defaults 'Puzzled' / 'Free puzzle every day'. THEMES keys == the 11 GameColorTheme members in
  src/games/theme-colors.ts (violet emerald cyan amber pink rose blue sky orange lime slate) + warm DEFAULT_THEME.
- Ink ground #0e1226, paper #faf6ef, amber #fbbf24; inline 4-tile mark (3 paper + amber) matching mark.tsx geometry.
- Font: public/fonts/space-grotesk-700.ttf (69308 B) read in try/catch; on failure font null -> fontFamily falls back
  to Inter,sans-serif and fonts: [] — route cannot fail on a missing font (code read + logic).
- Licence: public/fonts/OFL.txt (SIL OFL 1.1, README.md documents provenance) present next to the TTF.

### 5. Favicons — PASS (N1 count note)
- scripts/generate-brand-icons.ts parses public/brand/mark.svg (readMark: 512x512 ground rect + exactly 4 tiles
  required, throws otherwise; all fills taken from the SVG). No private gradient copy remains.
- Renderer order rsvg-convert -> ImageMagick -> headless chromium, each one attempt with 45s timeout.
- All 15 PNG outputs regenerated in 3a2e979: 13 under public/icons/ + public/favicon.png + public/apple-touch-icon.png;
  no later commit re-touched them (diff 3a2e979..HEAD -- public/icons public/brand empty).
- manifest.webmanifest icon paths (/icons/icon-{48,72,96,128,144,152,192,384,512}.png, maskable-512, shortcut
  icon-96) all exist on disk and all changed on the branch.
- N1 (claim accuracy): brief says "14 regenerated PNGs in public/icons"; actual = 13 files under public/icons/
  (all 13 changed, none stale) + 2 at public root = 15 total. Off-by-one in the brief/author note, artifact correct.

### 6. mark.tsx tones — PASS (N2 geometry note)
- 97 lines. tile = ink container + 3 paper + 1 amber piece (matches mark.svg); mono = currentColor pieces with the
  4th hollowed (fill none + stroke; matches mark-mono.svg); inverse = pieces only for ink backgrounds.
- Valid SVG props for all tones (rect x/y/width/height/rx + fill or stroke); decorative default aria-hidden with
  role=img/aria-label when decorative=false. Logic read; typecheck clean.
- N2: "mirrors mark.svg" is intent-level, not geometric: app piece coverage 11/26 = 42% vs SVG 156/512 = 30.5%
  (radius ratio matches: 3.2/11 ~ 44/156). Composition and colour logic match.

### 7. Pixel checks — PASS (ImageMagick 6, on committed blobs)
- notes/screenshots/mark-after.png (2360x1600): ink #0E1226 = 859,337 px; paper #FAF6EF = 825,138; amber #FBBF24 = 9,446.
- notes/screenshots/og-after.png (1200x630): ink #0E1226 dominant (489,518 px); amber #FBBF24 = 15,099.
- icon-sheet-after.png differs from before (md5 1602fb1... vs 01f1705...); after histogram adds amber-family accent
  (#FB923C 15,182 px) where before had grays.
- md5 of all four reviewed worktree files == md5 of their git blobs (screenshots are the committed artifacts).

### 8. Gates — PASS (one scope note, N3)
- bun run typecheck (tsc --noEmit + e2e tsconfig, apps/puzzled) -> exit 0.
- bun run test (apps/puzzled) -> 1214 pass / 6 skip / 5 fail across 1225 tests/129 files — exactly the claim.
  The 5: 4x getBaseUrl/getServerBaseUrl (src/lib/utils.test.ts) + 1 schema/migration parity.
  Reproduced the same 4 getBaseUrl failures on the canonical clone at main ad89b83 (16 pass / 4 fail);
  schema-parity shells out to scripts/check-schema-parity.sh whose exit 2 = "gate could not run (no Atlas, no dev
  database)" (needs a dev Postgres/migrator here) — environmental, as claimed.
- Biome: scope-dependent (N3): bunx biome check . at worktree ROOT reports 93 errors / 4 warnings / 38 infos, but all
  93 errors are pre-existing and outside the diff — 91 in packages/ui/**, 2 in fixtures/** (branch diff touches
  neither; packages/ui error reproduces on the canonical clone at main ad89b83). Scoped to the branch-changed
  TS/TSX files -> clean (3 infos, incl. the template-literal suggestion the author noted); scoped to apps/puzzled
  (the CI lint scope, turbo lint -> biome check .) -> 0 errors, 26 infos.
- N3 is therefore a scope note: the literal command in the brief (root-scope) is red before this branch too; the
  branch introduces no biome finding.

### Non-blocking notes recap
- N1: public/icons count is 13 (not 14); 15 including public root; nothing stale.
- N2: mark.tsx mirrors mark.svg at intent level; geometry proportions differ.
- N3: root-scope biome errors are pre-existing (packages/ui, fixtures), outside the diff; app scope clean.
- N4: NOT run / out of scope for this offline review: bun run build (author claims pass), and any live/edge checks
  (served OG card, manifest over HTTP, deploy state) — UNVERIFIED by the reviewer. No dev server was started;
  NODE_ENV set for tests came from default env. Node/bun: bun 1.4.2.

### Limits
- Reviewer budget: ~30 tool calls, bounded commands. Reads are from the fetched head 9ae09fb; nothing was merged,
  enqueued, or pushed to the author's branch (verified: origin/feat/imagery-v2 == 9ae09fb after review).
