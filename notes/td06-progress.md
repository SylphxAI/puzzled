# TD-06 admin access audit - progress (branch debt/td06-admin-audit)

Recovery log, kept current. Started 2026-09-21 ~02:35 Europe/London.
- Worktree: /data/sylphx/home/workspace/.worktrees/github.com/SylphxAI/puzzled/td06-audit
- Base: origin/main = 7523ba9ef74eb80567a44b033b02394f91cf28a0 (fresh fetch 02:35; same as 01:36)
- Host: NODE_ENV=production exported; run tests as: env -u NODE_ENV bun test PATH (from apps/puzzled). Host bun 1.4.2; CI pins 1.4.0.
- Scratch mirror: /data/sylphx/home/work/pz-program/notes/td06-progress.md

## Recon findings
- admin-api.ts: logAdminAccess (lines 71-88) = console.warn + redis.setex('admin-audit:...', 30d). Call sites: 106, 111, 116, 136.
- lib/audit/index.ts: private logAuditEvent (lazy db load; ip/userAgent from next/headers; internal try/catch). Exported logAdminAction has zero callers today.
- Enum: src/lib/db/schema.ts line 45 auditActionEnum; baseline: CREATE TYPE "public"."audit_action" AS ENUM(7 values).
- UI: audit-log-filters.tsx ACTION_TYPES (line 22); audit-log-table renders t('actions.' + action). Messages: src/messages/<locale>/admin.json section auditLogs.actions (5 locales).
- CI: lint = biome check . (apps/puzzled); typecheck = turbo typecheck; unit = bun test; migrations job = atlas migrate hash --dir file://apps/puzzled/atlas/migrations (fails if atlas.sum stale / .sql uncommitted).
- PR #165 (TD-05) OPEN, not merged; it edits admin-api.ts top-of-file block + env reads (~108-120) and lib/env.ts. Decision: my admin-api edit lives strictly in the logAdminAccess body; the audit fn is pulled in with an inline await load inside that function so the top-of-file block stays byte-identical (repo idiom: lib/identity/server.ts:86, lib/audit/index.ts:21).

