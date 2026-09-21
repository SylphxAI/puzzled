# TD-15 progress - one difficulty vocabulary

STATUS: recon - base b199007999789d862ac236b94ba010b1c3ff18e1 (origin/main, TD-01 #170)
BRANCH: debt/td15-difficulty-vocab
WORKTREE: /data/sylphx/home/workspace/.worktrees/github.com/SylphxAI/puzzled/td15
REGISTER: /data/sylphx/home/work/pz-program/notes/tech-debt-register.md row TD-15 (line 54)

## Next action
1. wire node_modules for this worktree (symlink from canonical clone apps/puzzled), confirm bun runs
2. capture resolved-catalogue BEFORE dump into scratch dir /data/sylphx/home/work/pz-program/td15/
3. write notes/td15-before.md (exact shape counts + consumer map, file:line)
4. implement: helper src/lib/i18n/difficulty.ts + common.json keys + consumers + tests
5. proof: compare before/after + sha256 per locale; suite/typecheck/biome/build
6. mutation: swap DIFFICULTY_LEVELS -> mapping test red; restore green
7. PR: one Ready PR, body carries before/after map + proof + mutation + status

## Facts
- repo SylphxAI/puzzled; app at apps/puzzled; locales en-US(en base) en-GB(overlay) zh-HK(zh base) zh-TW(overlay) zh-CN
- off-limits: src/games/*/translations/** , atlas/**, .github/**, src/lib/seo/**, other legs files
- siblings in flight: td10 (underscore dead code - may delete _ConnectionsHowToPlayTitle from word-groups how-to-play.tsx), td16 (messages guard), td17 (generation scripts)
- env: every git/gh command with env -u GH_TOKEN -u GITHUB_TOKEN prefix
- proof tool: apps/puzzled/scripts/i18n-resolved-catalogue.ts (dump/compare/parity) - TD-01 helper
