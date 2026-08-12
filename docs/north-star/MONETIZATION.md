# Monetization — free floor and subscription

**Status:** Normative  
**Revision:** 2026-08-12  
**Model:** SaaS subscription (Games-class), habit before wall  
**Billing authority:** Sylphx Platform billing; app fail-closed on entitlement checks (ADR-170)  
**Polar link:** Money follows [HRC](NORTH-STAR-METRIC.md). Revenue is not the Polar.

---

## 1. Economic thesis

Users do not pay for “a puzzle.”  
They pay for **continuity of a habit they already love**: history, depth, breadth, polish, and freedom from friction.

Therefore:

1. **Free path must create DRC days** without payment — otherwise nobody can become HRC.  
2. **Paid path multiplies value for people who already have (or are forming) that habit.**  
3. **Never sell the solution** or charge mid-failure of the free daily attempt.  
4. **Never make HRC a paid-only state.** A Polar that only paying users can enter is a store metric wearing a product name.

NYT Games is the structural analog (free dailies + paid archive/suite; retrieved 2026-08-12 from NYT Games marketing and help center). Their price points, bundle, and family SKU are **not** our prices. They prove the *shape*.

---

## 2. Value metric and packaging model

| Question | Answer |
|----------|--------|
| Who buys? | The habituated individual (HRC or near-HRC), later maybe a household |
| What they buy | Continuity: archive, full today’s suite, stats, ad-free calm |
| Value metric (packaging) | **Access to the rest of the habit**, not seats, not “puzzles consumed” |
| Model | Freemium + optional annual. Not usage-metered. Not pay-per-solve. |
| Why not usage meters | A meter on finishes would tax DRC and destroy Polar honesty |
| Why not seats first | Solo ritual is the core; family is a later entitlement extension |

Live currency amounts live in ops and the billing product, **not** in this doctrine file. This file owns **fences and ethics**. Changing fences is a product-doctrine change. Changing $N is a commercial change.

---

## 3. Free tier (floor — non-negotiable)

Every calendar day, without an active subscription, a user **must** be able to:

| Right | Detail |
|-------|--------|
| **Finish ≥ 1 `puzzle_ritual`** | Featured free rotation and/or always-free modules |
| **See a result card** | Share without paywall |
| **Start as guest** | Account optional for first ritual |
| **Understand the product** | Home explains today’s rituals |
| **Become HRC** | Four free DRC days in a week must be *possible* |

**Current rotation (implementation, not the floor itself):**  
`word-guess`, `word-groups`, `queens`, `sudoku`, `crossword` — product `day_key` day-of-year, `Asia/Hong_Kong`, including guests. Membership may change; **absence of any free finish** may not.

**Forbidden:**

- Removing all free daily finishes to “force conversion.”  
- Ads that break play inputs or fake close buttons.  
- Pretend-free that requires card details before first finish.  
- Counting a blurred, unplayable daily as “free.”  
- Selling streak freezes as the only way to remain HRC.

**Ads (if any):** secondary revenue only; never the reason free finish is miserable. Prefer subscription cleanliness as brand default. If ads ship, they are a Reliability and attention tax — name those budgets.

---

## 4. Premium value (what money buys)

| Capability | Free | Premium |
|------------|------|---------|
| Today’s free-rotation / free modules | Yes | Yes |
| Additional today’s modules (if gated) | Limited | Full suite |
| Archive / past `day_key`s | No or tiny sample | Full |
| Practice / unlimited undated | Limited | Full |
| Advanced stats & history export | Basic | Full |
| Streak cosmetics / freezes | Basic / limited freezes | Expanded (if offered) — **never** required to keep HRC |
| Early access to new modules | No or delayed | Yes (optional) |
| Ad-free | N/A or ads | Yes |

Exact matrix per module is declared in registry metadata; **server enforces**.

### ADR-170 alignment

