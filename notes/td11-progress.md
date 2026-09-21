# TD-11 progress - oversized app-side modules

Base: be3f6dc2 (origin/main, freshly fetched). Branch: debt/td11-split. Worktree: td-11.
No open PRs at branch time; the two queued PRs (TD-22 #178, TD-18 #179) landed as 08d737c /
be3f6dc before branching, so TD-18's rewrite of lib/identity/react.tsx is the base we split.

## Scope decision (ranked by review pain x mechanical risk)

| target (apps/puzzled)            | lines | class                          | call |
|----------------------------------|-------|--------------------------------|------|
| games/word-guess/words.ts        | 17206 | vendored word data + lookup fn | MOVE to app-level data/ + header |
| lib/api/hooks.ts                 |  1028 | 5 API domains + shared keys    | split by domain + re-export barrel |
| lib/identity/react.tsx           |   955 | contexts/providers + hooks + UI| split by concern + re-export barrel |
| games/nonogram/generator.ts      |   874 | ~800-line PATTERNS data block  | move data to sibling patterns.ts |
| games/quad-words/generator.ts    |   662 | ~640-line QUORDLE_WORDS block  | move data to sibling words.ts |
| games/word-groups/puzzles.ts     |  1054 | curated puzzle bank (data)     | marker only - path is load-bearing |

Puzzles.ts does NOT move: src/lib/player-facing-identity.test.ts scans
`src/games/**/puzzles.ts` and asserts coverage of the surface
`src/games/word-groups/puzzles.ts`; moving it breaks a repo-wide oracle. Header marker only.

words.ts moves because its imports stay simple: only two sibling modules import it
(config.ts, use-word-guess.ts), zero test/script references to its path. Target:
`apps/puzzled/data/word-guess-words.ts` (out of src, per the register; still inside
tsconfig include, so the type gate covers it; biome's app scope is src/** so the dataset
leaves the lint scope, which is intended for pure data. No generation script exists
in-repo - the header says "vendored", not "generated", because that is what it is).

Chosen set: ALL SIX, each zero behaviour change, shipped as separate commits:
1. notes (this file) 2. lib/api/hooks.ts split 3. lib/identity/react.tsx split
4. corpora: words.ts move + words/puzzles headers 5. generator data moves (nonogram, quad-words).

## Split maps (planned)

### lib/api/hooks.ts -> lib/api/hooks/ + barrel
- hooks/shared.ts: ApiError, toApiError, queryKeys
- hooks/play.ts: useDailyStatus, useTodaysPuzzle, SaveResultInput/Output, useSaveResult
- hooks/stats.ts: UserStatsEntry/Response, useUserStats, TodayPercentileResponse, useTodayPercentile
- hooks/preferences.ts: NotificationPreferencesResponse + 3 preference hooks
- hooks/admin.ts: audit-log/DLQ/announcements/settings/games/analytics/health (the admin domain)
- hooks/profile.ts: useProfile, useUpdateProfile, useCheckUsername
- hooks.ts stays as the barrel: same export set, incl. the shouldUseRestPlayResidual fence.

### lib/identity/react.tsx -> lib/identity/react/ + barrel
- react/context.tsx: Auth/AppConfig/Billing/Platform contexts + SylphxProvider + PlatformProvider
- react/auth.ts: user/auth hooks + sign-in/up/forgot/reset form hooks + OAuthProvider type
- react/hooks.ts: referral, analytics, consent, notifications, achievements, error handler, session replay
- react/billing.tsx: Plan re-export, useBilling/usePlans/useSafeBilling, BillingSection
- react/ui.tsx: CookieBanner, AccountSection, SecuritySettings, UserProfile, OAuthIcons
- react.tsx stays as the barrel; every existing `@/lib/identity/react` import keeps working.
All pieces are client modules ('use client' on each), matching the original directive.

## Proof plan
- wc -l before/after per file (quoted raw).
- Export-set equality: extract export names from base vs branch for each barrel.
- Gates as CI runs them: bun run lint; bunx turbo typecheck --filter pzl; bun run test:unit
  (NODE_ENV=test); bun run build + node scripts/assert-document-route.mjs.
- Targeted tests: identity/react.test.ts + monitoring session-replay billing test (react split);
  nonogram/generator.test.ts + quad-words/generator.test.ts (data moves); api importers via
  existing suite (hooks split).

## Next action
Commit this note + push, then split lib/api/hooks.ts.

## Recovery checkpoint 1 - finisher resumed

Resumed by the td11 finisher after the wave-6 restart (previous worker died mid-flight).

State found in this worktree:
- Committed+pushed: aa22f43 (scope + plan), 75a5f86 (api/hooks split); origin/debt/td11-split == 75a5f86.
- Uncommitted WIP from the dead worker: lib/identity/react.tsx rewritten to a 44-line re-export barrel + new untracked dir lib/identity/react/ (context 141, auth 230, hooks 429, billing 76, ui 121) + .td11-scratch/ evidence dir (untracked; not for commit).

Independent verification this run:
- .td11-scratch/react.base.tsx is byte-identical to HEAD:react.tsx (952 lines).
- Export-set equality re-run via .td11-scratch/extract-exports.mjs: react barrel 34 = 34 (diff clean); api/hooks barrel 43 = 43 (diff clean).
- All split modules and both barrels start with 'use client'; grep for heredoc artifacts is clean.
- Sorted-line multiset diff of base react.tsx vs the split shows only import/comment/export-wrapper deltas; no code line missing or altered.

Next: quick biome + typecheck on the split, commit the react split, full gates, push, open the TD-11 PR.
Notes: worktree name is td-11 (td11f did not exist; the branch was already checked out here).
Pending characterization: the dead worker's hooks gate log shows 1 failing test 'schema/migration parity (drizzle vs atlas)' - to be compared against base (likely environmental).

## Recovery checkpoint 2 - react split committed
- Commit a49cd44 'refactor(identity): split the browser identity chrome by concern behind a re-export barrel (TD-11)' pushed; origin/debt/td11-split == a49cd44.
- Content: react.tsx 952 -> 44-line barrel + react/{context.tsx 141, auth.ts 230, hooks.ts 429, billing.tsx 76, ui.tsx 121}. The +89 line delta is per-file 'use client' + doc headers + imports + re-export block.
- Scoped biome on all 6 files: exit 0 (37ms, no fixes).
- Full gates started: lint, typecheck, unit tests, build.

## Recovery checkpoint 3 - unit suite + lint
- Unit suite (env -u NODE_ENV DATABASE_URL='postgresql://test:test@localhost:5432/test' SKIP_ENV_VALIDATION=true bun run test:unit): 1188 pass / 6 skip / 1 fail / 34908 expect() calls / 124 files / 86.02s - identical totals to the pre-restart run (1188/6/1, 85.19s).
- The single fail is src/lib/db/schema-parity.test.ts (check-schema-parity.sh exits 2: 'no dev database available'; this host: no postgres listening, docker daemon down, no sudo postgres). No db files are touched by this diff - environmental, reproduced identically pre-restart.
- Targeted: src/lib/identity/react.test.ts all 6 pass (imports the ./react barrel); session-replay billing test 3 pass.
- Lint: exit 0 - 884 files, 23 infos (pre-split run: 879 files, 23 infos - unchanged).
- Next: forced typecheck + build + assert-document-route; then proof file + PR.

## Recovery checkpoint 4 - all gates green
- Forced typecheck: exit 0 (2/2 tasks, 0 cached, 8.959s). Build: exit 0 (next 16.3.3, 118/118 pages). assert-document-route: exit 0 (status=200, 381,566 bytes, 1789ms).
- origin/main re-checked after fetch: still be3f6dc2 == merge-base; no rebase needed.
- Raw evidence committed as notes/td11-proof.txt. Opening the PR next.
