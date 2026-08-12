# Growth and virality

**Status:** Normative product doctrine  
**Revision:** 2026-08-12  
**North Star link:** Growth *feeds* [DRC](NORTH-STAR-METRIC.md); it does not replace it.

---

## 1. First principle

Viral daily games do not grow primarily because ads are clever.  
They grow because **completing today creates a social object** (the result card) that makes **non-players curious about the same day key**.

Puzzled’s growth system optimizes:

\[
\text{Finish} \rightarrow \text{Share} \rightarrow \text{Land} \rightarrow \text{First finish (new DRC)}
\]

Not:

\[
\text{Install} \rightarrow \text{Tutorial wall} \rightarrow \text{Permission spam}
\]

---

## 2. The growth loop (detailed)

### 2.1 Loop steps

| Step | User experience | System duty |
|------|-----------------|-------------|
| 1. Discovery | Link, QR, social post, friend | Fast TTFB; correct module deep link |
| 2. Land | Today’s puzzle visible immediately | Guest play allowed; no forced signup before first ritual |
| 3. Finish | Minutes; honest fail allowed | Server validation; ritual.completed |
| 4. Card | “Share result” obvious | Non-spoiler card; copy + native share |
| 5. Social | Friend sees pattern, not answer | Brand + day + module readable |
| 6. Return | Friend plays same day key | Same content binding |
| 7. Habit | Tomorrow’s open | Optional gentle reminder (Platform engagement; no dark patterns) |
| 8. Suite | “Try today’s other games” | Home shows multi-module without overwhelm |
| 9. Subscribe | After habit | Paywall on archive/depth—not on first daily finish |

### 2.2 K-factor thinking (without fake precision)

Track:

- **Share rate** = shares / ritual finishes  
- **Land rate** = distinct landings from share UTM/ref / shares  
- **Convert rate** = new DRC / landings from share  

Product wins when the product of these is healthy—not when any single vanity spikes.

**Economy:** Paid acquisition is allowed later; organic loop quality remains the basis. Cost claims for UA must state budget, measurement, and tradeoff (Economy principle).

---

## 3. Share card product rules

Inherited and expanded from [RITUAL-AND-MODULE-PROTOCOL.md](RITUAL-AND-MODULE-PROTOCOL.md):

1. **Default non-spoiler.**  
2. **One primary CTA** after finish: Share.  
3. **Secondary:** copy text, save image if offered.  
4. **Never** require account solely to generate a card if the finish was guest-legal.  
5. **Consistent chrome** (Puzzled mark, day key, module name).  
6. **Accessibility:** text alternative for visual grids.

---

## 4. Social modes (ordered ambition)

| Priority | Mode | Notes |
|----------|------|-------|
| P0 | Parallel solo + share | NYT Wordle pattern; required |
| P1 | Compare with friends (opt-in) | Same day scores; no public shame board by default |
| P2 | Light co-op / two-player | e.g. future Crossplay-like; must not block solo DRC |
| P3 | Clubs / async groups | After P0–P1 proven |

**Hardcore global leaderboards** as the primary social surface are **non-goals** for brand tone. Optional ranked views may exist for power users behind clear navigation—not the home ritual.

---

## 5. Onboarding

| Do | Don’t |
|----|-------|
| First paint = play | Multi-screen lore |
| Signup after first delight | Email gate before play |
| Explain rules in context | PDF manual |
| Offer second module only after first finish | Dump full catalog on cold users |

**Aha moment (product hypothesis):** *First ritual finish + optional share.*  
Instrument; do not change DRC definition if aha metrics evolve.

---

## 6. Notifications and re-engagement

- Prefer **Platform** engagement tooling for campaigns (ADR-170 streak-at-risk note).  
- Copy: invitation, not threat (“Today’s puzzle is ready” ≠ “Your streak is dying, pay now”).  
- Quiet hours and one-tap unsubscribe: Reliability + Security of attention.  
- Win-back emails exist as JobsService capability; content must stay on-brand.

---

## 7. SEO and content farms

- Evergreen explainers and fair “what is X puzzle” pages are fine.  
- **Do not** build mass generated “quiz SEO” that contradicts entertainment honesty or floods DFC.  
- Canonical daily play URLs should remain stable for sharing.

---

## 8. Anti-abuse

| Threat | Direction |
|--------|-----------|
| Share bots | Rate limits; anomaly on share rate |
| Multi-account DRC farming | Guest + auth signals; don’t over-block real users |
| Spoiler accounts | Report + mod tools later; card design reduces damage |
| Scraping solutions | Server never ships solutions; watch for side channels |

Security floor: no secret leakage in cards or client bundles.

---

## 9. What “viral success” means for Puzzled

Not: one spike week and silence.  
Yes: **sustained DRC** with a measurable organic contribution and improving D7 ritual retention—while users still describe the product as *fun and light*.
