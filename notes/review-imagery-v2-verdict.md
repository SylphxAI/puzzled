# Review verdict — feat/imagery-v2 (PR #185, SylphxAI/puzzled)

Reviewer: independent verifier subagent. Branch under review feat/imagery-v2 @ 9ae09fb77013ea7d15752d50d82ef7ca2b2fab5d
(== PR #185 headRefOid, non-draft, OPEN). Base origin/main 7dd8e93. All reads/screenshots below are from THIS
worktree at that head; live/outbound checks labelled UNVERIFIED where not reproducible offline.

Status: IN PROGRESS — verdict PENDING.

## Claims to verify (author claims are CLAIMS; each reproduced below)
1. Ancestry/scope: 5 commits on base 7dd8e93; no edits outside apps/puzzled/** and notes/**.
2. Icons: every src/games/*/icon.tsx is a thin wrapper over GAME_ICON_ART (src/shared/components/ui/game-icon.tsx); 19 icons; no <text>; aria-hidden + size contract.
3. Banned-title fix (28d95e3): art referenced by property; no banned title literals in copy surfaces.
4. OG cards: search-param API unchanged; theme keys match theme-colors.ts; font read optional; licence present.
5. Favicons: script parses public/brand/mark.svg (no private gradient copy); 14 regenerated PNGs newer; manifest paths resolve.
6. mark.tsx tones (tile/inverse/mono) match SVGs' intent; valid props.
7. Pixel checks: mark-after ink ground + amber piece; icon-sheet-after != before; og-after ink ground.
8. Gates: typecheck, biome, tests (claim 1214/6/5, 5 pre-existing).

## Evidence log (reproduced facts)
### 1. Ancestry & scope — PASS (evidence)
- git merge-base --is-ancestor 7dd8e93 3a2e979 -> YES; parent(3a2e979) = 7dd8e939c6a0e33aa898a2014af76c0321fb7e86 == origin/main tip.
- 50 files changed 7dd8e93..9ae09fb, all under apps/puzzled/** (45) and notes/** (7): 2 brand SVGs + favicon/apple-touch PNGs at public root, 13 PNGs under public/icons/, 3 font files (OFL.txt, README.md, space-grotesk-700.ttf), scripts/generate-brand-icons.ts, src/app/[locale]/og/route.tsx, 19 games/*/icon.tsx, src/shared/components/brand/mark.tsx, new src/shared/components/ui/game-icon.tsx, notes/imagery-v2-progress.md, 6 notes/screenshots PNGs.
- No stray edits outside the two allowed trees.

### 2. Icon system — TODO
### 3. Banned-title fix — TODO
### 4. OG cards — TODO
### 5. Favicons — TODO
### 6. mark.tsx tones — TODO
### 7. Pixel checks — TODO
### 8. Gates — TODO

## Verdict: PENDING

## Evidence (round 2, all reproduced at head 9ae09fb)
### 2. Icon system — PASS
- 19 wrappers src/games/*/icon.tsx, each 8 lines, thin: `import { createGameIcon, GAME_ICON_ART } ...` + `createGameIcon(GAME_ICON_ART.<slug>)`.
- game-icon.tsx (237 lines): GAME_ICON_ART has exactly 19 keys matching the 19 folders; ShapeStyle/ART vocabulary (2px round-cap strokes, thin=1px @35%, one accent via text-accent-warm, dash for killer cage).
- Factory contract preserved: GameIconProps = SVGProps<SVGSVGElement> & { size?: number }; size default 24; viewBox 0 0 24 24; aria-hidden="true" default that callers may override via spread; className passthrough; other SVG props spread.
- NO <text> in any icon wrapper, game-icon.tsx or mark.tsx (grep).
- bun test src/games/module-conformance.test.ts src/games/registry.test.ts -> 21 pass, 4 skip, 0 fail.

### 3. Banned-title fix 28d95e3 — PASS
- Diff: 19 wrappers 2+/2- (createGameIcon('queens') -> createGameIcon(GAME_ICON_ART.queens) etc.) + game-icon.tsx comment/type tightening. No allowlist additions.
- git grep "createGameIcon('" / createGameIcon(" -> no matches (rc=1).
- Corpus oracle src/lib/player-facing-identity.test.ts (CATALOG SS3.2 marks; scans TSX copy under src/app|features|games|shared + messages + manifest + configs + data): 6 pass / 0 fail at head, including "contains no CATALOG SS3.2 publisher marks".
- ALLOWED_INTERNAL unchanged (3 achievement ids only); ALLOWED_GENERIC TANGO entry is pre-existing (word-groups bank).

### 4. OG cards — PASS
- src/app/[locale]/og/route.tsx (169 lines): search params title/subtitle/eyebrow/badge/theme unchanged, all clamped; defaults Puzzled / Free puzzle every day.
- THEMES keys == the 11 GameColorTheme members in src/games/theme-colors.ts (violet emerald cyan amber pink rose blue sky orange lime slate) + DEFAULT_THEME warm pair.
- Font read optional: try/catch -> cachedFont=null; fontFamily falls back to Inter,sans-serif; fonts: [] when null. Rendering cannot fail on a missing font.
- Licence: public/fonts/OFL.txt (4.5 KB, SIL OFL 1.1 per README.md) next to vendored public/fonts/space-grotesk-700.ttf (69308 B).

### 5. Favicons — PASS (claim-accuracy note)
- scripts/generate-brand-icons.ts parses public/brand/mark.svg (readMark: ground = 512x512 rect, exactly 4 tiles, throws otherwise; fills taken from the SVG) -> no private gradient copy.
- Renderer fallback rsvg-convert -> ImageMagick -> chromium, each with hard timeout.
- 15 PNG outputs regenerated in commit 3a2e979 (13 under public/icons/ + favicon.png + apple-touch-icon.png at public root); no later commit re-touched them (git diff 3a2e979..HEAD -- public/icons public/brand empty).
- NOTE: brief says "14 regenerated PNGs in public/icons"; actual count under public/icons/ is 13 (all 13 changed; none left stale). Non-blocking count discrepancy.
- manifest.webmanifest icon paths (/icons/icon-{48,72,96,128,144,152,192,384,512}.png + maskable-512 + shortcut icon-96) all exist and all changed on the branch.

### 6. mark.tsx tones — PASS (with geometry note)
- 97 lines; tile = ink container + 3 paper + 1 amber piece (matches mark.svg intent); mono = currentColor pieces with the 4th hollowed (stroke, fill none; matches mark-mono.svg intent); inverse = pieces only for ink backgrounds.
- Renders valid SVG props for all tones (rect x/y/width/height/rx + fill or stroke); decorative default aria-hidden with role=img/aria-label when not.
- NOTE: "mirrors mark.svg" is intent-level, not geometric: app pieces 11/26 = 42% coverage vs SVG 156/512 = 30.5%; radius ratio matches (3.2/11 ~ 44/156 = 0.28). Non-blocking.

### 7. Pixel checks — PASS (ImageMagick on committed blobs)
- mark-after.png 2360x1600: ink #0E1226 = 859,337 px; paper #FAF6EF = 825,138 px; amber #FBBF24 = 9,446 px.
- og-after.png 1200x630: ink #0E1226 dominant (489,518 px); amber #FBBF24 = 15,099 px.
- icon-sheet-after.png differs from before (md5 1602fb1... vs 01f1705...); after histogram shows amber-family accent (#FB923C 15,182 px) vs before's grays.
- md5 of worktree files == md5 of git blobs for mark-after, og-after, icon-sheet-before, icon-sheet-after (screenshots are the committed artifacts).

### 8. Gates — PENDING (running now)
