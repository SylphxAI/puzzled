# TD-21 share helper - progress (branch debt/td21-share-helper)

Worktree: $HOME/workspace/.worktrees/github.com/SylphxAI/puzzled/td-21
Base: origin/main = b199007 (fetched 2026-09-21). bun install --frozen-lockfile: 554 packages, 3.16s.

## Steps
1. [x] Recon: 20 share sites enumerated with literals + mechanics (notes/td21-before.md). TD-02 resolver located. Drift: crossword Crossword Mini -> Mini Grid.
2. [x] Implemented: features/daily/lib/result-share.ts + features/daily/hooks/use-result-share.ts; 20 sites converted (19 games + already-completed-view); game-result.tsx card name via resolver.
3. [x] Tests: result-share.test.ts (resolver + 19 pinned texts + before/after matrix + decision table) + games/shared/result-share-wiring.test.ts (site scan) + share-deep-link-call-sites.test.ts rewritten to the TD-21 architecture.
4. [x] Mutation proof: name resolution -> raw camel key: RED (6 pass / 7 fail; e.g. Received: "sudoku"); restored byte-identical (md5 ad3cdd7af2ad1a609c8a0ace703e3dbc), GREEN 13/0. Raw logs: notes/td21-mutation-red.txt / -green.txt.
5. [x] Gates green: unit suite 1164 pass / 6 skip / 0 fail (1170 tests, 119 files); turbo typecheck 2/2; turbo lint green; next build Compiled successfully (build_exit=0; log /tmp/td21-build.txt).
6. [ ] PR (single, titled TD-21).
## Next action
Open the PR (body drafted from notes/td21-before.md + gates), then report.


