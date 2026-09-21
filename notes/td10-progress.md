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

### 0b respawn (2026-09-21 04:37) - fresh base
- Predecessor killed by EACCES wave after setup; enumeration+verify artifacts preserved in host notes dir and reused here.
- origin/main moved: 976210e -> d6a5f5616e (#169 admin audit; 14 files; 1 overlap with td10 scope: apps/puzzled/src/lib/audit/index.ts).
- Branch brought onto fresh main WITHOUT force-push: merge commit f4c921c keeps pre-#169 notes ref 0e44b5b as a parent (same technique as td01's 26ddd42); push was a fast-forward 0e44b5b..f4c921c.
- Next: re-run per-name verification on this merged tree, then delete proven-dead defs.
