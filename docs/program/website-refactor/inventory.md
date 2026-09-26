# Page inventory

**Method:** derived from the tracked filesystem — `apps/puzzled/src/app/**/{page.tsx,route.ts}` — at `origin/main`, not from memory and not from a sitemap. Locale-aware routes are shown with the `[locale]` segment resolved: the default locale `en-US` carries **no** URL prefix; `en-GB`, `zh-HK`, `zh-TW`, `zh-CN` are prefixed (`lib/i18n/routing.ts`, `localePrefix: 'as-needed'`, `localeDetection: false`).

**Access classes:** `public`, `auth` (signed-in; visitors are redirected to sign-in), `admin` (operator), `api` (route handler, not a page).

Crawler status for every surface is owned by one table, `src/lib/seo/routes.ts` (`PUBLIC_ROUTES`, `NOINDEX_ROUTE_PREFIXES`, `CRAWL_BLOCKED_ROUTE_PREFIXES`), consumed by `sitemap.ts`, `robots.ts` and `scripts/seo-verify.ts`.

## 1. Pages that exist today

### Marketing and informational

| Route | Class | Displays | Flow served | Source |
| --- | --- | --- | --- | --- |
| `/` | public | Hero, today's line-up, how-it-works, FAQ, CTA | Cold visitor → first play | `src/app/[locale]/(main)/page.tsx` |
| `/games` | public | Catalog of every registered module, search by `?q=` | Discovery → pick a module | `src/app/[locale]/(main)/games/page.tsx` |
| `/pricing` | public | Plan comparison, upgrade path | Consideration → subscribe | `src/app/[locale]/(main)/pricing/page.tsx` |
| `/support` | public | Support content and contact | Problem help | `src/app/[locale]/(main)/support/page.tsx` |
| `/privacy` | public | Privacy policy | Legal | `src/app/[locale]/(main)/privacy/page.tsx` |
| `/terms` | public | Terms of service | Legal | `src/app/[locale]/(main)/terms/page.tsx` |

### Core play

| Route | Class | Displays | Flow served | Source |
| --- | --- | --- | --- | --- |
| `/games/[slug]` | public (per-module entitlement gates premium modules) | Module page: hero, difficulty selection, play area, rules, tips, FAQ, related modules | The daily ritual: serve → play → finish → share | `src/app/[locale]/(main)/games/[slug]/page.tsx` |

Accepts `?mode=daily|archive`, `?date=YYYY-MM-DD`, `?difficulty=`. The page passes `dateParam` down to `game-play-area.tsx`, which resolves it as `mode === 'archive' && hasUser && dateParam ? dateParam : undefined` (`game-play-area.tsx:137`). The share deep link emits `?date=` **without** `mode=archive` (`features/daily/lib/share-text.ts:41`), so a recipient's date is dropped on landing. Registered in [`gaps.md`](gaps.md) as **G1**.

Catalog slugs are owned by the game registry (`src/games/registry.ts`) and expand from the directories under `src/games/`: `arithmo`, `block-slide`, `crossword`, `cryptogram`, `killer-sudoku`, `nonogram`, `number-path`, `pattern-match`, `pip-place`, `quad-words`, `sudoku`, `word-box`, `word-groups`, `word-guess`, `word-hive`, `word-ladder`, `word-search`, plus the `queens` and `tango` directories that are canonicalised to the player slugs `crowns` and `duo`.

### Player state

| Route | Class | Displays | Flow served | Source |
| --- | --- | --- | --- | --- |
| `/stats` | public, `noindex` | Player statistics, streaks, history | Habit: see progress, return tomorrow | `src/app/[locale]/(main)/stats/page.tsx` |
| `/leaderboard` | public, `noindex` | Leaderboard by `?period=` | Opt-in social comparison | `src/app/[locale]/(main)/leaderboard/page.tsx` |
| `/profile` | auth, `noindex` | Player card: identity, record and streak; redirects to `/login?callbackUrl=/profile` only when signed out | See your own player card | `src/app/[locale]/(main)/profile/page.tsx` |

### Account console

The whole subtree is `auth`: `settings/layout.tsx` calls `currentUser()` and redirects to sign-in with a `callbackUrl`, renders one `ConsoleHeader` and a `SettingsNav` rail, and sets `noindex: true` through `buildPageMetadata`.

| Route | Displays | Source |
| --- | --- | --- |
| `/settings` | Console hub: `ConsoleCard` groups for player, play, plan and safety | `(main)/settings/page.tsx` |
| `/settings/profile` | Public profile | `(main)/settings/profile/page.tsx` |
| `/settings/account` | Account | `(main)/settings/account/page.tsx` |
| `/settings/preferences` | Locale and appearance preferences | `(main)/settings/preferences/page.tsx` |
| `/settings/notifications` | Notification preferences | `(main)/settings/notifications/page.tsx` |
| `/settings/security` | Password and sessions | `(main)/settings/security/page.tsx` |
| `/settings/subscription` | Billing and plan | `(main)/settings/subscription/page.tsx` |
| `/settings/referrals` | Referral programme | `(main)/settings/referrals/page.tsx` |
| `/settings/privacy` | Privacy controls | `(main)/settings/privacy/page.tsx` |

