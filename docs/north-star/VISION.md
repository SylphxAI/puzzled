# Product vision — Puzzled

**Status:** Normative  
**Revision:** 2026-08-12  
**North Star Metric:** [Habitual Ritual Completers (HRC)](NORTH-STAR-METRIC.md)  
**Atomic input:** Daily Ritual Completers (DRC)

---

## 1. Ambition (true North Star quality)

Puzzled exists to become the **default daily home for light, positive, brain-training play**—the place a person opens for a few minutes, feels slightly sharper and more connected, and comes back most days of the week without being threatened, shamed, or paywalled through the first finish.

That sentence has three load-bearing parts:

1. **Daily home** — not a one-hit title, not a portal of random quizzes, not a news brand that happens to own puzzles. A home is a place you return to because *today* is waiting and *the rest of the suite* is there when you want more.
2. **Light, positive, brain play** — minutes, not grind; honest fail, not humiliation; competence, not gambling arousal. Entertainment “oracle” formats are allowed as play and forbidden as science.
3. **Most days of the week** — the economic and cultural unit is a **habit**, not a spike. A million people finishing one Wordle-shaped Monday and disappearing by Thursday is not winning. That is why the executive metric is [HRC](NORTH-STAR-METRIC.md), not same-day DRC.

**Catalog ambition is unbounded:** every game that fits the *daily light brain ritual* class should eventually live here—word puzzles, logic grids, pattern games, mini crosswords, the sudoku family, spatial puzzles, CJK rituals, and light entertainment oracle formats (horoscope-style, “who were you,” playful predictors). Entertainment modules are **fun, not authoritative**.

The named destination list is [CATALOG.md](CATALOG.md) (~115 slugs). That file is the greedy end-state. Home still shows a small today-set. Slugs there are not live until protocol-complete.

**Capability ambition is not unbounded feature sprawl.** The world is covered by a **single module protocol** (day key, run, finish, result card, entitlement), not by N independent apps. That is how “all the games of this type in the world” stays coherent (Simplicity × Depth).

**Implementation ambition is agent-native.** Conventional studio headcount is not a reason to shrink the declared catalog, defer accessibility, or leave a module half-wired. Agents change the price of *typing*; they do not change the price of *verification, content quality, attention on the home surface, or reversal*. A new module ships when it is protocol-complete. It does not ship as a stub with a promise.

**Monetization ambition:** Software-as-a-Service subscription, structurally similar to *The New York Times Games*: habit and free daily access first; paid value in archive, depth, stats, full-suite continuity, and ad-free calm—not pay-to-win, not a wall on the first daily finish, not loot.

---

## 2. Positioning statement

| | |
|--|--|
| **For** | People who want a short, uplifting mental break—commuters, coffee pauses, “I have five minutes,” partners who already text each other a result grid. |
| **Who** | Are not looking for hardcore competition, gacha, infinite grind, or a medical claim about their brain. |
| **Puzzled is** | A multi-game daily ritual platform with one account, one shared day, one finish authority, one share system, one subscription. |
| **Unlike** | Single-game Wordle clones (no home, fad decay). |
| **Unlike** | Hyper-casual ad farms (no respect, broken inputs). |
| **Unlike** | Hardcore mobile RPGs and ranked ladder games (wrong energy). |
| **Unlike** | Content farms that fake authority on personality, fortune, or “IQ.” |
| **We win when** | People complete today’s ritual often enough that **HRC** grows, and subscription feels like supporting *their* habit—not buying a trick. |

**Tone:** warm, clear, slightly witty; never shame streaks; never claim scientific truth for entertainment oracles; never pretend a billing error is a feature.

**Language of the product (player-facing):** “today’s,” “you finished,” “share,” “try another,” “unlock your history.” Not “grind,” “defeat,” “your streak is dying—pay now.”

---

## 3. Jobs to be done

A job is what a person hires Puzzled to do. Features that do not serve a job are noise.

| Job | When | Success looks like | Failure looks like |
|-----|------|--------------------|--------------------|
| **Take a clean mental break** | Commute, kettle, end of a meeting | Finished in minutes; mood up, not drained | Session that cannot end; ads that steal taps |
| **Have something to share** | After finish, with a specific person | Non-spoiler card that invites “I did it too” | Spoiler, install wall, or a card that looks like every other app |
| **Keep a private competence ritual** | Most mornings or evenings | Came back Thursday because Wednesday felt good | Returned only because a notification threatened a streak |
| **Go deeper when I want** | Weekend, insomnia, “one more” | Second module or archive without a new account | Catalog dump on a cold user; paywall on the only daily |
| **Play with people I already know** | After a share, or a household | Same day, optional compare, no public shame | Global ladder as the home screen |
| **Be entertained, honestly** | Playful curiosity | Oracle labeled as play; a smile | Destiny / medical / “scientifically you are…” |

HRC is the metric that says the first four jobs are happening **on a weekly cadence**. Share rate without HRC is a cocktail-party product: talked about, not lived in.

---

## 4. Category research (basis, not cargo-cult)