- Archive reads and non-rotation games may require premium.  
- Daily free-rotation game uses **product day-key** rotation (`Asia/Hong_Kong`, same SSOT as DRC/HRC; free game flips at HKT midnight, not UTC). Remains free for everyone including guests.  
- Subscription lookup: Platform billing; **fail-closed to free** on uncertainty (Security × Correctness: do not grant premium on errors; do not block free floor on billing outages — billing outage degrades *premium only*).

---

## 5. Packaging (product)

| Package | Intent |
|---------|--------|
| **Free** | Habit + viral; must be able to produce HRC |
| **Puzzled Plus** (name TBD) | Full suite + archive + stats + ad-free |
| **Future family / edu** | Only after Plus is coherent — do not split SKUs early. Family = multiple profiles, each with their own DRC series (see protocol). |

Pricing: set commercially; document live price in ops.  
**Economy:** price changes are commercial; entitlement *rules* are product doctrine.

Annual vs monthly: allowed. Discount arithmetic belongs in the commercial sheet, not here. Cancellation must leave **free floor intact** the same day — no “punish churn by deleting today.”

---

## 6. Conversion moments (ethical)

Preferred (these are people who already have a habit to continue):

- After several DRC days, especially once HRC: “Unlock your history.”  
- On archive tap: soft gate with preview.  
- On a gated today’s module after a free finish: “Play the rest of today’s set.”  
- On advanced stats: soft gate.

Disallowed:

- Fake urgency timers on first session.  
- Guilt copy about streaks to force pay.  
- Hiding the free daily behind a blurred paywall.  
- Charging to see the result card of a free finish.  
- “You will lose HRC unless you pay.” HRC is a measurement, not a status we revoke.

**Hypothesis to instrument (S3):** conversion rate among users who were HRC in the prior 14 days should exceed conversion among one-day DRC users. If the reverse is true, the paywall is catching confused people, not habituated ones — fix the moment, not the Polar.

---

## 7. Metrics (supporting, not Polar)

See [METRICS-TREE.md](METRICS-TREE.md):

- Free → trial/paid conversion among **HRC** (primary) and among high DRC-density users (diagnostic)  
- Paid HRC / paid DRC (must not collapse vs free)  
- Paid retention / churn  
- Archive-gate conversion (intent → subscribe)  
- Refund / chargeback (trust)

**Do not** make revenue the North Star while HRC is unproven.  
**Do not** celebrate conversion that coincides with a free-floor regression.

---

## 8. Cost of catalog growth (Economy)

Each new module incurs:

| Budget | Examples |
|--------|----------|
| Content | Daily generation, editorial QA |
| Verification | Tests, validators, play oracle |
| Attention | Home surface space, support |
| Runtime | API/DB load |
| Reversal | Ability to disable module without bricking app |

Ship modules when expected **HRC lift or paid lift** justifies those budgets — or when they are strategic protocol proofs.  
“We can scaffold it in a day” is not a cost story.  
A paid-only module that never creates a free DRC day cannot create HRC; it can only deepen people who already pay. That is allowed as *depth*, not as *growth of Polar*.

---

## 9. Platform billing integration

- Entitlement source of truth: Platform subscription APIs.  
- Web uses Platform SDK; api verifies with service credentials as designed.  
- No parallel in-house card vault in the Puzzled app.  
- Refunds/chargebacks: Platform policies; app respects entitlement revocation promptly.  
- Downgrade: next product day, free floor works; archive fails closed; no data-delete surprise on the same day as cancel (export path is a Plus promise).

---

## 10. Premortem (monetization)

If monetization “succeeds” and the product fails:

1. Free floor quietly vanished; DRC became paid-only; HRC-auth looked “high quality” because only payers remained.  
2. Ads made the free finish miserable; share died; habit died.  
3. Streak freeze became a hostage SKU.  
4. Family SKU launched before individual Plus made sense; identity merged a household into one fake HRC.  
5. Usage-priced finishes taught people not to complete.

Each of these is already illegal above. If a future PR does one of them, reject it under [DELIVERY-AUTHORITY.md](DELIVERY-AUTHORITY.md) F2 / ethics.
