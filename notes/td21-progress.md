# TD-21 share helper - progress (branch debt/td21-share-helper)

Worktree: $HOME/workspace/.worktrees/github.com/SylphxAI/puzzled/td-21
Base: origin/main = b199007 (fetched 2026-09-21). bun install --frozen-lockfile: 554 packages, 3.16s.

## Steps
1. [x] Recon: 20 share sites enumerated with literals + mechanics (notes/td21-before.md). TD-02 resolver located. Drift: crossword Crossword Mini -> Mini Grid.
2. [ ] Implement: features/daily/lib/result-share.ts (pure core) + features/daily/hooks/use-result-share.ts (hook); convert 19 game files + already-completed-view; game-result.tsx card name.
3. [ ] Tests: resolver + per-module pins + decision table + converted-site scan guard; before/after identity matrix.
4. [ ] Mutation proof: break the name resolution -> RED; restore -> GREEN.
5. [ ] Gates: full bun test, tsc, biome, next build; quote totals.
6. [ ] PR (single, titled TD-21).

## Next action
Write the two new files, then convert crossword (template site) and run the pinning tests.

