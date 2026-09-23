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
