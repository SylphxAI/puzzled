# PZ S2 — one-standard-per-surface audit (apps/puzzled)

**Run:** 2026-09-20 (Europe/London). Stage **S2**, audit half only.
**Authority:** `docs/program/website-refactor/README.md` (stage S2), `inventory.md` (surfaces), `ia.md` (IA rules), `gaps.md` (register), plus `SylphxAI/owner` standards.
**Revision audited:** `ad89b83` (= `origin/main`, "fix(web): land the a11y review's cross-slice repairs (wave remainder) (#149)"), in my own worktree
`/data/sylphx/home/work/pz-s2-surface` on branch `s2/surface-audit` (canonical clone untouched, no branch switch).
**Observation layer:** production build of that revision (`SKIP_ENV_VALIDATION=true NODE_ENV=production bun run build`, BUILD_ID `blnv3XaCNbHyaI0saTWZy`) served by
`next start -p 4321`, plus static reads at that revision. No database/Redis on this host, so **signed-in console pages could not be rendered** —
their rows say so explicitly.
**No merge, no PR, no code change in this run.** The one deviation with a fix already staged is identified as such, not applied here.

## Status at landing (2026-09-20, recorded by the reviewer of this document)

This ledger is the S2 audit record. Disposition of its findings at the revision this document landed on (`878ca92`):

