# S3 richness-1 rebase onto post-#184 main — progress

Task: rebase s3/richness-1 (3b72b5d, d3bbf5e; base 7dd8e93) onto origin/main (7f39148, PR #184 merged),
resolve conflicts faithfully, prove gates, push (force-with-lease), open ONE PR.
Worktree: /data/sylphx/home/work/pz-s3-rebase — local branch s3/richness-1-rebase; pushes to origin
refs/heads/s3/richness-1 (local branch s3/richness-1 stays checked out in the authoring worktree — not touched).

## Steps
- [x] fetch origin; worktree created from origin/s3/richness-1 (detached d3bbf5e)
- [x] skeleton committed & pushed
- [x] rebase onto origin/main — completed; result 657dfb8 (feat) + 6976394 (docs/evidence) + skeleton commits
- [ ] gates: bun install / typecheck / test / biome (changed files) / build
- [ ] screenshots retake (old after shots are pre-skin; main's #184 copies currently in tree)
- [ ] push force-with-lease + gh pr create

## Rebase decisions (recorded calls)
1. notes/screenshots/*.png: add/add conflicts (both #184 and S3 added the same 8 paths). Resolved to
   #184's copies — S3's are pre-skin renders and stale per the task; new post-skin before/after to be
   retaken and committed in this PR (if retake impossible, PR body states it).
2. apps/puzzled/src/app/globals.css: the replay left TWO .numeral blocks (S3's appended one + #184's at
   ~1539). #184's is RICHER (also sets letter-spacing: -0.01em). Kept ONE — #184's; dropped S3's block.
   globals.css now matches main.
3. stats/page.tsx: auto-merged cleanly, both intents present — text-amber-800 (line 167, #184 a11y fix)
   and S3's accent-warm chip/Flame + `tnum numeral` on streak/best (lines 343/351). Verified by grep.
4. difficulty-selection-view.tsx / milestone-rings.tsx: S3 had no edits; main's amber-800 versions kept.
5. theme-colors.ts / game-tile.tsx / result-card-render.ts / archive/page.tsx / message catalogues:
   auto-merged cleanly; diffs vs main show only S3's additions.
6. Token check: --color-accent-warm exists on main (globals.css:135 light, :246 dark) — S3's classes valid.

## Next action
- run gates (bun install / typecheck / test / biome / build), then screenshots, push, gh pr create.

## 2026-09-23 05:0x-05:2x BST — parent finished the lane after it stalled twice
- History: this lane died once on a host EACCES incident (fixed: agents/main/agent dir 0700->0755), was resumed,
  and then stalled again mid-screenshot-retake (no writes after ~04:44). Parent finished the bounded remainder in-session.
- [x] lint: `bun run lint` (apps/puzzled) exit 0, 26 infos, 0 errors — after fixing a biome format error in scripts/s3-shots.ts.
- [x] typecheck: `bun run typecheck` (turbo) = 2 successful.
- [x] test: `bun run test` — result appended below.
- [x] screenshots: complete 8-file matrix retaken; before = clean worktree at main tip 561b132 (fullPage, home + /games,
  desktop+mobile x light+dark) via apps/puzzled/scripts/s3-shots.ts; after = this branch (same matrix). The previous
  mobile before pair was viewport-only (390x844) and inconsistent — replaced.
- [x] push + PR: appended below (PR url).
- Gates verbatim: lint exit 0 (26 infos, 0 errors); typecheck 2 successful; test 1214 pass / 6 skip / 5 fail (all 5 pre-existing: 4x getBaseUrl + schema/migration parity).
- Pixel diffs (desktop, final sets): home-light 13,325; games-light 45,838; home-dark 15,254; games-dark 51,338.
- FINAL evidence: all 16 shots retaken with one script (networkidle + lazy-scroll + fullPage) at 05:1x BST; after set replaced
  (the 04:44 set was captured under different conditions — inconsistent totals). Final pixel diffs (AE):
  desktop home-light 11,481 / games-light 44,795 / home-dark 11,671 / games-dark 46,144;
  mobile home-light 10,992 / games-light 33,786 / home-dark 11,042 / games-dark 34,144.

- PR: https://github.com/SylphxAI/puzzled/pull/186 (opened 05:2x BST; awaiting independent review).

## 2026-09-23 05:5x-06:1x BST — R1 (reviewer's hover check) resolved; root cause found
- R1 confirmed: tile carried both `hover:shadow-lift` (shell) and the per-hue glow shadow — lift won and the glow shadow never painted
  (probe: computed box-shadow on hover was the lift value; glow shadow absent).
- Fix 1: removed `hover:shadow-lift` from GameTile; fallback themes keep it via `DEFAULT_GAME_COLORS.glow`. Verified: hover shadow
  becomes `rgba(<hue>,0.45) 0px 8px 24px -6px`.
- Fix 2 (root cause found): the hover BORDER was dead too, and not by accident — `apps/puzzled/src/app/globals.css:358-360` carries an
  UNLAYERED `* { border-color: var(--color-border) }`. Unlayered CSS beats every layered Tailwind utility (cascade layers), so ALL
  `border-*` / `hover:border-*` colour utilities have been silently dead app-wide (pre-existing on main). Reproduced: the same selector
  works in a minimal page without that rule; not on /games (CDP matched rules show the `*` rule winning past the hover rule).
- Contained fix here: glow's `hover:border-<hue>-500/60` → `hover:ring-2 hover:ring-<hue>-500/60` (rings ride the box-shadow chain,
  unaffected by the `*` rule). Root-cause fix (move the `*` rule into `@layer base`) = app-wide visual change → separate follow-up.
- Evidence tool committed: apps/puzzled/scripts/s3-hover-probe.ts — exit 0; prints hovered/boxShadow/hasGlowShadow/hasRing/ok.
