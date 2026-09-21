# TD-07 - Six error boundaries, one shared view - progress

Branch: debt/td07-boundary-error-view
Worktree: $HOME/workspace/.worktrees/github.com/SylphxAI/puzzled/td-07
Base: origin/main = 7523ba9ef74eb80567a44b033b02394f91cf28a0 (fetched + verified 2026-09-21).

## Goal (register TD-07)
Five error.tsx + app/global-error.tsx repeat the same reported-ref + useEffect +
reportBoundaryError + icon/CTA layout. Extract one <BoundaryErrorView> + thin wrappers;
keep translation keys; global-error may stay separate with a stated reason.

## Result (commit 9f1911b, pushed)
- New src/shared/components/boundary-error-view.tsx ('use client'): report-once effect +
  badge + title + description + optional detail + optional children + actions row with the
  retry button. Props: boundary, error, reset, title, description, retryLabel, icon?,
  detail?, actions?, children?, className?.
- 5 wrappers rewritten as thin pass-throughs (170 -> 93 lines): (auth), (main),
  (main)/games/[slug], [locale], admin. Every existing translation key kept
  (auth.errorTitle/errorBody/errorRetry/backToPlay; common.error/errorDescription/retry).
  No message files touched (no new keys needed; hard-coded copy unchanged).
- global-error.tsx untouched: it must render without providers/app stylesheet; explained
  in PR body.

## Evidence
- New guard test boundary-error-view.test.ts: 4 pass / 0 fail / 10 expect (markup contract
  + app-wide wiring walk: every error.tsx renders through the view, none calls
  reportBoundaryError directly).
- Lane: bun test src/shared/components src/lib/report-boundary-error.test.ts ->
  15 pass / 0 fail / 33 expect (td07-tests.txt).
- Mutation proof: re-added direct reportBoundaryError import to (main)/error.tsx ->
  wiring guard red, directReporters = [that path], 3 pass / 1 fail (td07-mut.txt);
  restored -> clean tree.
- biome + turbo typecheck (tsc x2) green via pre-commit hook (td07-hook.txt).
- Full unit lane (bun test src) running -> td07-tests-full.txt.

## Steps
1-4 done; 5: PR to open.

## Next action
Check full lane result; open PR.

## Notes
- Host quirk: shell calls often return 'exit undefined' but execute anyway - verify state,
  capture output to files.
- Worktree needed bun install (done; td07-install.txt).
