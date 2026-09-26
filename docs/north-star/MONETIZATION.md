# Monetization: free daily puzzle and Puzzled Plus

**Status:** Normative commercial policy (owner `standards/commercial.md`)
**Revision:** 2026-09-26 (issue [#235](https://github.com/SylphxAI/puzzled/issues/235) decided: sell a paid tier)
**Model:** Consumer subscription in the NYT Games class. Today's featured puzzle is free; Puzzled Plus opens everything else.
**Seller:** Sylphx Limited, England and Wales, company 16438428, 128 City Road, London EC1V 2NX. VAT GB 502 7862 95.
**Billing system:** Stripe (the merchant-payments exception in the owner architecture standard). Stripe holds the live prices, customers, subscriptions, invoices and refunds. Puzzled's api owns the entitlement and an append-only money ledger.

---

## 1. Objective

Earn subscription revenue from players who already have the daily habit,
without taking anything away from the free daily puzzle. There are no ads and
no other revenue source (owner direction, 2026-09-26).

Players do not pay for "a puzzle". They pay for more of a habit they already
have: every game, every past day, stats across all of it, and sharing it with
family.

1. The free path must keep creating daily puzzle completers without payment.
2. The paid path multiplies value for players who already come back daily.
3. Never sell the solution, and never charge in the middle of a free attempt.

## 2. What is free and what is paid

| | Free (everyone, guests included) | Puzzled Plus |
|---|---|---|
| Today's featured puzzle (the day's rotation game, `Asia/Hong_Kong` day key) | Yes | Yes |
| Every other game, today | No | Yes, all of them |
| Past days (archive) | No | Every past day |
| Stats and streaks | For what you play | For every game |
| Family plan | No | Family plan: up to 4 people, each with their own stats |

- The Rust api is the only admission point
  (`PuzzleConnectService::enforce_play_access`, rule in
  `puzzled-core` `billing_access::policy::play_access`). A refused request is
  403 `plus_required` (another game) or `plus_required_archive` (a past day);
  the web renders the unlock path from the same rule, never a dead end.
- An entitlement read that fails refuses paid play (fail closed to the free
  floor). The free daily puzzle never reads billing.
- While Stripe is not configured, nothing is sold, so nothing is locked.
- Nothing a player has finished is ever taken away: results and stats stay
  whether or not they subscribe.

## 3. Price

Set against the market on 2026-09-26, read that day:

| Competitor | Published price (2026-09-26) | Source |
|---|---|---|
| NYT Games (US) | App Store in-app "Games - Monthly" US$5.99 (also a US$4.99 variant); crossword yearly US$39.99 | apps.apple.com/us/app/nyt-games-word-number-logic/id307569751 |
| NYT Games (US, web) | US$6 every 4 weeks or US$50 a year; Games Family US$10 a month for up to 4 people (monthly only) | Nieman Lab 2025-09-08, Axios 2025-09-08; nytimes.com/subscription/games is script-rendered and could not be read directly |
| NYT Games (UK) | App Store "Games - Monthly" £2.99 | apps.apple.com/gb/app/nyt-games-word-number-logic/id307569751 |
| Times Puzzles (UK) | £3.99, £4.99 or £6.99 a month after a 7-day trial | apps.apple.com/gb/app/times-puzzles/id1531296302 |

Positioning: our breadth (19 games in the registry) matches the market, but the brand is
weaker than NYT's, so we price a little under NYT in dollars and at the low
end of Times Puzzles in pounds. We do not undercut on cost.

| Plan | USD | GBP |
|---|---|---|
| Puzzled Plus, monthly | 4.99 | 3.99 |
| Puzzled Plus, yearly | 39.99 | 32.99 |
| Puzzled Plus Family (up to 4 people), monthly | 7.99 | 6.49 |
| Puzzled Plus Family, yearly | 64.99 | 52.99 |

- Prices include VAT (Stripe `tax_behavior=inclusive`). The pricing page shows
  pounds for `en-GB` and dollars elsewhere, and checkout charges the currency
  shown.
- The live price is the Stripe price under each lookup key
  (`puzzled_individual_monthly`, `puzzled_individual_yearly`,
  `puzzled_family_monthly`, `puzzled_family_yearly`); `scripts/stripe-setup.ts`
  writes them. The pricing page reads them through `BillingService.ListPlans`
  and never prints a hard-coded amount.
- A price change creates a new Stripe price that takes over the lookup key;
  existing subscribers keep their price until they change plan. Players get
  at least 30 days' notice before a new price applies to their renewal.
- No free trial and no discount codes at launch.

## 4. Cancellation, refunds and UK consumer law

- Cancel at any time in Settings > Subscription. Access runs to the end of the
  paid period and nothing more is charged.
- Cancellation right: an account's first subscription can be cancelled within
  14 days of starting it for a full refund, however much was played
  (Consumer Contracts Regulations 2013). The api refunds every paid invoice of
  that subscription through Stripe, ends access at once, and appends negative
  ledger rows. A later subscription has no refund window.
- The Stripe Customer Portal handles payment methods, invoices and plan
  changes; cancellation stays in Settings so the refund rule applies.
- An account with a subscription that still renews cannot be erased until it
  is cancelled. On erasure, subscription and ledger rows are kept for six
  years (UK tax records) with the player id removed.
- Terms, Privacy and checkout name Sylphx Limited, state VAT-inclusive prices,
  automatic renewal, the 14-day right, and UK GDPR with the ICO.

## 5. Money and entitlement (commercial standard)

- Stripe webhooks (`POST /webhooks/stripe`) are signature-verified and treated
  as hints: each event is read back from Stripe before a row changes.
  Returning from checkout also reads the subscription back
  (`GetSubscription{refresh}`), so access never waits on a webhook.
- `billing_subscriptions` holds the last read-back state per subscription;
  entitlement is derived from it (`active`, `trialing` or `past_due` inside the
  paid period). A row whose period has passed while Stripe still calls it live
  is read back before it can lock a player out.
- `billing_ledger` is append-only: one row per paid invoice and per refund,
  signed integer minor units, unique per Stripe source id.
- Family: the family-plan subscriber gets an invite link; up to 3 others join
  with their own accounts. The subscriber can remove members and reset the
  link. Members lose access when the plan ends.

### Referral attribution

A landing with campaign tags (`utm_*`, `ref`; Tryit links use
`utm_source=tryit&utm_medium=referral&utm_campaign=…&ref=<result id>`) is kept
first-touch for 30 days in the `puzzled_attr` first-party cookie, only after
analytics consent (declining clears it). Email sign-up stores it once in
`account_attribution`. Checkout copies the account's tags (or, without them,
the cookie) into the Stripe subscription metadata, which is read back into
`billing_subscriptions.attribution`. Gap: an OAuth sign-up completes at Sylphx
Identity with no Puzzled sign-up hook, so its account row is not written; its
subscription still carries the cookie's tags. `/daily` redirects to today's
free game and keeps the query string.

## 6. Conversion moments (ethical)

Allowed: the unlock panel on a paid game or past day (with today's free game
beside it), the archive page, and the pricing page linked from the footer.

Not allowed: fake urgency, streak guilt, hiding the free daily puzzle behind a
paywall, or card details before the first free finish.

## 7. Metrics (supporting, not the North Star)

See [METRICS-TREE.md](METRICS-TREE.md): paid conversion among players with
many completion days, paid retention and churn, and Plus attach on archive and
unlock views. Revenue does not replace daily puzzle completers as the North
Star.

## 8. Channels

- Web: Stripe Checkout (live).
- App Store and Google Play in-app purchase: not built. When a store app
  ships, its purchases must write the same entitlement (a store-receipt
  adapter beside the Stripe one), and the Sylphx platform may take this over
  (see the program's billing path and the `platform-request` issue linked
  from issue #235).

## 9. Cost of catalog growth

Each new module costs content, verification, attention, runtime and a way to
disable it without breaking the app. Ship modules when the expected lift in
daily puzzle completers or paid conversion justifies that.
