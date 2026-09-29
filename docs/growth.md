# Growth backlog

The ranked list of growth work for Puzzled. The rules are the owner standards
[growth](https://github.com/SylphxAI/owner/blob/main/standards/growth.md),
[commercial](https://github.com/SylphxAI/owner/blob/main/standards/commercial.md) and
[product](https://github.com/SylphxAI/owner/blob/main/standards/product.md); the loop itself is
[GROWTH-AND-VIRALITY.md](north-star/GROWTH-AND-VIRALITY.md). Mechanic ids (R24, V04, …) are rows of
Cubeage's [mechanics catalogue][mc], adopted read-only (a separate company's document; the rows stay
there). Evidence ids `[S1]`–`[S13]` are its [sources][src].

[mc]: https://github.com/Cubeage/cubeage-platform/blob/main/docs/standards/mechanics-catalogue.md
[src]: https://github.com/Cubeage/cubeage-platform/blob/main/docs/standards/game-standard.md#appendix-c-sources

Already live, so not on this list: ads for free players (behind config, off until an ad account is set; [MONETIZATION.md](north-star/MONETIZATION.md#ads)), the free daily seeded puzzle ([R24][mc-r]), non-spoiler share card
with a `?date=` link ([V02][mc-v]), streaks with freezes ([R03, R45][mc-r]), the installable web app,
first-touch campaign attribution, Tryit conversion reporting (below), and the daily-reminder, streak-at-risk and win-back email jobs.

[mc-r]: https://github.com/Cubeage/cubeage-platform/blob/main/docs/standards/mechanics-catalogue.md#retention-r
[mc-v]: https://github.com/Cubeage/cubeage-platform/blob/main/docs/standards/mechanics-catalogue.md#virality-v
[mc-b]: https://github.com/Cubeage/cubeage-platform/blob/main/docs/standards/mechanics-catalogue.md#subscriptions-b
[mc-x]: https://github.com/Cubeage/cubeage-platform/blob/main/docs/standards/mechanics-catalogue.md#product-and-ux-x
[mc-a]: https://github.com/Cubeage/cubeage-platform/blob/main/docs/standards/mechanics-catalogue.md#acquisition-a
[mc-d]: https://github.com/Cubeage/cubeage-platform/blob/main/docs/standards/mechanics-catalogue.md#discovery-and-delight-d

## North Star and inputs

**North Star: daily puzzle completers**, defined in [NORTH-STAR-METRIC.md](north-star/NORTH-STAR-METRIC.md).
Measured today: recomputable from `game_sessions` (`compute_drc`); no dashboard yet.

| Input | Measured today | Missing |
| --- | --- | --- |
| D7 ritual retention ([METRICS-TREE.md](north-star/METRICS-TREE.md) 2.1) | Derivable from the same finish rows | A cohort report: Signal analytics (cloud#9511) or a scheduled SQL job |
| Share-landing new completers (shares → landings → first finishes) | `result_shares.share_count`; landings keep `ref` (the share id) first-touch after consent | Landing counts before consent (no cookie); a dashboard |
| Weekly ritualists → Puzzled Plus conversion | Weekly ritualists (`compute_hrc`) | Conversion: Plus is dormant until Sylphx Money subscriptions (cloud#9152) |

## Ranked backlog

| # | Mechanic | Job it serves | Where it appears | Expected impact | Effort | Depends on |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Share landing page ([V14][mc-v]) + share event | Turn a shared card into a first finish, and measure the loop | Link opened by a non-player; share tap on the result screen | Wordle grew by shared grids alone (catalogue V02, V04); makes input 2 measurable | S | none, build now |
| 2 | Challenge link ([V04][mc-v]): "beat my result on today's puzzle" | Give a friend a reason to play the same day key | Result screen, beside Share | Wordle-style dailies (V04); two results side by side after the friend's finish | M | none on web; cloud#9827 once store apps exist |
| 3 | Tomorrow teaser ([R50][mc-r]) | A visible reason to return tomorrow | Result screen and already-played view | Genshin previews, event countdowns (R50); puzzles exist 14 days ahead, so the date is real | S | none, build now |
| 4 | Save-your-streak account ask ([experience: account protection](https://github.com/SylphxAI/owner/blob/main/standards/experience.md#account-protection), [X02][mc-x]) | Guests keep streak and stats across devices | Result screen, raised as the streak grows; never before the first finish | Supercell ID guest-first binding ([S11]) | S | none, build now |
| 5 | Reminder at the player's usual finish time ([R46][mc-r], [R12][mc-r]) | Gentle return without guilt | Email (opt-in) at the hour they usually finish; PWA push later | Braze/OneSignal intelligent timing (R46) | S | none for Puzzled's own email; cloud#9826 for caps across our products |
| 6 | Friends' results for today ([V08][mc-v]) | Compare with people you know, no public shame board | Result screen, opt-in | Wordle and Candy Crush friend boards (V08) | M | cloud#9830 |
| 7 | Seasonal themes and holiday puzzles ([D08][mc-d]) | Fresh reasons to share on festival days | Home and result card on the day | Animal Crossing seasonal ambience (D08) | S | cloud#9828 (calendar); a hand-set list works until then |
| 8 | Own-product promotion at session end ([A11][mc-a]) | Point finished players to our other products | Already-played view, at most one card a day | Supercell and Playrix cross-promotion (A11) | S | cloud#9826 |

## Build now

Items 1 to 3 are built (share landing, challenge link, tomorrow teaser); this section lists what is left.

- **Share landing.** `ShareResult` (PuzzleService) writes `result_shares` from the player's own accepted
  finish and returns its id; the link is `/daily?ref=<id>`, so the first-touch cookie credits the visit
  and any sign-up to the share (`account_attribution.ref`). `share_count` counts share taps. The
  landing (`features/daily/components/shared-result-landing.tsx`) reads `GetSharedResult`, which
  returns only card facts. Measure: `result_shares` joined to `account_attribution.ref`.
- **Tryit conversions (cross-lane, built).** A Tryit handoff lands as `utm_source=tryit&ref=<uuid>`;
  the consent-gated `puzzled_attr` cookie keeps it and `account_attribution` stores it at sign-up. A
  share link's `ref` has no `utm_source=tryit`, so the two never mix (`Attribution::tryit_ref`). When
  the account is created with a Tryit ref the server queues a `signup` row in `tryit_conversions`, sends
  it once with a 3 second cap (`POST tryit.fun/api/attribution/conversions`, the product's own
  `SYLPHX_API_KEY`, the `ref` only), and a ten-minute Compute schedule (`puzzled-tryit-conversions`) retries a 503, 429 or failed send for 29
  days. A first paid invoice queues `purchase` the same way (it sends once Plus is on sale).
- **Challenge.** The landing remembers the share in the browser; the result screen and the
  already-played view show both results when the same module and day are finished.
- **Tomorrow teaser.** `getTomorrowsFreeGame` in `lib/free-rotation.ts` reads the rotation for the next
  product day; the home page uses the same function.

4. **Save-your-streak ask** — server decides from streak length and recovery methods; client renders
   a quiet mark, then a card at the result screen, capped per week (`gamification`, `identity`).
5. **Usual-time reminder** — schedule the existing `daily-reminder` job per player at their median
   finish hour; invitation copy only, one-tap unsubscribe (`jobs_policy`, `jobs_db`).

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
      all 19 games for 7 days, then drops back to free; one grant per account; an honest "ends on
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
      gets 2 per month. Freezes must first count toward the streak: `compute_personal_streak` ignores them
      today, so an earned or bought freeze would do nothing. Build that first, then earn one per 7-day streak.
- [ ] **Plus-nudge emails** (S). Day 3 and day 7 of a streak, consent-gated, with the yearly price and
      no false urgency.
- [ ] **Price localisation** (M). Money price tiers for HKD, EUR, JPY, INR, BRL and MXN alongside
      USD and GBP; the site already has 5 locales; price per storefront, never converted at display time.
- [ ] **Team plan for schools and workplaces** (L, after launch). A seat-based plan in Money.

## Pricing tactics

Prices and the market citation (NYT Games, Times Puzzles, read 2026-09-26) live in
[MONETIZATION.md §3](north-star/MONETIZATION.md#3-price); change them only there. Tactics: show
the yearly plan first with its actual charge ([B03][mc-b]); keep the family plan as the upper tier
([B18][mc-b]); price per storefront, not by converting currency ([B20][mc-b]); the trial, discount and localised prices are on the
[Ships when Money is live](#ships-when-money-is-live) list; existing subscribers keep their price on an increase ([B23][mc-b]). We never price under the cited
market position because our cost is lower.

## Guardrails

- **No dark patterns:** no false urgency (a true countdown, such as a real trial end, is fine), no streak guilt, no paywall before or during
  the free daily finish, no selling the solution. Cancellation, export and deletion stay easy.
- **Ads:** free players only, on the archive and result screens, never during play, removed for Plus
  (see [MONETIZATION.md](north-star/MONETIZATION.md#ads)). Payments still go through Sylphx Money; no billing of our own.
- **Store and review policy:** if a store app ships, only the native review prompt at a happy moment,
  with no pre-question or incentive (Apple 5.6.1, Google In-App Review; catalogue [X24][mc-x] is `NOT`);
  subscription terms disclosed per Apple 3.1.2 and the Google Play subscriptions policy ([S5], [S7]).
- **UK DMCC Act 2024, Part 4 Chapter 2** (commencement pending, [S6]; build to it now): a pre-contract
  summary, a reminder before a trial converts and before each renewal of a longer term, ending in one
  step, and the cooling-off periods. A save offer is one skippable step, never an obstacle.
- **Consent:** reminders, win-back and attribution run only on recorded consent; quiet hours hold.
- **Cubeage is a separate company.** Any cross-promotion with a Cubeage title is a public link that
  carries no user data, unless a partner link with a data-sharing agreement and the user's consent
  exists (cloud#9826 item 9).
- **Public numbers have a source:** no player counts or ratings in copy unless rendered from their source.
