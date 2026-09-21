# TD-10 dead private defs - progress (branch debt/td10-dead-private-defs)

Recovery log, kept current. Started 2026-09-21 ~03:42 Europe/London.
- Worktree: /data/sylphx/home/workspace/.worktrees/github.com/SylphxAI/puzzled/td-10
- Base: origin/main = 976210e950a3681828a8aa7fa1b754a68846d401 (fresh fetch 03:41)
- Scratch mirror: /data/sylphx/home/work/pz-program/notes/td10-progress.md
- Host: NODE_ENV=production exported; tests: env -u NODE_ENV bun test src (from apps/puzzled).
- Exclusions (no deletions): src/messages/**, src/lib/i18n/**, src/games/*/translations/**, .github/**; avoid scripts/ (td01 leg). Concurrent: #153, #169, debt/td01.

## Steps
- [x] 0. worktree created (HEAD 976210e)
- [ ] 1. enumerate
- [ ] 2. verify dead
- [ ] 3. delete
- [ ] 4. prove
- [ ] 5. PR

## Evidence log
### 0 setup
- git worktree add rc=0; HEAD 976210e == origin/main.