Public patterns below are **mechanisms to transfer or reject**. They are not proof that Puzzled already has NYT-scale players, and they are not a license to copy brand, content, or trade dress. Retrieved 2026-08-12.

### 4.1 NYT Games (primary analog)

Public product and business patterns that matter:

1. **Shared daily puzzle** — one puzzle per title per day; a global “today.”
2. **Suite, not single title** — Wordle, Connections, Strands, Mini, Spelling Bee, Crossword, and further titles. Wikipedia’s *The New York Times Games* page (retrieved 2026-08-12) reports, as of 2024, **over 10 million daily players** across platforms and **over one million premium subscribers**, with 2024 play counts in the billions across Wordle, Connections, and Strands. Treat those figures as *category existence proof*, not as Puzzled targets.
3. **Free hook + paid depth** — several dailies free; archives, full crossword access, deeper suite behind subscription ([NYT Games subscription marketing](https://www.nytimes.com/subscription/games); [help center free-vs-paid list](https://help.nytimes.com/360011158491-New-York-Times-Games/360052272251-New-York-Times-Games-Subscription), retrieved 2026-08-12).
4. **Non-spoiler social** — result grids/cards that invite talk without giving away the answer.
5. **Habit as a subscription on-ramp** — company narrative and trade press (e.g. Nieman Lab, 2025-09-08 family-plan reporting; Ivey “daily puzzle phenomenon,” 2025-03-24) treat games as a **retention and bundle engine**, not as a one-off viral. Family SKUs exist because *household ritual* retains; Puzzled may consider family only after a coherent individual Plus (see [MONETIZATION.md](MONETIZATION.md)).

**What we copy:** ritual structure, suite economics, share design, free daily finish, habit-before-wall.

**What we do not copy:** requirement to be a news brand; prestige crossword authority as the only ladder; hardcore competitive multiplayer as the center; their price points as our price (set commercially, document live).

**Mechanism we take seriously:** Wordle was a *distribution gift*; the suite is the *anti-fad*. A product that only copies Wordle’s share card without a home will inherit Wordle’s decay curve.

### 4.2 Viral mechanism (Wordle-class first principles)

Empirical pattern of Wordle-scale diffusion:

| Mechanism | Role | If violated |
|-----------|------|-------------|
| One shared day | Common knowledge (“today’s”) | No conversation object |
| Minutes-to-complete | Low commitment | Only hobbyists remain |
| Soft failure | Retry within limits; no paywall mid-fail | Rage quit or feel cheated |
| Shareable non-spoiler card | Others see *progress shape*, not the solution | Share dies or becomes vandalism |
| Zero install for first play | Web-first friction kill | Loop dies at the land |

Any module that violates these is **not** a Puzzled flagship ritual until fixed.

**Limit of the Wordle pattern:** it explains *first-week spread* (new DRC). It does not explain *year-two home* (HRC). Puzzled must implement the Wordle loop **and** the suite-return loop. See [GROWTH-AND-VIRALITY.md](GROWTH-AND-VIRALITY.md).

### 4.3 Other competitors (brief)

| Type | Example pattern | Lesson |
|------|-----------------|--------|
| Free multi-daily suites | Clone/alternative daily packs | Demand for *combination* dailies is real; pure free lacks a content budget without ads or a subscription. |
| Newspaper puzzle pages | Daily crossword + member archive | Same free/paid split; trust and cadence matter more than novelty. |
| Social word apps | “With Friends” modes | Optional social; do not make rivalry the Polar driver. |
| Infinite random quiz farms | Engagement without a day key | High noise, low shared culture — reject as primary. |
| Brain-training apps with clinical cosplay | Minutes + “scientifically proven IQ” | Wrong ethics; we will not compete there. |

### 4.4 Amplitude test (why HRC, not DRC, is Polar)

Amplitude’s North Star framework (Sholtz, [“Every Product Needs a North Star Metric”](https://amplitude.com/blog/product-north-star-metric), retrieved 2026-08-12) requires a Polar that:

1. **Aligns to realized customer value** — not mere opens.  
2. **Represents product strategy** — a stranger should read the metric and guess what we are building.  
3. **Leads revenue** — upstream of paid MAU and ARPU.

| Candidate | Value | Strategy | Leads revenue | Verdict |
|-----------|-------|----------|---------------|---------|
| DAU / sessions | No (opens) | “An app people touch” | Weak | Reject |
| DRC | Yes (finished today’s ritual) | Sounds like a single daily | Weakly (fad-compatible) | **Atom, not Polar** |
| Consecutive streak length | Partial | Invites shame mechanics | Distorted | Reject as Polar |
| Paid MAU | Money ≠ value | “A store” | Lagging | Reject as Polar |
| Catalog size | No | “A museum” | No | Reject |
| **HRC (4/7)** | Yes (the week contains the ritual) | “A home you return to most days” | Stronger (habit → subscribe) | **Polar** |

Full argument and formulas: [NORTH-STAR-METRIC.md](NORTH-STAR-METRIC.md).

---

## 5. Product promise (user-facing)

1. **Every day** there is something new worth opening.  
2. **A few minutes** is enough to feel finished and good.  
3. **If you want more**, the suite and optional practice are there—without trapping you.  
4. **You can share** how you did without spoiling friends.  
5. **You can play with friends** in light, parallel ways (same day, optional compare, later optional co-op)—not ladder anxiety.  
6. **Entertainment oracles** are labeled as play, never as science or destiny.  
7. **If you skip a day**, the product does not punish you into paying. The habit is yours; the streak is a souvenir, not a hostage.

---

## 6. Explicit non-goals

| Non-goal | Why |
|----------|-----|
| Hardcore esports / ranked ladders as core | Wrong retention, wrong tone, wrong Polar |
| Gambling / loot-box economics | Security, trust, regulation, brand |
| “Scientific” personality, IQ, or medical claims | Correctness and ethics floor |
| Infinite content-farm SEO spam | Erodes quality and Economy (attention) |
| Dark-pattern streak punishment | Violates the positive daily promise; would fake HRC |
| Shrinking catalog to look “minimal” | Fails Simplicity: capability must not shrink |
| Deferring protocol-complete modules because “we are a small team” | Agent-native Economy: typing is not the scarce budget |
| Treating DRC spikes as Polar success | Fad-compatible; fails strategy + leading-revenue tests |
| Making entertainment oracles the brand | Positioning drift; DFC must never replace HRC |

---

## 7. Agent-native catalog thesis

The scarce resources for catalog growth are **not** engineer-hours in the 2015 sense. They are:

| Budget | What it buys | What “cheap agents” do not erase |
|--------|--------------|-----------------------------------|
| Content | Daily puzzles that are fair, fresh, and on time | Editorial judgment, cultural sensitivity, spoiler control |
| Verification | Validators, fixtures, play oracles | The need for a failing test to be possible |
| Attention | Home surface slots, onboarding, support | Human working memory; more tiles ≠ more HRC |
| Runtime | Serve + submit + persist under load | Capacity planning |
| Reversal | Disable a module without bricking the app | Blast-radius design |

**Rule:** ship any module whose expected HRC lift (or strategic protocol proof) clears those budgets. “An agent can scaffold it tonight” is not a cost story. “This module has no result card and no server validator” is a delivery reject, regardless of how fast it was typed.

The declared end-state is **the class, not a five-game MVP forever**. Sequencing (S0→S5) protects the basis; it does not shrink the destination. See [STRATEGY-ROADMAP.md](STRATEGY-ROADMAP.md).

---

## 8. Relationship to engineering clean-break

Engineering (ADR-170) delivers:

- Sole Connect, sole Rust play authority  
- Server-side solutions and validation  
- Content store for day-keyed puzzles  
- Guest-legal free-rotation finish that can create a DRC day  

Product North Star demands those properties **because** HRC, DRC, and premium gating must be honest.  
Clean-break **must not** delete the catalog or the free daily ritual to “finish” architecture.

If a refactor cannot emit a qualifying finish, it cannot create a DRC day, and HRC becomes fiction.

---

## 9. Success picture (qualitative)

When Puzzled is “there”:

- A non-technical friend opens the site on a phone, finishes today’s featured puzzle in under five minutes, shares a card, and comes back **four or more days this week** without a threat campaign.  
- A second module is discovered *after* the first finish, not dumped on first paint.  
- A paying subscriber uses archive and stats because they *already* care about the habit (they are HRC, or recently were).  
- Adding a new module does not invent a new login, a new share system, or a new billing product.  
- Operators can recompute HRC and DRC from `game_sessions` in minutes when something breaks. A drop in HRC with stable DRC is a **return-loop** incident; a drop in DRC is a **finish-path** incident. Those are different loci.

Quantitative success is owned by [NORTH-STAR-METRIC.md](NORTH-STAR-METRIC.md) and [METRICS-TREE.md](METRICS-TREE.md).  
Evidence rules are owned by [EVIDENCE-AND-ORACLES.md](EVIDENCE-AND-ORACLES.md).

---

## 10. Failure picture (premortem)

Assume it is 24 months from this revision and Puzzled is not the daily home. Credible causes:

1. **Polar stayed at DRC** — teams shipped share tricks and one-day campaigns; weekly return never became anyone’s job.  
2. **Free floor was sold** — conversion rose for a quarter; HRC collapsed; brand became a tollbooth.  
3. **Catalog grew without protocol** — 30 skins, 30 share systems, 30 entitlement bugs; attention budget exploded.  
4. **Streak hostage mechanics** — HRC looked healthy until people described the product as stressful and left.  
5. **Entertainment oracles became the homepage** — DFC dwarfed DRC; the “brain ritual” claim became a lie.  
6. **Clean-break theater** — sole Connect, empty play; live P1 golden journey dead.  
7. **Guest identity rot** — DRC counted device churn as new love; HRC-auth told the truth and nobody looked.

Each cause has a counter-law in this package. If a future change would make one of these easier, it is probably illegal under [DELIVERY-AUTHORITY.md](DELIVERY-AUTHORITY.md).
