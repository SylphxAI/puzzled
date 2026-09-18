# Baselines

**Provenance.** Live values were probed on **2026-09-18** against `https://puzzled.gg`, whose `/healthz` reports `git_commit_sha = 83bd8d4a3feeddb385ec785fd8c9f934da3f20dd` — "feat(web): SEO truth layer — sitemap, robots, 404, private-surface indexing (#143)", Thu 17 Sep 2026. That commit is an ancestor of `origin/main` and the deployment is **5 commits behind** `origin/main` (`5ff27cf`, "feat(web): redesign pricing, support and legal surfaces (#146)").

**Read this before quoting any live number.** Where source and live disagree below, the live value is the **deployed** layer, not a defect in `main`. The five commits between them are #145 (auth and console), #147 (catalog and game pages), #148 (WCAG 2.2 AA), #133 (Next bump) and #146. Module-page canonical/hreflang and console `noindex` landed inside those commits, so **live readback cannot evidence S4 for those routes until current main deploys.**

## 1. SEO, meta and structured data

### Measured, live (deployed `83bd8d4`)

| Surface | `<title>` | canonical | hreflang cluster | JSON-LD |
| --- | --- | --- | --- | --- |
| `/` | `Free Daily Brain Games & Puzzles | Puzzled` | `https://puzzled.gg` | 6 alternates: `x-default`, `en-US`, `en-GB`, `zh-HK`, `zh-TW`, `zh-CN` | `Organization`; `WebSite` + `SearchAction`/`EntryPoint`; `FAQPage` + `Question`/`Answer` |
| `/stats` | `Statistics | Puzzled` | **absent** | **absent** | `Organization`; `WebSite` + `SearchAction` |
| `/games/sudoku` | `Sudoku | Puzzled` | **absent** | **absent** | `Organization`; `WebSite` + `SearchAction` |

Also measured live on the game page: `og:title`, `og:description`, `og:url` (absent), `twitter:card = "summary"` — a small card, not `summary_large_image`, and no `og:image`. The home page does emit a dynamic card, `https://puzzled.gg/og?title=…`, with `og:image` and `twitter:image`.

- `GET /robots.txt` → `Allow: /`, disallowing `/api/`, `/admin` and `/admin` under each of the four prefixed locales; `Sitemap: https://puzzled.gg/sitemap.xml`.
- `GET /sitemap.xml` → **125** `<loc>` entries: (6 public routes + 19 game slugs) × 5 locales, each carrying the same `xhtml:link` alternates the HTML emits. No private surface present. No `lastmod`.
- Redirects measured live: `/games/wordle` → **308** `/games/word-guess`; `/games/queens` → **308** `/games/crowns`; `/en` → **308** `/`; `/zh-Hans` → **308** `/zh-CN`; `/en-US/login` → **308** `/login`; `/en-gb` → **307** `/en-GB`. Next.js emits 308 for `permanent: true` rather than 301; the canonicalisation is permanent and no duplicate indexable URL results.
- `GET /settings` while signed out → **307** `https://puzzled.gg/en-US/login` → **308** `https://puzzled.gg/login` — two hops (gap **G6**).

### Declared, in `origin/main`

`apps/puzzled/src/lib/seo/routes.ts` is one table — `PUBLIC_ROUTES`, `NOINDEX_ROUTE_PREFIXES`, `CRAWL_BLOCKED_ROUTE_PREFIXES` — consumed by `sitemap.ts`, `robots.ts` and `scripts/seo-verify.ts` (`bun run verify:seo`). `lib/seo/metadata.ts` `buildPageMetadata()` emits canonical, the hreflang cluster and the social card together and self-referentially; `[locale]/(main)/games/[slug]/page.tsx` and `(main)/settings/layout.tsx` both call it. `src/app/not-found.tsx` and `[locale]/not-found.tsx` render `shared/components/not-found-view.tsx`.

### Enforcement

None unattended: `grep -c 'verify:seo\|seo-verify' .github/workflows/ci.yml` → **0** (gap **G9**). The harness exists and is only run by hand.

### Budget to adopt

One self-referential canonical per indexable URL; the full 6-entry hreflang cluster (including `x-default`) on every public URL; a page-type JSON-LD node that validates on every surface that earns one — `/` already emits `FAQPage` (6 `Question`/`Answer`), while `/stats` and `/games/[slug]` carry only site-wide `Organization`/`WebSite`; sitemap restricted to public routes; `noindex` on every private HTML surface; `verify:seo` in CI against a served build.

## 2. Core Web Vitals

### Declared thresholds in the repo

`crates/puzzled-core/**/web_vitals_thresholds.rs`: **LCP 2500 ms, INP 200 ms, CLS 0.1**. These describe the product's intent and are not connected to any check.

### Enforcement today

`apps/puzzled/lighthouserc.json` runs the **desktop** preset and asserts `categories:performance`, `categories:accessibility` and `categories:best-practices` at **error** (minScore 0.9) and `cumulative-layout-shift` at **error** (≤ 0.1); `categories:seo` is `warn` (minScore 0.85), and `largest-contentful-paint`, `first-contentful-paint`, `total-blocking-time` and `speed-index` are all `warn`. `bun run lighthouse` (`lhci autorun`) exists but no CI job invokes it — `.github/workflows/ci.yml` has six jobs (`lint-and-typecheck`, `security`, `migrations`, `unit-tests`, `build`, `rust-api`) and no Lighthouse step (gap **G5**).

