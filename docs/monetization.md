# Monetization: free daily puzzle and Puzzled Plus

Commercial policy for the product, under the owner
[commercial standard](https://github.com/SylphxAI/owner/blob/main/standards/commercial.md).
Decided in [#235](https://github.com/SylphxAI/puzzled/issues/235): sell a paid tier.

- **Model:** consumer subscription in the NYT Games class. Today's featured puzzle is free; Puzzled Plus opens everything else.
- **Seller:** Sylphx Limited, England and Wales, company 16438428, registered office 128 City Road, London EC1V 2NX. VAT GB 502 7862 95.
- **Billing system:** Sylphx Money, the platform's payments service: catalogue, hosted checkout, subscription state, entitlements API, portal, Stripe Tax and ledger. Puzzled builds no billing of its own.
- **State:** the earlier direct-Stripe code was removed in [#292](https://github.com/SylphxAI/puzzled/pull/292) (Money cutover part 3), including the `/webhooks/stripe` handler. Billing is Sylphx Money only, and Puzzled polls Money for subscription state. Sections 3 to 5 describe the retired design; the prices and rules carry over to Money.

## 1. Objective

Earn subscription revenue from players who already have the daily habit,
without taking anything away from the free daily puzzle. Free players may also
see one labelled ad (see [Ads](#ads)); Puzzled Plus removes it.

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

Set against the market (prices read 2026-09-26; re-check before changing ours):

| Competitor | Published price | Source |
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
- Trials and discounts (a 7-day trial on the yearly plan, a win-back offer) are
  allowed once Sylphx Money is live. Each states its real end date and real
  price; the plan and price settings are in
  [growth.md](growth.md#ships-when-money-is-live).

## 4. Cancellation, refunds and UK consumer law

- Cancel at any time in Settings > Subscription. Access runs to the end of the
  paid period and nothing more is charged.
- Immediate supply: checkout records the player's express request for access
  to start at once and their acknowledgement that the 14-day cancellation
  right is lost (`immediate_supply_consent`). The consent is stored before
  checkout starts.
- No money-back guarantee. Cancellation ends renewal at the end of the paid
  period (`cancel_at_period_end`) and the api refunds nothing. Payments are
  non-refundable except where the law requires, as the public terms say.
  A refund request is handled case by case by support, and any refund is a
  new Money ledger entry (commercial standard).
- Sylphx Money's hosted portal handles payment methods, invoices and plan
  changes; cancellation stays in Settings so it is one flow.
- An account with a subscription that still renews cannot be erased until it
  is cancelled. Money retains legally required financial records under its own retention
  policy; Puzzled has no subscription or payment-ledger rows to retain.
- Erasure also deletes the player's Sylphx Auth sign-in, through Auth's
  privacy-request API, for every subject that names the player. The rows and
  Auth's deletion run in one transaction that commits only after Auth
  accepted (`account_deletion::erase_player`). Transient database errors and
  ambiguous Auth answers (no answer, timeout, 5xx, 408, 429) repeat the whole
  transaction a few times; Auth's idempotency key is fixed per subject, so
  asking again is safe. A database failure before Auth, or a definite Auth
  refusal (another 4xx) before any subject was accepted, erases nothing: the
  account and its sign-in stay whole and the person can repeat the request.
  What still fails after Auth may have deleted the sign-in keeps every row
  and the subject map, answers 500, and is logged ("run erase-player
  --subject") with the subjects; the operator finishes it with
  `sylphx jobs run erase-player -- --subject <auth subject>`, which prints
  counts only. When Auth serves its erasure delivery (`[privacy]` handler,
  platform spec), that delivery replaces the manual step.
- Terms, Privacy and checkout name Sylphx Limited, state VAT-inclusive prices,
  automatic renewal, the immediate-supply consent, and UK GDPR with the ICO.

## 5. Money and entitlement (commercial standard)

- Sylphx Money is the sole payments owner. Puzzled creates Money hosted
  checkout sessions, reads `catalogs/default` for prices, and asks
  `entitlement_grants:check` for Plus access. It holds no Stripe keys,
  processor webhooks, billing subscriptions or payment ledger.
- Checkout return reads Money's subscription status; a browser redirect
  cannot assert a paid entitlement. Cancellation at period end is a
  request to Money; Money owns invoice, refund and tax
  records. Puzzled stores only checkout consent evidence and family membership.
- Family: the family-plan subscriber gets an invite link; up to 3 others join
  with their own accounts. The subscriber can remove members and reset the
  link. Membership is not an entitlement: access still requires the owner's
  live family entitlement from Money.
- Money is called server-side with the dedicated `SYLPHX_MONEY_API_KEY`
  (`billing:read` + `billing:write`), never a browser or general platform key.
  The free daily puzzle never reads Money. The outage policy is stated below.

### Referral attribution

A landing with campaign tags (`utm_*`, `ref`; Tryit links use
`utm_source=tryit&utm_medium=referral&utm_campaign=…&ref=<result id>`) is kept
first-touch for 30 days in the `puzzled_attr` first-party cookie, only after
analytics consent (declining clears it). Sign-up stores it once in
`account_attribution`. Checkout passes the account's tags (or, without them,
the cookie) to Money's checkout-session attribution. A Google Ads click id
(`gclid`, `gbraid`, `wbraid`) on a landing is kept in the same cookie for 90
days, only after *marketing* consent (the SDK `marketing` preference, mirrored
to `puzzled:consent:marketing`; the banner grants analytics only today, so the
click id is not stored until a marketing choice is offered). Withdrawing
marketing consent removes it; declining everything clears the cookie. Checkout
sends it from the live cookie, never from the account row, as
`metadata.gclid` (or `gbraid` / `wbraid`) after a `[A-Za-z0-9_-]{1,100}`
check; Money has no `client_reference_id`. No Stripe subscription
metadata or local billing table is written. `/daily` redirects to today's
free game and keeps the query string.

## 6. Conversion moments (ethical)

Allowed: the unlock panel on a paid game or past day (with today's free game
beside it), the archive page, and the pricing page linked from the footer.

Not allowed: false urgency (a countdown or stock claim that is not true; a real
trial end date is fine), streak guilt, hiding the free daily puzzle behind a
paywall, or card details before the first free finish.

### Ads

Google AdSense, off until an ad account is configured (`ADS_ADSENSE_CLIENT_ID`
and `ADS_SLOT_ID` in the web environment). One labelled slot on the archive
index and one on the result screen (the finish card and the already-played
view). Never on a puzzle in play, never on the pricing or account pages, and
never for a Puzzled Plus subscriber ("no ads" is a Plus perk). The ad loads only
after the visitor accepts cookies. The site's Content Security Policy allows the
ad network's hosts only while ads are configured.

### Google Analytics and Ads conversions

Off until `GA_MEASUREMENT_ID` (GA4, `G-...`) or `GOOGLE_ADS_ID` (`AW-...`) is set in
the web environment; with neither, no Google script, request or CSP host exists.
The cookie banner has three equal choices: Decline, Settings (separate Analytics and
Advertising switches, both off) and Accept (analytics only, never advertising). gtag.js is
injected, and `config` sent, only after a stored choice grants something: GA4 needs
Analytics, Ads needs Advertising (`ad_storage`, `ad_user_data`); `ad_personalization`
is always denied and Google signals are off. Basic consent mode: unanswered or declined
loads nothing. There is no geo signal, so the denied defaults apply everywhere.
Google sees only the site origin plus public paths (`/`, `/pricing`, `/privacy`, `/terms`,
`/support`, `/login`, `/signup`), a fixed title and no referrer; game, share and account
addresses never reach it. Turn **enhanced measurement** and **Google signals** off in the
GA4 property. Events: `sign_up` (new account only, from Auth's new-account answer),
`trial_start` (value = the plan's post-trial price in the checkout currency, plan as item id)
and `purchase` on the checkout return, each once per Money checkout session (`s`); mark them as
Ads conversions. "Change cookie choice" on the privacy page withdraws consent, deletes
`_ga*` and `_gcl_*`, and reopens the banner.

## 7. Metrics (supporting, not the North Star)

See [metrics.md](metrics.md): paid conversion among players with
many completion days, paid retention and churn, and Plus attach on archive and
unlock views. Revenue does not replace daily puzzle completers as the North
Star.

## 8. Channels

- Web: Sylphx Money hosted checkout. Purchases open only when Money is configured.
- App Store and Google Play in-app purchase: not built. When a store app
  ships, Sylphx Money validates its receipts and serves the same
  entitlement.

## 9. Cost of catalog growth

Each new module costs content, verification, attention, runtime and a way to
disable it without breaking the app. Ship modules when the expected lift in
daily puzzle completers or paid conversion justifies that.

## When Money cannot answer

This is the intended behaviour, a business choice of player experience over a small leak:

- If the Money catalogue can't be read, Plus counts as not on sale. Nothing is locked, and the pricing page says "Purchases open shortly".
- If Money can't answer a Plus entitlement check, play is allowed. Each such allowance logs `event = "money_entitlement_unanswerable_allowed"` at warn level, so a free ride lasting a whole outage shows up in logs and alerts.

## Who pays

There is no launch grace and no existing-player exemption. Puzzled was never
promoted or launched before Plus sales opened, so no account has earlier
standing. The paywall applies to everyone:

- Today's featured puzzle is free for everyone, guests included.
- Every other game and the archive need a Plus entitlement (Money's
  `entitlement_grants:check`) while sales are open. Guests and new accounts are
  locked out of them, and so is an account with old play history.
- Any later free or discounted access is a Money entitlement grant (account,
  feature, expiry, approver), never a rule in the play gate.
