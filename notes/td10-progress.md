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
### 1-2 verify (2026-09-21 04:40) - dead set proven on post-#169 main
- Re-enumerated on merged tree: 114 defs / 68 files / 107 unique names (register 115 @e590b5c; one def `_localeFormats` removed by an earlier PR -> 114; 0 drift from #169).
- Per-name grep matrix on the merged tree is identical to the first run: 72 dead (exactly 1 occurrence = its definition line, bare name 0 everywhere), 35 retained.
- Single-occurrence line == definition line for all 72 dead (0 misses). No excluded-path defs in the delete set.
- Delete list: notes/td10/delete-list.tsv (72 defs / 49 files). Out-of-scope: 4 defs in src/lib/i18n/config.ts.
- Wide-pattern extras (let/nested) scanned separately; `_totalWinsToday` also looks dead (out of register scope) -> notes/td10/wide-scan-extras.tsv.
- Next: delete the 72 via notes/td10/delete-dead-defs.ts, then run gates.
