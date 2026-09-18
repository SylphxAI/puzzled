# Baselines

**Method:** each line is either **Measured** (with the probe that produced it), **Declared** (a value written in the repo, which describes intent rather than current behaviour), or **Unknown** (no evidence obtainable here, with what would obtain it). Nothing in this file is an aspiration presented as a measurement.

Measured rows were taken on 2026-09-18 against `https://puzzled.gg`, which serves the currently deployed build. Source rows were read at `origin/main`.

## 1. SEO, metadata and structured data

| # | Property | Value | Kind | Evidence |
| --- | --- | --- | --- | --- |
| 1.1 | Home `<title>` | `Free Daily Brain Games & Puzzles \| Puzzled` | Measured | `GET /` |
| 1.2 | Home meta description | Present, unique, 154 characters, product-specific | Measured | `GET /` |
| 1.3 | Home canonical | `https://puzzled.gg` — bare origin, self-referential | Measured | `GET /` |
| 1.4 | hreflang cluster | 6 alternates: `x-default`, `en-US`, `en-GB`, `zh-HK`, `zh-TW`, `zh-CN`, each pointing at the matching locale URL | Measured | `GET /` |
| 1.5 | Open Graph | `og:title`, `og:description`, `og:url`, `og:site_name`, `og:locale` present | Measured | `GET /` |
| 1.6 | Twitter card | `summary_large_image` with title, description, image | Measured | `GET /` |
| 1.7 | Social image | Dynamic: `https://puzzled.gg/og?title=…` from `src/app/[locale]/og/route.tsx`, not a static file | Measured | `GET /`; `ogImagePath()` in `lib/seo/metadata.ts:149` |
| 1.8 | JSON-LD | 3 blocks on the home page: `Organization`, `WebSite` (with a `SearchAction` targeting `/games?q={search_term_string}`), and a third | Measured | `GET /` |
| 1.9 | Sitemap size | 125 `<loc>` entries = (6 public routes + 19 game slugs) × 5 locales | Measured | `GET /sitemap.xml` |
| 1.10 | Sitemap alternates | Every entry carries the same hreflang cluster the HTML emits | Measured | `GET /sitemap.xml` |
| 1.11 | `lastmod` | Deliberately absent; the app has no per-URL modification date | Declared | `src/app/sitemap.ts` comment |
| 1.12 | robots.txt | `Allow: /`; disallows `/api/` and `/admin` under every locale prefix; declares the sitemap | Measured | `GET /robots.txt` |
| 1.13 | Crawler route split | One table (`src/lib/seo/routes.ts`) feeds `sitemap.ts`, `robots.ts` and `scripts/seo-verify.ts` | Declared | `src/lib/seo/routes.ts`; `bun run verify:seo` |
| 1.14 | Legacy canonicalisation | `/games/wordle` → 308 `/games/word-guess`; `/games/queens` → 308 `/games/crowns`; `/en` → 308 `/`; `/zh-Hans` → 308 `/zh-CN`; `/en-gb` → 307 `/en-GB` | Measured | HTTP probes |
| 1.15 | SEO harness in CI | **Not run** — `bun run verify:seo` exists, `.github/workflows/ci.yml` never invokes it | Measured | `grep -c 'verify:seo\|seo-verify' .github/workflows/ci.yml` → 0 |
| 1.16 | Rich-result coverage | `Organization` and `WebSite` only. No `Game`, `SoftwareApplication`, `FAQPage` or `BreadcrumbList` — so no module page is eligible for a game or FAQ rich result | Measured | `GET /`; no such block in any route inspected |
| 1.17 | Sitemap `lastmod` freshness signal | Absent by design, so the sitemap publishes no freshness signal at all | Declared | `src/app/sitemap.ts` |

**Baseline statement.** Metadata foundations are in good shape: unique titles and descriptions, self-referential canonicals, a correct six-entry hreflang cluster, a dynamic social image, and a sitemap and robots.txt generated from one shared route table. The gaps are at the edges — the contract harness is not wired into CI, and structured data stops at the site level, so no module page can earn a rich result.

## 2. Core Web Vitals

| # | Property | Value | Kind | Evidence |
| --- | --- | --- | --- | --- |
| 2.1 | Repo thresholds | LCP 2500 ms, INP 200 ms, CLS 0.1 | Declared | `crates/puzzled-core/src/capabilities/presentation_policy/domain/web_vitals_thresholds.rs` |
| 2.2 | Lab config | Lighthouse CI, **desktop** preset, `cpuSlowdownMultiplier: 1`, 3 runs, URLs `/`, `/pricing`, `/login`, `/signup` | Declared | `apps/puzzled/lighthouserc.json` |
| 2.3 | Lab assertions | `categories:performance >= 0.9` (error), `accessibility >= 0.9` (error), `best-practices >= 0.9` (error), `seo >= 0.85` (warn); LCP `<= 2500` **warn**, FCP `<= 2000` warn, TBT `<= 300` warn, CLS `<= 0.1` **error** | Declared | `apps/puzzled/lighthouserc.json` |
| 2.4 | Lab execution in CI | **Never runs** — no Lighthouse step in `.github/workflows/ci.yml` | Measured | `grep` over the workflow; six jobs, none is Lighthouse |
| 2.5 | Mobile lab config | **None.** The only lab profile is desktop, on a route set that excludes every play surface | Measured | `apps/puzzled/lighthouserc.json` |
| 2.6 | Field data (CrUX) | **Unknown** — no field dataset was reachable from this host, and the repo stores no field baseline | Unknown | Would need the CrUX API (origin `puzzled.gg`) or the observability store read back |
| 2.7 | Field vitals collection | Client reporter exists (`features/analytics/components/web-vitals-reporter.tsx`, `web_vital` event, `lib/web-vitals.ts`) and posts to `/api/observability/analytics` | Declared | Source read |
| 2.8 | Field vitals readback | **None** — nothing reads the collected `web_vital` events back (see `gaps.md` G7) | Measured | `/admin/system` reports database and Redis health only |
| 2.9 | First-load JS byte budget | **None declared** | Measured | No budget configured anywhere in the app |

