# Growth and virality

**Status:** Normative product doctrine  
**Revision:** 2026-08-12  
**North Star link:** Growth *feeds* [HRC](NORTH-STAR-METRIC.md). New DRC without return is a fad engine, not a win.

---

## 1. First principle

Viral daily games do not grow primarily because ads are clever.  
They grow because **completing today creates a social object** (the result card) that makes **non-players curious about the same day key**.

They *stay* because **tomorrow’s ritual is waiting in the same home**, and because a second module exists when the first is done.

Puzzled therefore has **two loops**, not one:

\[
\textbf{Spread: }\mathrm{Finish}\rightarrow\mathrm{Share}\rightarrow\mathrm{Land}\rightarrow\mathrm{First\ DRC}
\]

\[
\textbf{Habit: }\mathrm{First\ DRC}\rightarrow\mathrm{Return}\rightarrow\mathrm{4\ DRC\ days\ in\ }W(D)\rightarrow\mathrm{HRC}
\]

Optimizing spread while ignoring habit produces Wordle-without-a-home.  
Optimizing habit while ignoring spread produces a quiet, correct monastery.  
The Polar is HRC; both loops are required.

Not this:

\[
\mathrm{Install}\rightarrow\mathrm{Tutorial\ wall}\rightarrow\mathrm{Permission\ spam}
\]

---

## 2. The spread loop (detailed)

### 2.1 Steps

| Step | User experience | System duty |
|------|-----------------|-------------|
| 1. Discovery | Link, QR, social post, friend | Fast TTFB; correct module deep link |
| 2. Land | Today’s puzzle visible immediately | Guest play allowed; no forced signup before first ritual |
| 3. Finish | Minutes; honest fail allowed | Server validation; ritual row |
| 4. Card | “Share result” obvious | Non-spoiler card; copy + native share |
| 5. Social | Friend sees pattern, not answer | Brand + day + module readable |
| 6. Return (same day) | Friend plays **the same day key** | Same content binding |
| 7. First DRC | Friend’s qualifying finish | Guest identity stable |

### 2.2 Rates (without fake precision)

Track:

- **Share rate** = shares / ritual finishes  
- **Land rate** = distinct landings from share UTM/ref / shares  
- **Convert rate** = new DRC / landings from share  

The product of these is a **diagnostic viral coefficient**, not the Polar. A coefficient that rises while first-DRC → HRC conversion falls is a party that does not become a household.

**Economy:** Paid acquisition is allowed later; organic loop quality remains the basis. Cost claims for user acquisition must state budget, measurement, and the principle traded (usually Economy vs Velocity). Do not buy DRC that cannot become HRC — that is renting a spike.

### 2.3 Deep link rules

- Card for today → land on that module’s **today** (product `day_key`).  
- After HKT midnight, “today” has flipped; the card still *names* yesterday. Prefer opening yesterday only when the user is entitled to archive **and** the UI labels it as yesterday. Otherwise open new today and keep the card as conversation, not as a broken promise.  
- Never land on a generic homepage that hides the module the card named.  
- Never land on a signup wall.

---

## 3. The habit loop (the one Polar actually counts)

### 3.1 Steps

| Step | User experience | System duty |
|------|-----------------|-------------|
| 1. First DRC | “I finished today’s” | Record; offer card; do not dump catalog |
| 2. Soft second | “Try today’s other game?” after finish, one hop | Suite visible without overwhelm |
| 3. Tomorrow’s open | Home shows *today*, not yesterday’s leftover as if it were new | Optional gentle reminder (Platform engagement) |
| 4. Skip without hostage | Missed Wednesday | No “your streak is dying, pay” |
| 5. Fourth DRC day in window | Person becomes HRC | `compute_hrc` sees them; no ceremony required |
| 6. Subscribe (later) | “Unlock history / full suite” | [MONETIZATION.md](MONETIZATION.md) |

### 3.2 Activation metric

**First-DRC → HRC conversion (14 days):** among users whose first-ever DRC day is \(D_0\), the fraction who are in \(\mathrm{HRC}(D)\) for some \(D \in [D_0, D_0+13]\).

This is the activation input under the Polar. It is **not** the Polar (it is a cohort rate, not a daily stock).