### Measured today (deployed `83bd8d4`)

| Measure | Value |
| --- | --- |
| `/games/sudoku` first-load script assets referenced in `<head>` | **28** unique `/_next/static/chunks/*.js` (29 including the edge-injected `email-decode.min.js`) |
| `/games/sudoku` stylesheets | 2 |
| Third-party hints | 1 `dns-prefetch` (`js.stripe.com`) |
| `/` HTML transfer | **269,501 bytes** (269 KB) |
| `/games/sudoku` HTML transfer | **176,326 bytes** (176 KB) |

**Field data: `Unknown`.** No RUM readback is reachable from this host, so no p75 LCP/INP/CLS exists to compare against the thresholds. The client already emits a `web_vital` event, so the measurement path exists; what is missing is a readable destination (gap **G7**).

### Budget to adopt

A **mobile** lab run over `/`, `/games`, `/games/[slug]`, `/stats` and `/settings` at the repo's own thresholds as **errors**, not warnings; a first-load JS byte budget per route (28 script assets on a game page is the current shape to beat); and field p75 as the arbiter once **G7** gives it a home.

## 3. WCAG 2.2 AA

### What exists

`apps/puzzled/e2e-tests/a11y.e2e.ts`, `accessibility.e2e.ts` and `a11y-support.ts`; ten Playwright specs in total. `bun run test:a11y` runs the two a11y specs, `bun run test:e2e` the full set. `packages/ui/src/motion/motion-preferences.tsx` wraps `MotionConfig reducedMotion="user"` and is used by `popover`, `dropdown-menu`, `select`, `tooltip`, `form-feedback` and `inline-editable`; `dialog.tsx` and `motion/page-transition.tsx` gate motion separately through `useReducedMotion` from `motion/use-reduced-motion.ts`. It has its own test, and `apps/puzzled/src/shared/components/a11y-contract.test.ts` guards the app contract. The WCAG wave #148 is merged.

### Enforcement

**None.** CI runs no Playwright job, so neither a11y spec executes on a pull request (gap **G4**). The suite is a hand-run asset.

### Baseline

The suite runs in CI over every surface (marketing, catalog, module, auth, console, admin) with a violation failing the check; keyboard and focus paths on the play and console flows asserted explicitly rather than only via axe.

## 4. Analytics, funnel and error monitoring

### What exists

| Layer | Today |
| --- | --- |
| Client events | `web_vital`, `push_enabled`, `push_disabled`, `push_preferences_updated` — the complete set of event names in `apps/puzzled/src` |
| Consent | `shared/components/layout/consent-banner.tsx` + `features/analytics/lib/consent.ts` gate analytics and session replay |
| Client sinks | `/api/observability/analytics`, `/api/observability/error-events`, `/api/observability/session-replays` (POST) |
| Server record | `build_ritual_completed` (`crates/puzzled-core/src/capabilities/puzzle_play/domain/ritual_completion.rs`) — the server-authoritative `ritual.completed` contract, persisted by `capabilities/puzzle_play/adapters/game_sessions_db.rs` |
| Operator view | `/admin/system` shows database and Redis health only (`features/admin/components/system-health.tsx`) |

### Gaps

**G8** — the client funnel (`land → serve → finish → share → return → subscribe`) is not instrumented; the share-rate / land-rate / convert-rate loop `GROWTH-AND-VIRALITY.md` §2.2 requires cannot be computed from client data. **G7** — no operator readback for client error rate or field vitals.

### Baseline

Every step of the funnel emits an event that can be tied to the server-side completion record; consent gating is asserted (nothing fires before it); and an operator can read error rate and field vitals in-product, or the external authority for them is named with a link.

## 5. Baseline summary

| Layer | Measured (deployed `83bd8d4`) | Declared in `main` | Gate today | Target budget |
| --- | --- | --- | --- | --- |
| SEO / meta | 125 sitemap URLs; robots disallows `/api` + `/admin`; module and stats routes **lack** canonical/hreflang/OG image | `buildPageMetadata` + `lib/seo/routes.ts` emit canonical, hreflang, cards, `noindex` | none (`verify:seo` not in CI) | `verify:seo` in CI; full cluster on every public URL |
| Structured data | `Organization` + `WebSite` (+ `FAQPage` on home) | — | none | Page-type node validated per surface |
| Core Web Vitals | no field data (`Unknown`); 28 head scripts on a game page | LCP 2500 / INP 200 / CLS 0.1 | desktop-only Lighthouse, not run in CI (no mobile profile) | Mobile lab at repo thresholds as errors + JS byte budget + field p75 |
| WCAG 2.2 AA | 2 a11y specs, 10 e2e specs, all hand-run | `MotionConfig` reduced-motion gate across shared primitives | none | Suite in CI, violation fails |
| Analytics / errors | 4 client events; server completion record exists; consent gating present | Observability endpoints accept POST | none | Six funnel steps + operator readback, consent asserted |