### Auth and verification

| Route | Class | Displays | Flow served | Source |
| --- | --- | --- | --- | --- |
| `/login` | public, `noindex` | Sign-in | Returning player → play | `(auth)/login/page.tsx` |
| `/signup` | public, `noindex` | Registration | New account | `(auth)/signup/page.tsx` |
| `/forgot-password` | public, `noindex` | Recovery request | Account recovery | `(auth)/forgot-password/page.tsx` |
| `/reset-password` | public, `noindex` | New password via `?token=` | Account recovery | `(auth)/reset-password/page.tsx` |
| `/verify-email` | public, `noindex` | Verification via `?token=`, `?email=` | Account activation | `verify-email/page.tsx` |
| `/unsubscribe` | public, `noindex` | Unsubscribe receipt via `?token=`, `?success=` | Engagement opt-out | `unsubscribe/page.tsx` |
| `/challenge` | public, `noindex` | Identity challenge via `?redirect=`, `?theme=` | Step-up verification | `(verify)/challenge/page.tsx` |

### Admin

Every admin route carries `robots: noindex` from `admin/layout.tsx` and is crawl-blocked by `robotsDisallowPaths()`.

`/admin`, `/admin/games`, `/admin/games/[slug]`, `/admin/announcements`, `/admin/audit-logs`, `/admin/dlq`, `/admin/experiments`, `/admin/settings`, `/admin/system` — all under `src/app/[locale]/admin/`.

### Route handlers (not pages)

`/api/admin/models`, `/api/commerce/{achievements,referrals}`, `/api/email/unsubscribe`, `/api/events/{devices,inbox}`, `/api/identity/{billing,billing/checkout,billing/portal,consent,login,logout,oidc/begin,recovery,recovery/complete,session,sessions,signup}`, `/api/observability/{analytics,errors,session-replays,test}`. The `/api` prefix is crawl-blocked.

### Generated documents and images

| Route | Purpose | Source |
| --- | --- | --- |
| `/sitemap.xml` | Public indexable URLs, one entry per locale per route, each with the same hreflang cluster the HTML emits | `src/app/sitemap.ts` |
| `/robots.txt` | Crawl rules generated from the same route table | `src/app/robots.ts` |
| `/og` | Dynamic social card image, parameterised by title | `src/app/[locale]/og/route.tsx`; `ogImagePath()` in `lib/seo/metadata.ts` |

### Error and loading surfaces

`error.tsx` at `global-error`, `[locale]`, `[locale]/(main)`, `[locale]/(main)/games/[slug]`, `[locale]/(auth)`, `[locale]/admin` — six in all. No `loading.tsx` boundary exists anywhere under `apps/puzzled/src/app` (`find apps/puzzled/src/app -name 'loading.tsx'` → none). Branded 404 at `src/app/not-found.tsx`, `src/app/[locale]/not-found.tsx`, rendering `src/shared/components/not-found-view.tsx`.

## 2. Pages that should exist

Derived from `docs/vision.md`, `docs/capabilities.md`, and the live oracle. Each row names what requires it.

| # | Route (proposed) | Flow served | Why required | Gap closed | Stage |
| --- | --- | --- | --- | --- | --- |
| 1 | `/games/[slug]?date=` honoured in daily mode | Share recipient lands on the **shared** day | Live oracle: "share a non-spoiler card with a `?date=` deep link"; `PUZ-SHARE` "Deep link opens the correct module for day_key" | The date is dropped unless `mode=archive` and signed in (**G1**) | S8 |
| 2 | `/archive` and `/archive/[date]` | Browse and replay past product days | `PUZ-PLUS`: "Archive, extra today's modules, and advanced stats fail closed without billing entitlement"; `MONETIZATION.md` premium table lists Archive / past day_keys | No archive surface exists in the app tree (**G2**) | S8 |
| 3 | A result-card share unit (image and/or accessible grid) | Share a glanceable, non-spoiler result | `RITUAL-AND-MODULE-PROTOCOL.md` §6.1 "Glanceable", "text alternative for visual grids"; `GROWTH-AND-VIRALITY.md` §3 "save image if offered" | Share is text-only via `navigator.share({ text })` (**G3**) | S3 |
| 4 | `/games/[slug]/how-to-play` (evergreen, indexable) | Term discovery; rules in context | `GROWTH-AND-VIRALITY.md` §7 permits evergreen explainers; §5 "Explain rules in context" | Rules live only inside play surfaces and a modal | S4 |
| 5 | `/legal/cookies` (or equivalent consent detail) | Consent transparency | `shared/components/layout/consent-banner.tsx` gates analytics and session replay; there is no document explaining what is collected | Privacy policy is the only legal document | S4 |
| 6 | Operator readback for client error rate and field vitals | Diagnose a Sev-1 without a third-party console | `METRICS-TREE.md` §3 "existence of alerts is required" | `/admin/system` shows database and Redis health only (**G7**) | S7 |

Rows 1 and 2 are the ones that touch the oracle or a capability completion condition. Row 3 is the viral unit the protocol specifies. Rows 4–6 are experience and operability improvements.