If this conversion is near zero, **stop adding modules and stop buying traffic.** Fix return: home, reminder tone, second-module timing, finish reliability.

### 3.3 Suite as anti-fad

A single flagship can create DRC. A suite creates *reasons to return when the flagship is stale*.

Rules:

- Do not show the full catalog on first paint.  
- After first finish, offer **one** adjacent today’s module.  
- Home for returning users may show a small “today’s set” (free rotation + 1–2 others if entitled).  
- Module addition is justified by expected HRC lift or protocol proof, not by tile count.

### 3.4 Reminders

- Prefer **Platform** engagement tooling (ADR-170 streak-at-risk note: campaigns are not an app-owned hostage job).  
- Copy: invitation, not threat (“Today’s puzzle is ready” ≠ “Your streak is dying, pay now”).  
- Quiet hours and one-tap unsubscribe: Reliability + Security of attention.  
- Win-back exists as JobsService capability; content must stay on-brand.  
- A reminder that raises DRC but destroys trust (and later HRC-auth) is a failed reminder.

---

## 4. Share card product rules

Inherited and expanded from [RITUAL-AND-MODULE-PROTOCOL.md](RITUAL-AND-MODULE-PROTOCOL.md):

1. **Default non-spoiler.**  
2. **One primary CTA** after finish: Share.  
3. **Secondary:** copy text, save image if offered.  
4. **Never** require account solely to generate a card if the finish was guest-legal.  
5. **Consistent chrome** (Puzzled mark, day key, module name).  
6. **Accessibility:** text alternative for visual grids.  
7. **Do not** A/B spoiler cards to raise share rate. That is vandalism of the conversation object.

---

## 5. Social modes (ordered ambition)

| Priority | Mode | Notes |
|----------|------|-------|
| P0 | Parallel solo + share | NYT Wordle pattern; required |
| P1 | Compare with friends (opt-in) | Same day scores; no public shame board by default |
| P2 | Light co-op / two-player | Must not block solo DRC; must not redefine HRC as a team count |
| P3 | Clubs / async groups | After P0–P1 proven |
| Later | Family profiles | Separate DRC series per person; household SKU only after Plus is coherent |

**Hardcore global leaderboards** as the primary social surface are **non-goals** for brand tone. Optional ranked views may exist for power users behind clear navigation—not the home ritual.

HRC is a count of **people**, never of clubs.

---

## 6. Onboarding

| Do | Don’t |
|----|-------|
| First paint = play | Multi-screen lore |
| Signup after first delight | Email gate before play |
| Explain rules in context | PDF manual |
| Offer second module only after first finish | Dump full catalog on cold users |
| Preserve guest day history on signup | Wipe DRC days at the moment we could have created HRC |

**Aha moment (product hypothesis):** *First ritual finish + optional share.*  
**Habit moment (product hypothesis):** *Fourth DRC day in a trailing week.*  

Instrument both. Do not change HRC or DRC definitions if aha metrics evolve.

---

## 7. SEO and content farms

- Evergreen explainers and fair “what is X puzzle” pages are fine.  
- **Do not** build mass-generated “quiz SEO” that contradicts entertainment honesty or floods DFC.  
- Canonical daily play URLs should remain stable for sharing.  
- SEO that lands people on yesterday’s spoiled answer page is a protocol violation of the conversation object.

---

## 8. Anti-abuse

| Threat | Direction |
|--------|-----------|
| Share bots | Rate limits; anomaly on share rate |
| Multi-account DRC farming | Guest + auth signals; don’t over-block real users |
| HRC farming via identity resets | Guest HRC is fragile; Polar reviews use HRC-auth when declaring habit success |
| Spoiler accounts | Report + mod tools later; card design reduces damage |
| Scraping solutions | Server never ships solutions; watch for side channels |

Security floor: no secret leakage in cards or client bundles.

---

## 9. What “viral success” means for Puzzled

Not: one spike week and silence.  
Yes: **rising or durable HRC** with a measurable organic contribution to *first DRC*, an improving first-DRC → HRC conversion, and users who still describe the product as *fun and light*.

A press moment that 10× DRC and 1.1× HRC is a **distribution event**. Celebrate it as distribution. Do not rewrite the Polar to make the spike look like winning.