## Steps
- [x] A. enum + migration + atlas.sum (commit 451961c; pushed)
- [x] B. lib/audit: logAdminAccessAttempt + unit test (2 pass)
- [x] C. admin-api: logAdminAccess switch + caller test (3 pass)
- [x] D. messages x5 locales + filters ACTION_TYPES += admin_access (filter list line 30; admin_access in auditLogs.actions of all 5 locales)
- [x] E. full suite + typecheck + lint - all green (see ### E and ### E2)
- [x] F. mutation proof F1+F2 - red -> restore -> green (see ### F)
- [x] G. PR opened: https://github.com/SylphxAI/puzzled/pull/169
- Head: 03203da; final notes push follows (last push from this run).
- [x] env: worktree node_modules was incomplete (killed sibling run); bun install --frozen-lockfile rc=0 (257 packages, lefthook synced); pre-commit hooks pass (biome + tsc 12.2s).

## Evidence log
### A (enum + migration)
- schema.ts auditActionEnum gains 'admin_access' (line 53).
- New file: apps/puzzled/atlas/migrations/20260921030000_audit_action_admin_access.sql
- atlas migrate hash --dir "file://apps/puzzled/atlas/migrations" (atlas v1.3.0): rc=0 on two consecutive runs (idempotent). atlas.sum diff:
```

diff --git a/apps/puzzled/atlas/migrations/atlas.sum b/apps/puzzled/atlas/migrations/atlas.sum
index ca36235..befbd91 100644
--- a/apps/puzzled/atlas/migrations/atlas.sum
+++ b/apps/puzzled/atlas/migrations/atlas.sum
@@ -1,5 +1,6 @@
-h1:FtqHZw6AWQAjmRyoO1RshrFjOVQUWt+knk/312kEvsQ=
+h1:b5XKvtWkO8A92OOW0l7dEtAI2wERaEsWjc8Yhaew+ic=
 20260222000000_baseline.sql h1:s1JJixhhZWCRAJEmnXzCswTzY2VTuTEhVJvqun+xTXk=
 20260812000000_ritual_completion_drc.sql h1:Xhu5TcrCf1UV6Zbxsj1/PYLpoIjLbz8KTjCsFpPA+98=
 20260812010000_ritual_one_finish_per_day.sql h1:B8dS3cJud3fZs0VIFBSmWLuBf6poa/s9sJMtoNMfWGE=
 20260812233000_canonicalize_crowns_duo_slugs.sql h1:qDxm14dM4whx4uSif/HjMp9VQnrUf9O8TlogU09D12U=
+20260921030000_audit_action_admin_access.sql h1:tqKDcTw+dX+dHOLMS4eTbCM+Leq/+vCM+kCKlTf6sn4=
```
- grep -c admin_access atlas.sum = 1

### B (audit module + test)
- src/lib/audit/index.ts: +logAdminAccessAttempt; src/lib/audit/index.test.ts (new).
- env -u NODE_ENV bun test src/lib/audit/index.test.ts -> 2 pass / 0 fail (bun v1.4.2):
(pass) logAdminAccessAttempt > inserts an admin_access row with method, success and ip [32.73ms]
(pass) logAdminAccessAttempt > anonymous attempts record a null actorId [0.23ms]

### C (admin-api switch + test)
- src/features/admin/lib/admin-api.ts: logAdminAccess body now records via audit_logs (inline await load); redis.setex removed; console.warn kept.
- src/features/admin/lib/admin-api.test.ts (new).
- env -u NODE_ENV bun test src/features/admin/lib/admin-api.test.ts -> 3 pass / 0 fail:
(pass) checkAdminWithMfa admin access logging > records a failed secret attempt in the audit log [2.45ms]
(pass) checkAdminWithMfa admin access logging > records a successful secret attempt in the audit log [0.16ms]
(pass) checkAdminWithMfa admin access logging > records a rate-limited attempt in the audit log [0.37ms]

### D (UI copy + filter)
- audit-log-filters.tsx: ACTION_TYPES += 'admin_access'.
- messages: auditLogs.actions.admin_access in all 5 locales (en-GB/en-US "Admin Access", zh-CN "管理员访问", zh-HK/zh-TW "管理員存取").

### E (gates, pre-merge)
- lint: bun run lint (apps/puzzled) -> rc 0: "Checked 842 files in 349ms. No fixes applied."
- typecheck (CI shape, forced uncached): @sylphx/puzzled + @sylphx/ui tsc --noEmit -> 2 successful, rc 0 (cache bypass, force executing; 7.968s).
- full suite: env -u NODE_ENV bun test src -> 1072 pass / 6 skip / 0 fail, 32972 expect() calls, Ran 1078 tests across 108 files [66.67s].

### E2 (post-merge, head 03203da)
- merged origin/main 976210e (includes #162-#168, incl. #165) - clean, no conflicts.
- targeted post-merge: 5 pass / 0 fail (src/lib/audit/index.test.ts + src/features/admin/lib/admin-api.test.ts).
- typecheck post-merge: cache miss, executing -> 2 successful, rc 0, 9.951s.
- full suite post-merge: 1138 pass / 6 skip / 0 fail, 34655 expect() calls, Ran 1144 tests across 115 files [98.50s], full2_rc=0.

### F (mutation proof; saved copies in /data/sylphx/home/work/pz-program/notes/td06-mutation/)
- F1 admin-api (audit call -> return): bun test src/features/admin/lib/admin-api.test.ts -> 0 pass / 3 fail ('Expected length: 1 / Received length: 0'); restore via cp -> 3 pass / 0 fail; git status --porcelain empty between runs.
- F2 lib/audit (early return before logAuditEvent): bun test src/lib/audit/index.test.ts -> 0 pass / 2 fail; restore -> 2 pass / 0 fail.
- sha256 after restore: admin-api.ts 0345615d..., audit-index.ts 0c3b34d7... (match saved copies).

## Next action
- Done: PR https://github.com/SylphxAI/puzzled/pull/169 (head includes this notes commit). No further pushes from this run.
