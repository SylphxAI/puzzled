# Information architecture and navigation

**Method:** read from the shipped shell and navigation components at `origin/main`, plus live HTTP probes against `https://puzzled.gg`. Every claim cites a path or a probe. The "target" half is design intent — it is not evidence of anything built.

## 1. Current architecture

### 1.1 One route table owns crawler truth

`src/lib/seo/routes.ts` is the single table for what is public, what is `noindex`, and what is crawl-blocked, and it is consumed by three things: `sitemap.ts`, `robots.ts`, and `scripts/seo-verify.ts` (the harness run by `bun run verify:seo`). Public routes are `/`, `/games`, `/pricing`, `/support`, `/privacy`, `/terms`, plus every `/games/<slug>` expanded from the game registry. `/stats`, `/leaderboard`, `/settings`, `/profile` and the auth family are served as HTML but carry `noindex`. `/api` and `/admin` are crawl-blocked outright.

Verified live: `https://puzzled.gg/robots.txt` disallows exactly `/api/` and `/admin` under each locale prefix, and `https://puzzled.gg/sitemap.xml` contains **125** `<loc>` entries — (6 public routes + 19 game slugs) × 5 locales — with no private surface present.

### 1.2 URL scheme

- Locale is a path prefix with `localePrefix: 'as-needed'` and `localeDetection: false` (`src/lib/i18n/routing.ts`). `en-US` is served unprefixed; `en-GB`, `zh-HK`, `zh-TW`, `zh-CN` are prefixed. Five locales, not sixteen.
- Canonical play path is `/games/<slug>` (`src/lib/module-routes.ts`). Short `/crowns` and `/duo` are **inbound aliases** that redirect to `/games/crowns` and `/games/duo`; they are not a second product. The file enumerates the locale prefixes explicitly rather than globbing, because a `/:locale` glob treats `games` as a locale and produces `/games/games/crowns`.
- Legacy publisher marks redirect to canonical Puzzled slugs (`next.config.ts`, `redirects()`): `/games/wordle` → `/games/word-guess`, `/games/connections` → `/games/word-groups`, `/games/spelling-bee` → `/games/word-hive`, `/games/quordle` → `/games/quad-words`, `/games/letter-boxed` → `/games/word-box`, `/games/queens` → `/games/crowns`, `/games/tango` → `/games/duo`, each with a `/:locale` variant. `/en`, `/zh-Hans` and `/zh-Hant` families also redirect.
- Measured live: `/games/wordle` → **308** `/games/word-guess`; `/games/queens` → **308** `/games/crowns`; `/en` → **308** `/`; `/zh-Hans` → **308** `/zh-CN`; `/en-gb` → **307** `/en-GB`; `/en-US/login` → **308** `/login`. Next.js emits **308** for `permanent: true`, not 301; the canonicalization is permanent and correct, and the default-locale prefix does not create a duplicate indexable URL.

### 1.3 Navigation surfaces

`src/shared/components/layout/nav-items.ts` is the single navigation source, with per-surface flags rather than per-surface lists.

| Item | `showInTopNav` | `showInBottomNav` |
| --- | --- | --- |
| `/` Home | yes | yes |
| `/games` Games | yes | yes |
| `/stats` Stats | yes | yes |
| `/leaderboard` Leaderboard | yes | no |
| `/pricing` Pricing | yes | no |
| `/profile` Profile | no | yes |
| `/support` Support | via `SUPPORT_NAV_ITEM`, mobile sheet only | no |

| Surface | Component | Contents |
| --- | --- | --- |
| Desktop top nav | `top-nav.tsx` | The five `showInTopNav` items, a streak chip linking to `/stats` when `currentStreak > 0`, theme toggle, language switcher, user menu |
| Mobile bottom nav | `bottom-nav.tsx` | The four `showInBottomNav` items |
| Mobile nav sheet | `mobile-nav-sheet.tsx` | All `NAV_ITEMS` plus `SUPPORT_NAV_ITEM`, appearance and language controls, account entry |
| Inner-page header (mobile) | `header.tsx` | Back affordance, logo, title, sound, theme, language, user menu — `md:hidden` |
| Console chrome | `features/console/components/console-chrome.tsx` | `ConsoleHeader` / `ConsoleCard`, and the `SettingsNav` rail |
| Footer | `footer.tsx` | Marketing and legal links |
| Admin | `admin/layout.tsx` | Operator family, `noindex` |

### 1.4 Defects recorded in the current IA

1. **The console redirect costs two hops on the default locale.** Measured live: `GET /settings` → **307** `https://puzzled.gg/en-US/login` → **308** `https://puzzled.gg/login`. The locale-aware `redirect()` in `settings/layout.tsx` emits a prefixed URL for a locale the routing config deliberately serves unprefixed, and the prefix-stripping redirect then normalizes it. One hop is enough; every signed-out console visit pays two round trips. Registered in [`gaps.md`](gaps.md) as **G6**.
2. **The nav mixes intents in one flat group.** `NAV_ITEMS` holds playing (`/games`), tracking (`/stats`, `/leaderboard`), commercial (`/pricing`) and account (`/profile`) entries with only per-surface visibility flags, and `mobile-nav-sheet` then appends support. Nothing separates "play" from "account" from "site".
4. **No archive destination exists.** The premium archive the destination promises has no addressable surface anywhere in the tree. Registered as **G2**.
5. **Rules are not addressable.** `how-to-play-modal.tsx` is the only rules surface and it is a modal, so "explain rules in context" cannot be linked, indexed, or returned to.

## 2. Target architecture

Design intent. Every item becomes a stage task with its own definition of done.

### 2.1 Surfaces and their jobs

| Surface | Job | Navigation |
| --- | --- | --- |
| **Today** (`/`) | Answer "what is today's ritual" in one glance and start it | Primary item 1 |
| **Games** (`/games`) | Browse the unbounded catalog, find a module | Primary item 2 |
| **Play** (`/games/[slug]`) | Serve, play, finish, share | Reached from Today, Games and share links |
| **Archive** (`/archive`, `/archive/[date]`) | Replay past product days, gated by entitlement | Entitlement-aware entry |
| **Progress** (`/stats`) | Show the player their own history and streak | Primary item 3 |
| **Community** (`/leaderboard`) | Opt-in light comparison | Primary item 4, never the home ritual |
| **Console** (`/settings`) | The signed-in home: state first, configuration second | User menu |
| **Marketing** | Explain and convert | Footer and contextual links |
| **Auth** | Sign in, sign up, recover, verify | Reached only from intent |

### 2.2 Rules that bind the target

1. **One navigation source, one link primitive.** `nav-items.ts` stays the only nav list; every internal link goes through the locale-aware `Link` from `@/lib/i18n/routing`, so no surface hand-builds a locale prefix.
2. **One hop to the console.** A signed-out visitor reaches sign-in in a single redirect; a signed-in visitor reaches the console in one.
3. **Every nav entry is a real destination.** No item in a nav surface is a redirect.
4. **One canonical URL per page.** Legacy and alias slugs redirect permanently; nothing private is in the sitemap; the route table stays the only crawler authority.
5. **Rules are addressable.** Each module's rules have their own URL, reachable from its play surface.
6. **Navigation is grouped by intent.** Playing, tracking, and account/site concerns read as distinct groups, not a flat list.
7. **Localisation is not optional per surface.** Any string a player can read comes from a message namespace, on every surface including the console.
