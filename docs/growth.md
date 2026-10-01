# Growth

How Puzzled grows, and the ranked list of growth work. The rules are the owner
standards [growth](https://github.com/SylphxAI/owner/blob/main/standards/growth.md),
[commercial](https://github.com/SylphxAI/owner/blob/main/standards/commercial.md) and
[product](https://github.com/SylphxAI/owner/blob/main/standards/product.md); the menu of mechanisms is
[mechanics](https://github.com/SylphxAI/owner/blob/main/standards/mechanics.md), reviewed once for this
backlog (used: the entries named below; skipped: paid acquisition, gifting and group buy until Plus is
on sale, and game-only entries; nothing invented beyond them). Success is judged by the metrics in
[metrics.md](metrics.md), not by which mechanisms ship.

## The loop

Daily games do not grow mainly because ads are clever. They grow because finishing today creates a
result card that makes a non-player curious about the same day:

```text
finish -> share -> land -> first finish (a new daily puzzle completer) -> return tomorrow
```

Not install, tutorial wall, permission prompt. The card rules are in [game-protocol.md](game-protocol.md#result-card).
Track three rates and judge their product, not any one spike: share rate (shares per finish), landing
rate (landings per share) and conversion (new completers per landing). Paid acquisition can come later;
organic loop quality stays the base.

Defaults, as judgement:

- **Onboarding:** first paint is play; usually ask for sign-up after the first finish, offer the second
  game only after it, and explain rules in context. A guest can finish and share without an account.
- **Social:** solo play plus sharing first; friend comparison opt-in with no public shame board; light
  co-op and clubs only after those work. Global leaderboards are not the main social surface, because
  they set a hardcore tone.
- **Reminders:** invitation, not threat ("Today's puzzle is ready", not "your streak is dying"); quiet
  hours and one-tap unsubscribe; win-back email is a Jobs capability and stays on brand.
- **Search:** one evergreen page per game, a how-to-play page and answer-free hints are welcome. Pages
  that promise answers we do not give, or exist only to rank, are not.
- **Abuse:** rate-limit shares and watch the share rate for anomalies; do not over-block real players
  when spotting multi-account farming; the server never ships solutions and cards carry no secrets.

## Already live

Ads for free players (behind config, off until an ad account is set; [monetization.md](monetization.md#ads)),
the free daily puzzle, streaks, the non-spoiler share card with a `?date=` link, the share landing
(`ShareResult` writes `result_shares` from the player's own accepted finish; the link is
`/daily?ref=<id>`, so the first-touch cookie credits the visit and any sign-up to the share; the
landing reads `GetSharedResult`, which returns only card facts), the challenge link (the landing
remembers the share and the result screen shows both results for the same game and day), the tomorrow
teaser (`getTomorrowsFreeGame` in `lib/free-rotation.ts`), the installable web app, first-touch
campaign attribution, Tryit conversion reporting ([capabilities.md](capabilities.md), PUZ-TRYIT), and
the daily-reminder, streak-at-risk and win-back email jobs.

## Notification consent and email links

Rust `PreferencesService` is the only writer of notification consent. Signed-in
settings use `UpdateEmailPreferences` / `UpdatePushPreferences`; emailed links
use `UnsubscribeEmail` without a session. The api verifies the dedicated
`EMAIL_UNSUBSCRIBE_SECRET` HMAC before upserting only `email_marketing=false`;
other consent fields remain unchanged. A missing key or database refuses the
request instead of reporting success. Bind the same existing email-link key to
the api (declared in `sylphx.toml`); the web service no longer needs it.

Existing links keep the `userId.base36Milliseconds.first16HexHmacSha256` format,
30-day expiry and five-minute future clock tolerance. Legacy, malformed,
forged and expired links are refused. `/api/email/unsubscribe` is only a Connect
forwarder: JSON POST carries `{token}`, browser GET redirects to the existing
landing page on the public site origin (never the internal `request.url` listener), and RFC 8058 POST carries `List-Unsubscribe=One-Click` as
`application/x-www-form-urlencoded` or `multipart/form-data` with the signed
token in the URL. No login
or redirect is required for the one-click POST. Repeated valid links are safe.

Tests: `route.test.ts` verifies forwarding and the no-web-database boundary;
`unsubscribe_tests.rs` drives the real Rust Connect router against a throwaway
Postgres, including preserved consent, repeated/first-row opt-out and refused
tokens. The verifier unit tests include a Node-compatible signed-link fixture.

## North Star and inputs

North Star: daily puzzle completers ([metrics.md](metrics.md)), recomputable from `game_sessions`
(`compute_drc`); no dashboard yet.

| Input | Measured today | Missing |
| --- | --- | --- |
| D7 retention of new completers | Derivable from the same finish rows | A cohort report: Signal analytics (cloud#9511) or a scheduled SQL job |
| Share-landing new completers | `result_shares.share_count`; landings keep `ref` (the share id) first-touch after consent; measure with `result_shares` joined to `account_attribution.ref` | Landing counts before consent (no cookie); a dashboard |
| Weekly regulars to Plus conversion | Weekly regulars (`compute_hrc`) | Conversion: Plus is dormant until Sylphx Money subscriptions (cloud#9152) |

## Ranked backlog

Mechanism names are entries in the owner mechanics menu. The last column is the metric each item
should move.

| # | Capability | Job it serves | Where it appears | Metric | Effort | Depends on |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Earned streak freezes (streak freeze) | Keep a streak alive through a missed day without guilt; free players earn one per 7 played days, hold at most 2, and a held freeze covers one missed day automatically (auto-cover is on by default; the `ToggleAutoFreeze` RPC turns it off, no settings control yet) | Stats streak card (freezes held, days to the next one), streak calculation | D7 retention | M | shipped (#299): rules in `puzzled-core` `personal_streak`, ledgers `streak_freeze_awards` and `streak_freeze_uses`; guests and signed-in players alike |
| 2 | Save-your-streak account ask (try before signup, saved progress) | Guests keep streak and stats across devices | Result screen: an inline card at the first finish (streak of 1 or more), plus a modal once the streak reaches 2; the button goes to `/signup?callbackUrl=/games/<game>` so the player returns to the game; the game-page link says "Save your streak"; never before the first finish | Guest to account rate, D7 retention | S | none |
| 3 | Daily reminder at each player's own time and time zone (personalised notification timing) | Gentle return without guilt | The player's saved reminder time is stored but does not schedule the send today: the daily-reminder job sends on its own schedule. Email (opt-in) at the player's time in their zone; browser Web Push through the existing reminder job (VAPID configuration required) | D7 retention | S | none for Puzzled's own email; cloud#9826 for caps across our products |
| 4 | Streak on the shared card (share cards) | Show the sharer's run on the card and landing, so a friend has something to beat | Share landing, share image, challenge comparison | Landing rate, conversion | S | none |
| 5 | How-to-play structured data on game pages (programmatic pages) | Rank for "how to play X" from the rules the pages already show | Per-game page markup | Search landings | S | none |
| 6 | Friends' results for today (friends leaderboard) | Compare with people you know, no public shame board | Result screen, opt-in | Share and return rates | M | cloud#9830 |
| 7 | Seasonal themes (shipped; holiday puzzles are not built) | Fresh reasons to share on festival days | Home banner, result card and share caption on the day | Share rate | S | none; the hand-set list in `apps/puzzled/src/features/seasons/lib/seasons.ts` stands in for cloud#9828 (calendar) and is replaced when it exists |
| 8 | Own-product promotion at session end (cross-promotion) | Point finished players to our other products | Already-played view, at most one card a day | Cross-product signups | S | cloud#9826 |

Seasonal themes: one typed list of days keyed to the product day (Asia/Hong_Kong), each with an id,
inclusive day ranges for 2026-2027, an accent from the game colour themes and a glyph; the greeting
is `home.seasons.<id>` in every locale. Adding a season is one list entry plus its greeting. On a
seasonal day only presentation changes: a banner on home, and a greeting pill on the result card and
a greeting line in the share caption. Puzzles, answers, scoring and streaks are untouched; there is
no countdown, no motion and nothing on other days.

Design notes for the open items:

- **Save-your-streak ask:** after a guest finishes a daily, the client reads the authoritative streak
  and shows an inline card (streak of 1 or more) and, from 2, the modal, each offering a free account.
  There is one prompt path (`SaveStreakPrompt`); the per-game local-count prompt was removed. Sign-in adopts accepted
  guest sessions through the existing claim path (`gamification`, `identity`).
- **Reminder time:** invitation copy only, one-tap unsubscribe (`jobs_policy`, `jobs_db`); using the
  player's own setting rather than inferring a median finish hour is enough to start.
- **Not building yet:** a per-game "today's hint" generator that cannot be proven to leak nothing, and
  public archive pages that would only exist to rank.

## Ships when Money is live

Everything here charges, discounts or unlocks paid access, so it waits for Sylphx Money subscriptions
(cloud#9152; reverse trial also #9829 and #9532). Nothing here builds billing: each row is a setting or a
product-side unlock on top of Money's plans, entitlements and coupons. Effects are estimates from
industry benchmarks; the product has no payers yet, so none is measured.

- [ ] **Plus on sale, yearly first** (S). Plans `individual_yearly` US$39.99 and `individual_monthly`
      US$4.99 (about 33% off); pricing toggle defaults to yearly; label the saving from the live prices
      with `yearlySavingPercent` (today's prices are 4 months free, so say that, never a rounder claim).
      Family US$7.99 up to 4 seats stays; test 6 seats later.
- [ ] **7-day trial on the yearly plan** (S). Money plan setting `trial_days = 7` on `individual_yearly`
      only; card up front; a reminder before it converts and one-step cancel (UK DMCC). Trial end date is
      the real one.
- [ ] **Reverse trial as the default** (M). After the 3rd finished day, grant an entitlement that opens
      all 19 games for 7 days, then drops back to free; one grant per account; a true "ends on
      DATE" line on the result screen. Runs instead of the card-up-front trial for new players; the
      yearly trial serves returning ones.
- [ ] **Metered archive** (S). 3 free past days per week for free players; the unlock panel shows on the
      result screen after a 7-day streak. Never before or during the free daily finish.
- [ ] **Lifetime plan** (S). One-time `individual_lifetime` at US$99.99 in Money; entitlement never
      expires; shown on the pricing page beside yearly.
- [ ] **Win-back offer** (S). Money coupon `winback_40_3m`: 40% off the first 3 months, redeemable once
      by a lapsed subscriber or a player with no finish for 30 days; sent by the existing win-back
      email job with the real end date. Test 50% against 40%.
- [ ] **Referral reward in Plus days** (M). "Give a friend 7 days Plus, get 7 days when they finish 3
      days", using the existing `result_shares` id and `ref` attribution; the reward is an entitlement
      grant, so it needs Money's grant API.
- [ ] **Paid streak freeze and Plus freezes** (S). Sell one freeze as a small one-off in Money; Plus
      gets 2 per month. Earned freezes already count toward the streak (backlog row 1, shipped); a bought freeze adds to the same bank, still capped by `FREEZE_CAP`.
- [ ] **Plus-nudge emails** (S). Day 3 and day 7 of a streak, consent-gated, with the yearly price and
      no false urgency.
- [ ] **Price localisation** (M). Money price tiers for HKD, EUR, JPY, INR, BRL and MXN alongside
      USD and GBP; the site already has 5 locales; price per storefront, never converted at display time.
- [ ] **Team plan for schools and workplaces** (L, after launch). A seat-based plan in Money.

## Pricing tactics

Prices and the market citation live in [monetization.md](monetization.md#3-price); change them only
there. Tactics: show the yearly plan first with its actual charge; keep the family plan as the upper
tier; price per storefront, not by converting currency; existing subscribers keep their price on an
increase; the trial, discount and localised prices are on the
[Ships when Money is live](#ships-when-money-is-live) list. We never price under the market position
because our cost is lower.

## Guardrails

Beyond the owner standards, these stay true here and each has a reason:

- **No dark patterns:** no false urgency (a true countdown, such as a real trial end, is fine), no
  streak guilt, no paywall before or during the free daily finish, no selling the solution. The free
  finish is what creates the habit a subscription is sold to. Cancellation, export and deletion stay easy.
- **Ads:** free players only, on the archive and result screens, never during play, removed for Plus
  ([monetization.md](monetization.md#ads)). Payments still go through Sylphx Money.
- **Store review policy:** if a store app ships, use only the native review prompt at a happy moment,
  with no pre-question or incentive (Apple 5.6.1, Google In-App Review), and disclose subscription
  terms per Apple 3.1.2 and the Google Play subscriptions policy; stores reject apps that do not.
- **UK DMCC Act 2024, Part 4 Chapter 2** (commencement pending; build to it now): a pre-contract summary,
  a reminder before a trial converts and before each renewal of a longer term, ending in one step, and
  the cooling-off periods. A save offer is one skippable step, never an obstacle.
- **Consent:** reminders, win-back and attribution run only on recorded consent; quiet hours hold.
- **Cubeage is a separate company.** Cross-promotion with a Cubeage title is a public link that carries
  no user data, unless a partner link with a data-sharing agreement and the user's consent exists
  (cloud#9826 item 9).
- **Public numbers have a source:** no player counts or ratings in copy unless rendered from their source.
