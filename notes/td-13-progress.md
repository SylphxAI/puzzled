# TD-13 - SEO private-route list composition - progress

Branch: debt/td13-seo-route-prefixes
Worktree: $HOME/workspace/.worktrees/github.com/SylphxAI/puzzled/td-13
Base: origin/main = 7523ba9ef74eb80567a44b033b02394f91cf28a0 (fetched + verified 2026-09-21).

## Goal (register TD-13, measured e590b5c; names verified at 7523ba9)
lib/seo/routes.ts re-lists the 13 NOINDEX_ROUTE_PREFIXES inside PRIVATE_ROUTE_PREFIXES
plus /api,/admin. Compose PRIVATE_ROUTE_PREFIXES from CRAWL_BLOCKED_ROUTE_PREFIXES +
NOINDEX_ROUTE_PREFIXES. Prove sitemap/robots/SEO outputs byte-identical (quote before/after).

## Steps
1. [x] Recon: register row read; routes.ts read at origin/main; open PRs checked (only #153, touches .github/ci.yml + e2e a11y files - no overlap); worktree created from fetched origin/main; upstream unset (branch tracks nothing; push by explicit refspec).
2. [x] BEFORE captures at base (clean tree, 7523ba9): (a) `env -u NODE_ENV bun test src/lib/seo/seo.test.ts` -> 23 pass / 0 fail / 1650 expect() calls (td13-test-before.txt); (b) `env -u NODE_ENV NEXT_PUBLIC_APP_URL=https://puzzled.gg SKIP_ENV_VALIDATION=true bun run scripts/td13-capture.ts` -> notes/td13-before.json = 62,129 B, sha256 4dd54cb922266b449ac2a917f8f711bc33d2b97b309131b412c1d4f06e228f78; privatePrefixes=14, sitemapEntries=125, probes=26.
3. [ ] Edit routes.ts: PRIVATE_ROUTE_PREFIXES = deduped union (Set) of CRAWL_BLOCKED + NOINDEX; keep order (matches the literal it replaces, 14 entries).
4. [ ] Guard tests in seo.test.ts (composition union equality, incl. no-duplicate) + mutation proof (mutate -> red; restore -> green).
5. [ ] AFTER captures; diff before/after (expect empty); quote hashes + diff.
6. [ ] Commit + push each step; open PR.

## Next action
Apply the routes.ts composition edit (step 3) + guard test (step 4); run test green; commit fix; then mutation proof; then AFTER captures (step 5).

## Notes
- seo-verify.ts requires next build + next start (served build); plan: unit lane + document byte-dump diff as the byte-identity proof (PRIVATE_ROUTE_PREFIXES feeds only isPrivateRoutePath + tests; sitemap.ts/robots.ts do NOT read it - verified by grep at 7523ba9).
- Host exports NODE_ENV=production -> run tests as env -u NODE_ENV bun test ...
- Host quirk: intermittent Error 24; retry lean after ~60s.
