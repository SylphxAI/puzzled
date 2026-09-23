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