**Baseline statement.** The repo has thresholds and a lab config, and neither is enforced: `bun run lighthouse` is not a CI step. The declared lab profile is desktop-only and covers `/`, `/pricing`, `/login`, `/signup` — not `/games/[slug]`, the page that actually carries the play surface and the heaviest client code. There is no mobile profile, no JavaScript byte budget, and no field baseline in the repo.

## 3. Accessibility (WCAG 2.2 AA)

| # | Property | Value | Kind | Evidence |
| --- | --- | --- | --- | --- |
| 3.1 | Automated suite | `e2e-tests/a11y.e2e.ts` plus `e2e-tests/accessibility.e2e.ts` with a shared `a11y-support.ts` | Declared | `bun run test:a11y` in `package.json` |
| 3.2 | Broader E2E suite | Ten Playwright specs: accessibility, a11y, auth, games, navigation, responsive, responsive-games, settings, settings-profile, stats | Declared | `e2e-tests/`; `bun run test:e2e` |
| 3.3 | Execution in CI | **Never runs** — `.github/workflows/ci.yml` has no Playwright job | Measured | Six jobs: lint-and-typecheck, security, migrations, unit-tests, build, rust-api |
| 3.4 | Reduced-motion gating | `packages/ui/src/motion/motion-preferences.tsx` wraps `MotionConfig reducedMotion="user"` and is used by popover, dropdown-menu, select, tooltip, form-feedback and inline-editable; covered by `packages/ui/__tests__/motion-preferences.test.ts` and `apps/puzzled/src/shared/components/a11y-contract.test.ts` | Declared | Source read + test files |
| 3.5 | Automated violation count | **Unknown** — the suite is not run in CI and was not executed here, so there is no current pass/fail figure | Unknown | Would need `bun run test:a11y` against a running server |
| 3.6 | Manual keyboard and focus verification | **Unknown** — no record of a manual pass over the play and console flows | Unknown | Would need a recorded manual audit artefact |

**Baseline statement.** The tooling is in place and the reduced-motion work is real. What is missing is enforcement and a number: no CI job runs the suite, so there is no current violation count to improve against, and no manual keyboard/focus record for the flows WCAG 2.2 AA actually stresses.

## 4. Analytics and error monitoring

| # | Property | Value | Kind | Evidence |
| --- | --- | --- | --- | --- |
| 4.1 | Client event names in source | Exactly four: `web_vital`, `push_enabled`, `push_disabled`, `push_preferences_updated` | Measured | `grep` for `track('<name>'` across `apps/puzzled/src` |
| 4.2 | Funnel events | **None** — no client event marks land, first serve, first finish, share or return | Measured | Same `grep` |
| 4.3 | Server-side completion record | `ritual.completed` contract implemented (`build_ritual_completed`, `qualifies_as_ritual`) | Declared | `crates/puzzled-core/src/capabilities/puzzle_play/domain/ritual_completion.rs` |
| 4.4 | Ingest endpoints | `/api/observability/analytics`, `/api/observability/error-events`, `/api/observability/session-replays` — POST only | Measured | Route files under `src/app/api/observability/` |
| 4.5 | Consent gating | `features/analytics/lib/consent.ts` plus `shared/components/layout/consent-banner.tsx`; analytics and replay gated | Declared | Source read |
| 4.6 | Operator readback | **None in-product.** `/admin/system` (`features/admin/components/system-health.tsx`) reports database and Redis only. `game-dashboard.tsx` is per-game play statistics | Measured | Source read |
| 4.7 | Error tracking | `error-events` ingest exists; every route group has an `error.tsx`; no admin view and no named external authority recorded in-repo | Measured | `find` over `src/app`; admin route list |
| 4.8 | Session replay | Ingest endpoint and consent gate exist; no operator surface and no recorded retention policy found | Partial | Route file; no policy document located |

**Baseline statement.** Instrumentation is thinner than any other layer. Four client events exist, none of them on the product's own funnel; the observability endpoints accept data that nothing reads back; and the growth loop `GROWTH-AND-VIRALITY.md` §2.2 describes — share rate, land rate, convert rate — is unmeasurable from client signals today. The one strong asset is the server-side `ritual.completed` record, which means the North Star itself is recomputable even though the client funnel around it is not.

## 5. What each stage inherits

| Stage | Inherits from this file |
| --- | --- |
| S4 | 1.15 and 1.17 are the first tasks: run the existing harness in CI, then extend structured data past `Organization`/`WebSite` |
| S5 | 2.4, 2.5 and 2.9: enforce the existing lab config, add a mobile profile over the play routes, declare a JS byte budget |
| S6 | 3.3, 3.5 and 3.6: wire the suite into CI, produce a violation count, record a manual keyboard and focus pass |
| S7 | 4.2, 4.6, 4.7 and 4.8: build the funnel events, then the operator readback for errors and vitals |