| Finding | Disposition |
| --- | --- |
| Marketing **D1** (home FAQ rendered raw key paths in the page *and* the FAQPage JSON-LD) | **Fixed** by #151 (`878ca92`) — real copy is now emitted from the `home.faq` namespace. |
| Console **D-co** (736/734 of 857 `settings.json` values identical to `en-US` in the zh locales; `/settings/notifications` hardcoded English; one toggle with no accessible name) | **Fixed** by #157 (`77a2d75`): the console and push-panel strings are translated for all five locales, `/settings/notifications` is in the catalogue, the switch carries `role="switch"` plus its `aria-*` wiring, and its contract test is mutation-checked. |
| Core play **D-cp** (`games/*/translations/en.json` injected for all five locales) and Marketing **D2** (38 games' tips/FAQ English in every zh locale) | **Fixed at the mechanism, partly at the content** by #155 (`1d5680a`): per-locale copy with a declared English fallback that can never render a blank or a raw key, proven by a tree-scanning test and by rendered before/after copy. Copy now exists for the five ritual modules; **14 of 19 modules still have no Chinese copy.** |
| Auth **D3** (`/unsubscribe` untranslated) | **Fixed** by #157 (`77a2d75`); its failure copy now derives from the HTTP status rather than from English API strings. |
| Marketing **D-focus** (catalog search field replaces the focus ring with a colour change) | Recorded, not fixed: owner = catalog surface. |
| **360px responsive** rows (marketing, and the same axis elsewhere) | **Unverifiable** on this host, not a finding. The repo's own responsive test covers 375/768/1280 and never 360px; the fix is to add the 360px case where that suite is wired into CI (stage S6 / gap G4). |
| Console sections that render only when signed in | **Not inspected** — no database or Redis on the auditing host. Not a pass; an explicit hole. |

Nothing in this document is evidence that any stage is deployed or live. `SylphxAI/owner` `standards/proof.md` evidence layers apply.

## The one checklist (from the program, not invented here)

Axis = `hierarchy` · `states (loading/empty/error)` · `responsive` · `focus/keyboard` · `i18n (5 locales)`.
Verdict = `conforms` · `deviation` · `unverifiable`. Severity = high / medium / low.
Owner convention: owning surface + the `owner` authority that decides it; author identity from `git log -1 -- <path>` is named where it is decisive.

---

## 0. Routes actually inspected

Probed live against the served build (all through `/tmp/wrap.sh curl`):

| Route | Result |
| --- | --- |
| `/` | 200, 379,098 B |
| `/pricing`, `/support` | 200 |
| `/games`, `/games?q=zzzzzz` | 200 (filtered-empty state present) |
| `/games/word-guess`, `/games/crowns`, `/games/sudoku` | 200 |
| `/games/unknownslug` | **404** (real not-found document) |
| `/login`, `/signup`, `/forgot-password`, `/reset-password` | 200 |
| `/settings` | **307 → `/login?callbackUrl=%2Fsettings`** (one hop) |
| `/zh-HK/settings` | **307 → `/zh-HK/login?callbackUrl=%2Fsettings`** |
| `/zh-HK`, `/zh-HK/games`, `/zh-HK/games/word-guess`, `/zh-CN/games/crossword`, `/zh-TW/games/sudoku` | 200 |
| `/zh-HK/unsubscribe` | 200 (English — see Auth D3) |
| `/zh-HK/nonexistent` | 404, `<html lang="zh-HK">`, Chinese copy |

**Checked statically at `ad89b83`, not rendered:** every `/settings/*` section page and its client (auth-gated, no session and no identity backend here);
the console `settings.json` locales (value-level read); admin routes (out of S2 scope).
**Not inspected at all:** `/privacy`, `/terms`, `/stats`, `/leaderboard`, `/profile`, `/verify-email`, `/challenge`, `/admin/*`, and 16 of the 19 module pages
(`/games/word-guess`, `/games/crowns`, `/games/sudoku` stood in for the module page; the i18n defect below is structural and applies to all 19).

---

## 1. Marketing — `/`, `/pricing`, `/support`, `/games`, `/games/[slug]`

| Axis | Verdict | Evidence | Severity | Disposition |
| --- | --- | --- | --- | --- |
| hierarchy | conforms | `/games` served HTML has exactly 1 `<h1>`; `/pricing`, `/support`, `/games/word-guess` each 1. `/` raw HTML shows 2 `<h1>` but the second is inside a streamed `<div hidden id="S:1">` segment (positions 10952 vs 64705, the latter inside `div hidden id="S:1"` starting 62998) — a Suspense-swap artifact, not a second visible heading. | — | — |
| states (loading/empty/error) | conforms | Filtered-empty state renders copy + recovery: `/games?q=zzzzzz` → `No modules match those filters` / `Try a different title, or clear the filters to see the whole suite.` / `Clear filters` (`app/[locale]/(main)/games/page.tsx:150-165`). Unknown slug → real 404. Skeleton components present for streamed islands. | — | — |
| responsive | **unverifiable at 360px** | Repo tests cover 375/768/1280 (`e2e-tests/responsive.e2e.ts:18-20`); no test at the 360px the checklist names. Static read finds no fixed width > 320px on these routes (nearest: `games/word-hive/components/honeycomb.tsx:77` `h-[260px] w-[260px]`), and `.page-shell*` padding is fluid. | low | Owner: S5/S6 test wiring (add a 360px case, then this closes). |
| focus/keyboard | **deviation** | `features/catalog/components/catalog-hero.tsx:71` — the catalog search field suppresses the browser ring and replaces it with a 1px border colour change only:<br>`className="h-11 min-w-0 flex-1 rounded-xl border border-border bg-background/90 px-3.5 text-sm outline-none transition-colors focus:border-primary"`<br>Every sibling control on the surface uses the `focus-visible:ring-2 focus-visible:ring-ring` pattern (e.g. the same file's filter chips, `settings/page.tsx:104`). The submit `<button>` beside it (`:78`) has no `focus-visible:` class either, so it keeps only the UA outline. **Static read, not observed.** | medium | Owner: catalog surface (author `30e2cfe`, Kyle Tse). One-line change; deferred because no existing test pins focus visibility here. |
| i18n | **deviation (2 findings)** | **D1 — home FAQ renders raw key paths.** Observed on the served build: `curl / → <summary>home.free.question`, `home.account.question`, `home.schedule.question`, `home.streak.question`, `home.share.question`, `home.catalog.question`, and the same bare keys as the FAQPage JSON-LD `"name":"home.free.question"`. Cause: `app/[locale]/(main)/page.tsx:386-393` passes `namespace="home"` with `keys={['free',…]}` while the copy lives nested at `home.faq.*` (`messages/en-US/home.json:73-79`; same nesting in en-GB/zh-HK/zh-TW/zh-CN); `features/marketing/components/marketing-faq.tsx` resolves `t(\`${key}.question\`)` inside the given namespace. **A fix already exists, unmerged:** branch `fix/home-faq-copy` (`bece032`, 3 commits: oracle test + `features/home/lib/home-faq.ts` + call-site fix) — recorded, not applied here. **D2 — module FAQ/tips are English in every Chinese locale.** `messages/zh-CN/catalog.json` `game.crossword.faq/tips` are byte-identical to en-US (all 38 array-valued `game.<slug>.tips|faq` keys identical in zh-CN **and** zh-HK). Observed: `/zh-CN/games/crossword` renders "How do I switch between across and down in Mini Grid?" / "Tap a square to select it and tap again to change direction…". | high (D1) / high (D2) | D1 → **owner: S4 (docs/program README S4 owns the FAQ/structured-data drift); fix staged on `fix/home-faq-copy`, needs landing.** D2 → **owner: catalog + localization (author `30e2cfe`, Kyle Tse).** |
| i18n — key parity | conforms | All 30 namespaces × 5 locales: **0 missing keys, 0 extra keys** vs `en-US` (script over `src/messages/*`). | — | — |

**Marketing tally:** 3 conforms, 2 deviations (4 distinct defects), 1 unverifiable.

---

## 2. Core play — the daily ritual (`/` → `/games/[slug]`) and a module page (`/games/sudoku`, `/games/word-guess`, `/games/crowns`)

| Axis | Verdict | Evidence | Severity | Disposition |
| --- | --- | --- | --- | --- |
| hierarchy | conforms | One `<h1>` per module route (observed 1 in `/games/word-guess` and `/games/sudoku`); hero → play region (`id="play"`, `(main)/games/[slug]/page.tsx`) → rules/tips/FAQ → related modules. | — | — |
| states (loading/empty/error) | conforms | Streaming skeleton `(main)/games/[slug]/game-play-skeleton.tsx` (in-page, not `loading.tsx`, so the registry guard still 404s first). Client fallback `game-daily-fallback.tsx` renders four honest states, all translated: loading (`t('loadingPuzzle')`), `closed` (accepted finish, no invented result), `denied` (unlock path + today's free module), and `unavailable` with a real retry that re-runs the effect. Difficulty chooser states unverified-completion explicitly (`difficulty-selection-view.tsx:104-108`, `tDaily('difficultyStatusUnverified')`). | — | — |
| responsive | **unverifiable at 360px** | Boards are width-capped, not fixed: `games/word-guess/components/game-board.tsx:167` `w-full max-w-[320px] px-2`; `keyboard.tsx:129` `w-full max-w-[512px] px-1`; `sudoku-game.tsx:135` `xs:max-w-[320px]`; `crossword/components/grid.tsx:87` `w-full max-w-[320px] px-2`. Tests at 375/768/1280 (`e2e-tests/responsive-games.e2e.ts:17-19`), none at 360. | low | Owner: S5/S6 test wiring. |
| focus/keyboard | conforms | Cell-level keyboard reachability is asserted, not assumed: `e2e-tests/a11y.e2e.ts:492-517` ("sudoku board names every cell", 81 cells, 0 unnamed); game grids use `focus-visible:ring-2` (`games/sudoku/components/grid.tsx:67`, `games/sudoku/components/number-pad.tsx:39`); the how-to-play surface is the shared `@sylphx/ui` `Dialog` (Radix semantics) rather than a hand-rolled overlay. | — | — |
| error boundary | **deviation** | `app/[locale]/(main)/games/[slug]/error.tsx:40` ships a hardcoded English sentence inside an otherwise translated boundary:<br>`Something went wrong while loading the game. Please try again.`<br>while the same component's heading and button come from `t('error')` / `t('retry')` (`common` namespace). | medium | Owner: core-play surface. Needs one `common`/`daily` key. |
| i18n | **deviation (3 findings)** | **D3 — per-game copy has no locale but English.** Only `apps/puzzled/src/games/*/translations/en.json` exists for all 19 modules (verified: `ls games/*/translations/` → `en.json` ×19), and `src/lib/i18n/request.ts:88-90` injects that one map under the `games` namespace **for every locale** (`messages.games = GAME_TRANSLATIONS_EN`). Observed: `/zh-CN/games/word-guess` → `如何玩 Five` (heading translated) immediately followed by `Guess the word in 6 tries` and `Green means the letter is correct`; `/zh-HK/games/word-guess` identical. **D4 — `daily`/`pagination`/`game-result` values untranslated in the zh locales** (values byte-identical to en-US, key present): `daily.json` 5 (`freeToday`, `tomorrowsFreeGame`, `unlockWithPremium`, `viewResult`, `backToHome`), `pagination.json` 7 of 8 (`loadMore`, `loading`, `noResults`, `previous`, `next`, `showing`, `page`), `game-result.json` 6 in zh-CN (`beatPercent`, `topPercent`, `perfectGame`, `playersToday`, `backToHome`, `missedCategories`), `stats.json` 11, `common.json` 18–21. **D5 — hardcoded play-surface strings:** `features/daily/components/how-to-play-modal.tsx:67` `Instructions not available for this game.` (and `:52` `config?.name || 'Game'`); `(main)/games/[slug]/difficulty-selection-view.tsx:148` `✓ Done`. | high (D3) / medium (D4) / low (D5) | D3 → **owner: game-module authors + localization; 19 modules × 4 locales of copy, structural (`request.ts` must load per-locale game files).** D4 → **owner: localization (author `8436819`, Kyle Tse).** D5 → **owner: core-play surface.** |

**Core-play tally:** 3 conforms, 2 deviations (5 distinct defects), 1 unverifiable.

---

## 3. Auth — `/login`, `/signup`, `/forgot-password`, `/reset-password` (+ `/unsubscribe`)

| Axis | Verdict | Evidence | Severity | Disposition |
| --- | --- | --- | --- | --- |
| hierarchy | conforms | 1 `<h1>` on each of `/login`, `/signup`, `/forgot-password`, `/reset-password` (observed). `(auth)/layout.tsx` redirects signed-in visitors out; `AuthShell` gives a labelled `#main-content` and a skip target. | — | — |
| states (loading/empty/error) | conforms | Each form has pending (`AuthSubmit` spins + `pendingLabel`), inline per-field errors, and a live form alert: `features/.../auth-fields.tsx:FormAlert` uses `<output aria-live="polite">`; `login-form.tsx` guards double-submit with a ref (`:50-58`); `signup-form.tsx:66-84` renders the `verify-email` state; `reset-password-form.tsx:48-63` renders a dedicated **missing-token** state (`invalidResetLink`), observed 200 at `/reset-password`. | — | — |
| responsive | **unverifiable at 360px** | `e2e-tests/responsive.e2e.ts:115-133` asserts `/login` and `/signup` fit every viewport and that inputs never exceed the viewport — but only at 375/768/1280. `AuthShell` collapses the brand panel below `lg`. | low | Owner: S5/S6 test wiring. |
| focus/keyboard | **deviation (1 route)** | `app/[locale]/unsubscribe/page.tsx` puts a `<Button>` **inside** a `<Link>` (e.g. `:118-120`, `:127-131`, `:145-147`) — nested interactive elements, invalid HTML and a known keyboard/AT hazard; the page also renders its own bare shell (no skip link, no locale-aware nav) unlike every other auth route. **Static read, not observed.** | medium | Owner: auth surface (author `95ede3f`, Kyle Tse). |
| i18n | **deviation (1 route, structural)** | The four representative routes **conform**: `/zh-HK/login` renders CJK ("登入"), locale files are wired through `getTranslations`, and parity is exact. But **`/unsubscribe` has no message namespace at all** — the file imports no `useTranslations`/`getTranslations` and hardcodes every string: `:51` `'Failed to unsubscribe'`, `:55` `'Network error. Please try again.'`, `:60-72` (`No unsubscribe token provided.`, `Invalid or expired unsubscribe link.`, `User not found.`, `Failed to unsubscribe. Please try again.`), `:92-95` `Processing your request...`, `:103-108` `Unsubscribed Successfully` + body, `:117-131` `Unsubscribe Failed` / `Manage Email Preferences` / `Return to Puzzled`, `:139-155` `Email Preferences` / `Go to Settings`. **Observed:** `GET /zh-HK/unsubscribe` 200 and the visible DOM contains `Email Preferences`, `Go to Settings`, `Return to Puzzled`. | high (for that route) | Owner: auth surface (author `95ede3f`). Neighbouring deviation: `app/[locale]/error.tsx:36,38,46` is likewise fully hardcoded ("Something went wrong" / "We encountered an unexpected error…" / "Try again") and wraps all four surfaces — **static read, not observed**. |
| i18n — placeholders | conforms | `placeholder="you@example.com"` (`login-form.tsx:89`, `signup-form.tsx`, `forgot-password-form.tsx`) is language-neutral; the password-field placeholder is `••••••••`. `signup-form.tsx` terms/privacy sentence uses `t.rich` so the links stay inside the message. | — | — |

**Auth tally:** 3 conforms, 2 deviations (3 distinct defects), 1 unverifiable.

---

## 4. Account console — `/settings` and its sections

| Axis | Verdict | Evidence | Severity | Disposition |
| --- | --- | --- | --- | --- |
| sign-in path is one hop (S2 gate) | **conforms, observed** | `GET /settings` → `307`, `location: /login?callbackUrl=%2Fsettings` (no `/en-US` prefix, no second hop). `GET /zh-HK/settings` → `307`, `location: /zh-HK/login?callbackUrl=%2Fsettings`. Source: `(main)/settings/layout.tsx:39` + `features/console/lib/require-member.ts` both use `redirect` from `@/lib/i18n/routing` with `localePrefix: 'as-needed'`; regression test exists at `apps/puzzled/src/lib/i18n/routing.test.ts` on branch `s2/console-one-hop` (`5ac7981`), asserting `/login?callbackUrl=%2Fsettings` for the default locale and prefixed targets for en-GB/zh-HK. **Verified, not re-done.** | — | — |
| hierarchy | conforms | One `<h1>` for the whole console from the frame (`(main)/settings/layout.tsx:46`, `ConsoleHeader` default `headingLevel={1}`), and every section page passes `headingLevel={2}` (account, notifications, preferences, profile, security, subscription, referrals). Section rail states the current page with `aria-current="page"` (`features/console/components/settings-nav.tsx:44`). | — | — |
| states (loading/empty/error) | conforms | The most complete surface for this axis. `(main)/settings/security/security-client.tsx` models three states and never prints a zero it did not receive: `aria-live="polite" aria-busy` wrapper (`:101`), loading copy, count, else `HonestNotice` with a retry action (`:110-116`). `subscription-client.tsx:108-110` and `referrals-client.tsx:65-72` use the same `HonestNotice`. `settings/page.tsx` degrades entitlement to free rather than crashing (`withPresentationDeadline(hasPremiumAccess(...), false)`). | — | — |
| responsive | **unverifiable at 360px** | Rail is a horizontally scrollable strip under `md` (`settings-nav.tsx:37` `-mx-4 flex gap-1 overflow-x-auto px-4 md:mx-0 md:flex-col`), so narrow widths scroll rather than clip; targets stay `min-h-11`. No test at 360px; console pages are auth-gated so no live probe was possible. | low | Owner: S5/S6 test wiring (add a console case with a session fixture). |
| focus/keyboard | **deviation** | `features/push/components/notification-preferences.tsx:151-162` — the panel's **main** push toggle is a bare `<button>` whose only child is a decorative `<span>`, with **no accessible name** and no `role="switch"`/`aria-checked`:<br>`<button type="button" onClick={isEnabled ? handleDisablePush : handleEnablePush} className={\`relative inline-flex h-6 w-11 …\`}>`<br>Every other control on this surface is correctly named (rail links, cards, `Button`s). Secondary: its checkboxes use non-token colours (`:103` `border-gray-300 focus:ring-primary`). **Static read, not observed (auth-gated).** | medium | Owner: console surface (author `95ede3f`, Kyle Tse). |
| i18n | **deviation (2 findings)** | **D6 — the console message catalogue is English in every Chinese locale.** Value-level read of `src/messages/<locale>/settings.json`: **zh-HK 736, zh-TW 736, zh-CN 734 of 857** string values are byte-identical to `en-US` — e.g. `settings.title => "Settings"`, `settings.nav.overview => "Overview"`, `"nav.securityDesc" => "2FA, sessions & alerts"`. Since every console component resolves `getTranslations('settings')`, a zh-HK/zh-TW/zh-CN player sees an English console. (Same file's neighbours: `admin.json` 208 — out of S2 scope; `reauth.json` 21.) **Value read, not rendered — console is auth-gated.** Author of the last change: `98c3f75` (Kyle Tse), the `#145` auth/console redesign. **D7 — `/settings/notifications` is hardcoded English end to end.** `features/push/components/notification-preferences.tsx` imports no translation hook at all; strings at `:78` "Push notifications are not supported in this browser.", `:117`/`:145` "Push Notifications", `:120-121` "Notifications are enabled"/"Enable notifications to get daily reminders", `:133` "Disable"/"Enable", `:147` "Get notified about puzzles, streaks, and more", `:174` "Notification Types", `:178` "Loading preferences...", `:183`/`:190`/`:197` "Daily Puzzle Reminder"/"Streak Alerts"/"New Games" (+ descriptions), `:210` "Saving..."/"Save Preferences", `:225` "Enable push notifications to customize your preferences", `:232` "Enable Notifications". | high (both) | D6 → **owner: localization + console (author `98c3f75`, Kyle Tse); one file per locale, mechanical.** D7 → **owner: console/push surface (author `95ede3f`, Kyle Tse).** |
| error boundary | conforms (by inheritance) | The console has no `error.tsx` of its own; the nearest boundary is `(main)/error.tsx`, which is translated (`t('error')`, `t('errorDescription')`, `t('retry')`) and offers a reset. Acceptable, but it inherits the untranslated `app/[locale]/error.tsx` only if the `(main)` boundary is skipped. | low | Note for the `error.tsx` owner above. |

**Console tally:** 4 conforms, 2 deviations (3 distinct defects), 1 unverifiable.

---

## 5. Tally and the two to fix first

| Surface | conforms | deviations | unverifiable | distinct defects |
| --- | --- | --- | --- | --- |
| Marketing | 3 | 2 | 1 | 4 |
| Core play | 3 | 2 | 1 | 5 |
| Auth | 3 | 2 | 1 | 3 |
| Console | 4 | 2 | 1 | 3 |
| **Total** | **13** | **8** | **4** | **15** |

Root causes are few: (1) locale message values copied from en-US and never translated (settings 736, catalog game FAQ/tips 38×2 locales, daily/pagination/game-result/stats/common/stats/reauth ≈ 70); (2) per-game copy English-only by construction (`request.ts` + `games/*/translations/en.json`); (3) five components that never adopted the message catalogue at all (`notification-preferences`, `unsubscribe`, `[locale]/error`, `global-error`, `admin/error`); (4) one home call site reading the wrong key path (already fixed on an unmerged branch).

**Fix first, in this order:**

1. **The console's localisation (D6).** 736 values per locale — the largest single block by an order of magnitude, it makes the whole account surface a second-class surface for three of five locales (exactly what S2 forbids), and the work is mechanical: translate three files. Highest value per unit of risk.
2. **The home FAQ key path (D1).** It is the only defect currently leaking to a *public* surface **and** into structured data — the visible page and the `FAQPage` JSON-LD both ship `home.free.question` as an answer — and the fix already exists on `fix/home-faq-copy` with a test, so the remaining work is landing it, not writing it.

(D3, the English-only game copy, is arguably larger than either, but it is 19 modules × 4 locales of *new* copy and needs a decision on who writes it — record with an owner, not a hot fix.)

## 6. Method limits stated plainly

- Every "conforms" for a rendered surface is backed by a served-build probe at `ad89b83`; every console `conforms` that depends on a signed-in render is **static-value evidence only** and says so.
- The 360px column is `unverifiable` for all four surfaces: the repo's own suites start at 375px and there is no DB/Redis on this host to run them against a signed-in console.
- The `zh-*` module-page and `/unsubscribe` findings were observed on rendered HTML; the console-localisation finding was observed at the message-value layer because the route is auth-gated.
