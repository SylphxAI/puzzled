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
