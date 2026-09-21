# TD-20 - logger seam

Branch `debt/td20-logger-seam` @ base origin/main `b199007999789d862ac236b94ba010b1c3ff18e1` (fresh fetch 2026-09-21).
Worktree: `/data/sylphx/home/workspace/.worktrees/github.com/SylphxAI/puzzled/td-20`.

## Next action
Watch CI to 9/9 on PR #176; then report.

## Status
- [x] worktree/branch off fetched origin/main
- [x] recon: 42 non-test `console.*` across 19 files (matches register); +10 hits in 2 test files (spy/silencers, kept)
- [x] `apps/puzzled/src/lib/logger.ts` + `apps/puzzled/src/lib/logger.test.ts` (8/8 unit tests green; commit feda3e4)
- [x] migrate server sites: generator.ts (11), unsubscribe route (7), env.ts (4), page.tsx (3), report-boundary-error.ts (1), redis.ts (1), audit/index.ts (1), api/server.ts (1), admin-api.ts (1), api/admin/models/route.ts (1), validators/connections.ts (1)
- [x] migrate client sites: session-replay-provider.tsx (2), game-play-area.tsx (2), use-game-session.ts (1), global-error-handler.tsx (1), global-error.tsx (1), pricing-client.tsx (1), game-daily-fallback.tsx (1), notification-preferences.tsx (1 JSDoc)
- [x] mutation proof: redaction broken -> RED (expected "[redacted]", received "member@example.com"); restored -> GREEN 8/8 - notes/td20-mutation.md
- [x] census evidence: notes/td20-before.md (52 -> 10 raw; 42 production sites -> 0)
- [x] prove: merged-tree gates all green (suite 1159/6/0; typecheck rc=0; biome rc=0; build rc=0) - notes/td20-proof.md
- [x] merged origin/main (fd9f061) cleanly except generator.ts dead-block (TD-10 deletion kept) - ba611f2
- [x] PR open: https://github.com/SylphxAI/puzzled/pull/176 (head 332ff57)
- [ ] CI green (watching)
- [ ] PR

## Deliberate exclusions
- `packages/ui/src/components/toast.tsx:210` - outside touch limits (apps/puzzled/src/**); packages/ui is TD-12 territory.
- Test files (10 hits): console silencers/spies; the seam maps info->console.log and debug->console.debug so existing silences keep holding.

## Push recipe (explicit refspec, no force)
`env -u GH_TOKEN -u GITHUB_TOKEN git push origin HEAD:refs/heads/debt/td20-logger-seam`