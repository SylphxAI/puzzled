# Product vision — Puzzled

**Status:** Normative  
**Revision:** 2026-08-12

---

## 1. Ambition (true North Star quality)

Puzzled exists to become the **default daily home for light, positive, brain-training play**—the kind of place people open for a few minutes every day, feel slightly sharper and more connected, and occasionally share a result with friends.

**Catalog ambition is unbounded:** every game that fits the *daily light brain ritual* category should eventually live here—word puzzles, logic grids, pattern games, mini crosswords, sudoku family, spatial puzzles, and light entertainment “oracle” formats (horoscope-style, “who were you in a past life,” playful predictors). Entertainment modules are **fun, not authoritative**.

**Capability ambition is not unbounded feature sprawl.** The world is covered by a **single module protocol** (day key, run, finish, result card, entitlement), not by N independent apps. That is how we hold “all the games of this type in the world” without collapsing into chaos (Simplicity × Depth).

**Monetization ambition:** Software-as-a-Service subscription, structurally similar to *The New York Times Games*: habit and free daily access first; paid value in archive, depth, stats, multi-theme, and ad-free continuity—not pay-to-win or hard walls on the first daily finish.

---

## 2. Positioning statement

| | |
|--|--|
| **For** | People who want a short, uplifting mental break—commuters, coffee pauses, “I have five minutes.” |
| **Who** | Are not looking for hardcore competition, gacha, or infinite grind. |
| **Puzzled is** | A multi-game daily ritual platform with one account, one day, one share system. |
| **Unlike** | Single-game Wordle clones (no home), hyper-casual ads (no respect), or hardcore mobile RPGs (wrong energy). |
| **Unlike** | Content farms that fake authority on personality/fortune topics. |
| **We win when** | People complete today’s ritual often enough that subscription feels like supporting *their* habit—not buying a trick. |

**Tone:** warm, clear, slightly witty; never shame streaks; never claim scientific truth for entertainment oracles.

---

## 3. Category research (basis, not cargo-cult)

### 3.1 NYT Games (primary analog)

Public product and business patterns that matter:

1. **Shared daily puzzle** — one puzzle per title per day; global conversation.  
2. **Suite, not single title** — Wordle, Connections, Strands, Mini, Spelling Bee, Crossword, etc.  
3. **Free hook + paid depth** — several dailies free; archives, full crossword access, deeper suite behind subscription.  
4. **Non-spoiler social** — result grids/cards that invite talk without giving away the answer.  
5. **Retention engine for a broader subscription** — games create habitual return; bundles and multi-product retention outperform news-only in reported company narrative.

**What we copy:** ritual structure, suite economics, share design, free daily finish.  
**What we do not copy:** requirement to be a news brand; prestige crossword authority as the only ladder; hardcore competitive multiplayer as the center.

### 3.2 Viral mechanism (Wordle-class first principles)

Empirical pattern of Wordle-scale diffusion:

| Mechanism | Role |
|-----------|------|
| One shared day | Common knowledge (“today’s”) |
| Minutes-to-complete | Low commitment |
| Soft failure | Retry within limits; no paywall mid-fail |
| Shareable non-spoiler card | Others see *progress shape*, not the solution |
| Zero install for first play | Web-first friction kill |

Any module that violates these is **not** a Puzzled flagship ritual until fixed.

### 3.3 Other competitors (brief)

| Type | Example pattern | Lesson |
|------|-----------------|--------|
| Free multi-daily suites | Clone/alternative daily packs | Demand for *combination* dailies is real; pure free lacks content budget without ads or sub. |
| Newspaper puzzle pages | Daily crossword + member archive | Same free/paid split; trust and cadence. |
| Social word apps | “With Friends” modes | Optional social; do not make rivalry the NSM driver. |
| Infinite random quiz farms | Engagement without day key | High noise, low shared culture—reject as primary. |

---

## 4. Product promise (user-facing)

1. **Every day** there is something new worth opening.  
2. **A few minutes** is enough to feel finished and good.  
3. **If you want more**, the suite and optional practice are there—without trapping you.  
4. **You can share** how you did without spoiling friends.  
5. **You can play with friends** in light, parallel ways (same day, optional co-op later)—not ladder anxiety.  
6. **Entertainment oracles** are labeled as play, never as science or destiny.

---

## 5. Explicit non-goals

| Non-goal | Why |
|----------|-----|
| Hardcore esports / ranked ladders as core | Wrong retention and tone |
| Gambling / loot-box economics | Security, trust, regulation, brand |
| “Scientific” personality/medical claims | Correctness and ethics floor |
| Infinite content farm SEO spam | Erodes product quality and Economy (attention) |
| Dark-pattern streak punishment | Violates positive daily promise |
| Shrinking catalog to look “minimal” | Fails Simplicity test: capability must not shrink |

---

## 6. Relationship to engineering clean-break

Engineering (ADR-170) delivers:

- Sole Connect, sole Rust play authority  
- Server-side solutions and validation  
- Content store for day-keyed puzzles  

Product North Star demands those properties **because** DRC and premium gating must be honest.  
Clean-break **must not** delete the catalog or the free daily ritual to “finish” architecture.

---

## 7. Success picture (qualitative)

When Puzzled is “there”:

- A non-technical friend opens the site on a phone, finishes today’s featured puzzle in under five minutes, shares a card, and comes back tomorrow without a push campaign.  
- A paying subscriber uses archive and stats because they *already* care about the habit.  
- Adding a new module does not invent a new login, a new share system, or a new billing product.  
- Operators can see DRC, ritual retention, and share conversion in minutes when something breaks.

Quantitative success is owned by [NORTH-STAR-METRIC.md](NORTH-STAR-METRIC.md) and [METRICS-TREE.md](METRICS-TREE.md).
