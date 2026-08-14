# Monetization — free floor and subscription

**Status:** Normative  
**Revision:** 2026-08-13  
**Model:** SaaS subscription (Games-class), habit before wall  
**Billing authority:** Sylphx Platform billing; app fail-closed on entitlement checks (ADR-170)

---

## 1. Economic thesis

Users do not pay for “a puzzle.”  
They pay for **continuity of a habit they already love**: history, depth, breadth, polish, and freedom from friction.

Therefore:

1. **Free path must create daily puzzle completers** without payment.  
2. **Paid path multiplies value for users habituated to daily puzzle completion.**  
3. **Never sell the solution** or charge mid-failure of the free daily attempt.

---

## 2. Free tier (floor — non-negotiable)

Every calendar day, without an active subscription, a user **must** be able to:

| Right | Detail |
|-------|--------|
| **Finish ≥1 puzzle_ritual** | Featured free rotation and/or always-free modules |
| **See a result card** | Share without paywall |
| **Start as guest** | Account optional for first ritual |
| **Understand the product** | Home explains today’s rituals |

**Forbidden:**

- Removing all free daily finishes to “force conversion.”  
- Ads that break play inputs or fake close buttons.  
- Pretend-free that requires card details before first finish.

**Ads (if any):** secondary revenue only; never the reason free finish is miserable. Prefer subscription cleanliness as brand default.

---

## 3. Premium value (what money buys)

| Capability | Free | Premium |
|------------|------|---------|
| Today’s free-rotation / free modules | Yes | Yes |
| Additional today’s modules (if gated) | Limited | Full suite |
| Archive / past day_keys | No or tiny sample | Full |
| Practice / unlimited undated | Limited | Full |
| Advanced stats & history export | Basic | Full |
| Streak cosmetics / freezes | Basic / limited freezes | Expanded (if offered) |
| Early access to new modules | No or delayed | Yes (optional) |
| Ad-free | N/A or ads | Yes |

Exact matrix per module is declared in registry metadata; **server enforces**.

### ADR-170 alignment

- Archive reads and non-rotation games may require premium.  
- Daily free-rotation game uses **product day-key** rotation (`Asia/Hong_Kong`, same SSOT as daily puzzle completers; free game flips at HKT midnight, not UTC). Remains free for everyone including guests.  
- Subscription lookup: Platform billing; **fail-closed to free** on uncertainty (Security × Correctness: do not grant premium on errors; do not block free floor on billing outages—billing outage degrades *premium only*).

---

## 4. Packaging (product)

| Package | Intent |
|---------|--------|
| **Free** | Habit + viral |
| **Puzzled Plus** (name TBD) | Full suite + archive + stats |
| **Future family/edu** | Only after Plus is coherent—do not split SKUs early |

Pricing: set commercially; document live price in ops, not in this doctrine file.  
**Economy:** price changes are commercial; entitlement *rules* are product doctrine.

---

## 5. Conversion moments (ethical)

Preferred:

- After several daily-puzzle-completer days: “Unlock your history.”  
- On archive tap: soft gate with preview.  
- On advanced stats: soft gate.

Disallowed:

- Fake urgency timers on first session.  
- Guilt copy about streaks to force pay.  
- Hiding the free daily behind a blurred paywall.

---

## 6. Metrics (supporting, not NSM)

See [METRICS-TREE.md](METRICS-TREE.md):

- Free → trial/paid conversion among users with high daily-puzzle-completer density  
- Paid retention / churn  
- Premium attach rate on archive intents  

**Do not** make revenue the North Star while daily puzzle completers are unproven.

---

## 7. Cost of catalog growth (Economy)

Each new module incurs:

| Budget | Examples |
|--------|----------|
| Content | Daily generation, editorial QA |
| Verification | Tests, validators, play oracle |
| Attention | Home surface space, support |
| Runtime | API/DB load |
| Reversal | Ability to disable module without bricking app |

Ship modules when expected **daily-puzzle-completer lift or paid lift** justifies those budgets—or when they are strategic protocol proofs.  
“We can build it in a day” is not a cost story.

---

## 8. Platform billing integration

- Entitlement source of truth: Platform subscription APIs.  
- Web uses Platform SDK; api verifies with service credentials as designed.  
- No parallel in-house card vault in the Puzzled app.  
- Refunds/chargebacks: Platform policies; app respects entitlement revocation promptly.
