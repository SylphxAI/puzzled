# TD-07 - Six error boundaries, one shared view - progress

Branch: debt/td07-boundary-error-view
Worktree: $HOME/workspace/.worktrees/github.com/SylphxAI/puzzled/td-07
Base: origin/main = 7523ba9ef74eb80567a44b033b02394f91cf28a0 (fetched + verified 2026-09-21; branch pre-created, clean).

## Goal (register TD-07)
Five error.tsx (54, 51, 36, 58, 66 lines) + app/global-error.tsx (81) repeat the same
reported-ref + useEffect + reportBoundaryError + icon/CTA layout; only
lib/report-boundary-error.ts is shared. Extract one <BoundaryErrorView> + thin wrappers.

## Recon (7523ba9)
- Boundaries: src/app/[locale]/(auth)/error.tsx, (main)/error.tsx, (main)/games/[slug]/error.tsx,
  admin/error.tsx, [locale]/error.tsx; global-error.tsx separate.
- reportBoundaryError users: exactly the 5 error.tsx (+ its own unit test). global-error
  logs '[Global Error]' inline with a different payload.
- Copy: auth -> auth ns (errorTitle/errorBody/errorRetry/backToPlay); (main)+games ->
  common (error/errorDescription/retry); [locale]+admin -> hard-coded English; games body
  hard-coded English.
- Convention: shared views live in src/shared/components/ (sibling: not-found-view.tsx);
  markup tests use react-dom/server renderToStaticMarkup (a11y-contract.test.ts idiom).
- Worktree has no node_modules -> bun install needed for hooks/typecheck.

## Design (decided)
- New: src/shared/components/boundary-error-view.tsx ('use client'): report-once ref +
  useEffect + reportBoundaryError inside; badge + title + description + optional detail
  + optional children + actions row (retry button with label).
- 5 wrappers become thin: pass boundary name, error, reset, t(...) strings, optional
  actions; keep every existing translation key; NO message-file changes (no new keys
  needed; hard-coded copy stays as-is).
- global-error.tsx: left untouched - it must render when providers and the app stylesheet
  may not exist (no next-intl, no Tailwind), so sharing is not clean. Say so in PR.
- Guard test: boundary-error-view.test.ts = markup contract + every src/app/**/error.tsx
  reads through the shared view (and no boundary calls reportBoundaryError directly).

## Steps
1. [x] Recon (above).
2. [x] Notes checkpoint (this commit); bun install kicked off.
3. [ ] Write component + rewrite 5 wrappers + test.
4. [ ] Tests + typecheck + biome; quote.
5. [ ] Commit + push; open PR.

## Next action
Write src/shared/components/boundary-error-view.tsx (step 3).

## Notes
- Host quirk: shell calls often return 'exit undefined' but execute anyway - verify state.
- Lefthook pre-commit runs biome + turbo typecheck on apps/puzzled/** commits (~15-20s).
