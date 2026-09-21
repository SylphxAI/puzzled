# TD-13 - SEO private-route list composition - progress

Branch: debt/td13-seo-route-prefixes
Worktree: $HOME/workspace/.worktrees/github.com/SylphxAI/puzzled/td-13
Base: origin/main = 7523ba9ef74eb80567a44b033b02394f91cf28a0 (fetched + verified 2026-09-21).

## Goal (register TD-13, measured e590b5c; names verified at 7523ba9)
lib/seo/routes.ts re-lists the 13 NOINDEX_ROUTE_PREFIXES inside PRIVATE_ROUTE_PREFIXES
plus /api,/admin. Compose PRIVATE_ROUTE_PREFIXES from CRAWL_BLOCKED_ROUTE_PREFIXES +
NOINDEX_ROUTE_PREFIXES. Prove sitemap/robots/SEO outputs byte-identical (quote before/after).

## Steps
1. [x] Recon (prior run).
2. [x] BEFORE captures at base: seo.test.ts 23 pass/1650 expect (td13-test-before.txt); td13-before.json 62,129 B sha256 4dd54cb922266b449ac2a917f8f711bc33d2b97b309131b412c1d4f06e228f78; privatePrefixes=14, sitemapEntries=125, probes=26.
3. [x] routes.ts composed from Set union - commit 5290a99.
4. [x] Guard tests (commit f056e4c): union equality + literal pin (order) + duplicate-free. Mutation A (drop Set): 23 pass / 2 fail ("Expected: 15, Received: 14"; td13-mut-a.txt). Mutation B (drop '/challenge' from NOINDEX): 22 pass / 3 fail (cover/union-pin/predicate; td13-mut-b.txt). Restored -> 25 pass / 0 fail / 1653 expect (td13-test-after.txt).
5. [x] AFTER capture at f056e4c: td13-after.json 62,129 B sha256 4dd54cb9...78 == before; cmp BYTE-IDENTICAL; diff empty; privatePrefixes=14, sitemapEntries=125, probes=26.
6. [~] Push: 5290a99, 4a12b4f, f056e4c all on origin; notes commit + PR to follow.

## Recovery log
- 2026-09-21 ~01:5x (run 2): prior run died after 5290a99; remote was e03e3f7. Pushed recovery commits; strengthened guards; both mutations red then restored green; captures byte-identical. Host quirk observed: shell calls sometimes return empty (exit undefined) but still execute - always verify state before retrying a mutation.

## Next action
Push this notes commit; open PR (branch debt/td13-seo-route-prefixes -> main).

## Evidence files ($HOME/work/pz-program/notes/)
- td13-test-before.txt / td13-test-after.txt / td13-mut-a.txt / td13-mut-b.txt
- td13-before.json / td13-after.json (62,129 B each; same sha256)

## Notes
- PRIVATE_ROUTE_PREFIXES feeds only isPrivateRoutePath + tests; sitemap()/robots() do not read it (grep at 7523ba9), so robot/sitemap byte-identity is expected - and measured.
- apps/puzzled/scripts/td13-capture.ts untracked on purpose ("temporary; not for commit").
- Host quirk: intermittent "exit undefined" responses that still executed; verify before retry.
