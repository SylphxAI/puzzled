# Puzzled North Star package

**Status:** Normative product + delivery doctrine (2026-08-12)  
**Revision thesis:** Habitual Ritual Completers is the executive North Star Metric; Daily Ritual Completers is the atomic input.  
**Scope:** What Puzzled *is*, what winning *is*, and what must never be traded away.  
**Not this package:** Platform infra runbooks; ephemeral PR checklists (see [history/](history/)).

---

## One line

**Puzzled is the default daily home for light, positive brain play—an unbounded catalog under one protocol, a minutes-a-day ritual that becomes a weekly habit, shareable without spoilers, subscription after habit—not a single-game fad and not a paywall wearing a puzzle.**

**North Star Metric:** [Habitual Ritual Completers (HRC)](NORTH-STAR-METRIC.md) — distinct users who complete a qualifying puzzle ritual on **≥ 4 of the last 7 product days**.

**Atomic input:** [Daily Ritual Completers (DRC)](NORTH-STAR-METRIC.md) — distinct users who complete ≥ 1 qualifying puzzle ritual on product day \(D\). HRC is a pure function of a user's DRC day-series. DRC is not a second Polar.

---

## Why this package exists

A daily-games product can look busy and still be dying. One viral title produces a spike of same-day finishes and then silence. A catalog of half-wired games produces a museum. A paywall before habit produces a quiet store. An engineering clean-break that deletes play produces a green pipeline and no product.

This package is the **decision law** that prevents those failures:

| Failure | Law that blocks it |
|---------|-------------------|
| Wordle-fad spike treated as winning | HRC, not raw DRC or DAU, is the executive metric |
| “More games” as strategy | Five protocol concepts carry an unbounded catalog |
| Paywall on the first daily finish | Free ritual floor is a product floor |
| Client-trusted scores | Server-authoritative finish is a product floor |
| Green CI claimed as habit | Evidence is layered: source / CI / deploy / live |
| Catalog gutted to finish architecture | Delivery authority: player floors outrank clean-break convenience |
| Dual metric definitions in comments | This package is the single source of truth |

Engineering stack (how we ship) lives in [ADR-170](../adr/ADR-170-clean-break-north-star.md). This package is **what winning means**. Stack may not hollow the ritual to look finished.

---

## Package map (read order)

| # | Document | Role |
|---|----------|------|
| 1 | **[VISION.md](VISION.md)** | Ambition, category, jobs, competitors, agent-native catalog, what we are not |
| 2 | **[NORTH-STAR-METRIC.md](NORTH-STAR-METRIC.md)** | HRC Polar, DRC atom, DFC split, oracles, anti-metrics, stages |
| 3 | **[RITUAL-AND-MODULE-PROTOCOL.md](RITUAL-AND-MODULE-PROTOCOL.md)** | Day key, module, run, result card, entitlement — the five concepts |
| 3a | **[CATALOG.md](CATALOG.md)** | Destination catalog (115 slugs); shipped floor vs dest; mark hygiene |
| 4 | **[GROWTH-AND-VIRALITY.md](GROWTH-AND-VIRALITY.md)** | Share loop feeds new DRC; suite + return convert DRC into HRC |
| 5 | **[MONETIZATION.md](MONETIZATION.md)** | Free floor, subscription value, fail-closed gating, HRC-density conversion |
| 6 | **[METRICS-TREE.md](METRICS-TREE.md)** | Inputs under HRC, dashboards, kill signals |
| 7 | **[STRATEGY-ROADMAP.md](STRATEGY-ROADMAP.md)** | Capability order S0–S5; S0 is instrumentation, not a seven-day wait |
| 8 | **[EVIDENCE-AND-ORACLES.md](EVIDENCE-AND-ORACLES.md)** | Layers; golden journeys; recomputable HRC/DRC |
| 9 | **[DELIVERY-AUTHORITY.md](DELIVERY-AUTHORITY.md)** | Merge gates, catalog floor, clean-break vs product |
| 9a | **[CUTOVER.md](CUTOVER.md)** | Sole-writer cut: aliases, Polar false twins, share, titles |
| 10 | **[history/](history/)** | PR #64 attestation (frozen; not living Polar) |

**Engineering stack north star** (Connect / Rust / content tool):  
[ADR-170](../adr/ADR-170-clean-break-north-star.md), [ADR-169](../adr/ADR-169-capability-first-modular-ddd.md), [ADR-168](../adr/ADR-168-portfolio-puzzled-rust-north-star.md).

**Repo entry:** [PROJECT.md](../../PROJECT.md).

---

## Controlled vocabulary

One meaning per term. Do not invent parallel names in dashboards, comments, or ADRs.

| Term | Meaning |
|------|---------|
| **Habitual Ritual Completers (HRC)** | Executive North Star Metric. Users with qualifying DRC on ≥ 4 of the trailing 7 product days ending \(D\). |
| **Daily Ritual Completers (DRC)** | Atomic input. Distinct users with ≥ 1 qualifying `puzzle_ritual` finish on day \(D\). |
| **Daily Fun Completers (DFC)** | Same shape as DRC for `entertainment_oracle` only. Never HRC, never DRC. |
| **Product day / `day_key`** | Calendar date `YYYY-MM-DD` in **`Asia/Hong_Kong`**, server-computed. |
| **`puzzle_ritual`** | Module class that can create a DRC day (hence can feed HRC). |
| **`entertainment_oracle`** | Fun, non-authoritative module class. Feeds DFC only. |
| **Qualifying finish** | Server-validated terminal success or honest exhausted fail on today's ritual content. |
| **Free ritual floor** | Every product day, a non-premium identity can finish ≥ 1 `puzzle_ritual` and receive a result card. |
| **Five concepts** | Day key · game module · ritual run · result card · entitlement. |
| **Layers** | source · CI · deploy · live. Evidence is per layer. |
| **S0** | Both HRC and DRC are recomputable from production rows. HRC = 0 is a valid compute. |
| **Destination catalog** | Every slug we will offer under the protocol. Listed in [CATALOG.md](CATALOG.md). A dest slug is not live. |

Former informal name **“weekly ritualists”** is **HRC**. Do not keep both names in dashboards.

---

## Principles applied here

Depth · Correctness · Simplicity · Evolvability · Observability · Performance · Reliability · Security · Economy  
(Org constitution; this table binds them to Puzzled. Correctness and Security are non-tradeable.)

| Principle | Product binding |
|-----------|-----------------|
| **Depth** | Durable daily-suite products win on *weekly habit of finishing*, not on a single shared day and not on catalog count. The causal spine is shared day + honest finish + non-spoiler card + a home that gives tomorrow a reason. |
| **Correctness** | HRC and DRC are server-oracled from the same finish rows. Green CI ≠ live habit. A computed HRC of 0 is honest. Dual definitions are a defect. |
| **Simplicity** | Five concepts carry an unbounded catalog. Two metric layers (Polar + atom) — not a dashboard zoo. Shrinking ambition or deleting games to look “minimal” is not simplicity. |
| **Evolvability** | New game = module under the protocol. Polar definition does not change when a module ships. One finish authority, one share system, one entitlement system. |
| **Observability** | Finish rows, HRC, DRC, share, and pay events must be recomputable in minutes. Dropping instrumentation to “save cost” trades this principle and Correctness; name the budget if anyone proposes it. |
| **Performance** | Daily serve + submit is the load shape that matters. Claim latency only from measurement. |
| **Reliability** | Today’s free ritual unservable is a product-incident class. Degrade with honest UI; do not pretend a 500 is a paywall. |
| **Security** | No client-trusted solutions, scores, or completion flags. Least privilege on billing and identity. Entitlement fail-closed to free; free floor survives billing uncertainty. |
| **Economy** | Each module prices **content + verification + attention + runtime + reversal** — not “agent-days saved.” Agent-native capacity raises the catalog ceiling; it does not excuse half-wired modules or skipped oracles. |

When principles conflict: **Correctness and Security do not yield.** Other conflicts name the traded principle, why, and when it returns. When unsure, default to Simplicity (fewer concepts, full capability).

---

## Authority

| Question | Authority |
|----------|-----------|
| What is the North Star Metric? | [NORTH-STAR-METRIC.md](NORTH-STAR-METRIC.md) — HRC |
| What is the daily atom? | Same file — DRC |
| May we delete a game or gut play? | [DELIVERY-AUTHORITY.md](DELIVERY-AUTHORITY.md) |
| What is a legal game module? | [RITUAL-AND-MODULE-PROTOCOL.md](RITUAL-AND-MODULE-PROTOCOL.md) |
| What games will we offer? | [CATALOG.md](CATALOG.md) — destination; shipped floor stays in protocol + delivery |
| Free vs paid? | [MONETIZATION.md](MONETIZATION.md) |
| Sole API transport / play authority? | ADR-170 |

Conflicts: **player-facing product floors outrank engineering convenience.**  
Stack clean-break may not hollow games or the free daily ritual.

---

## Change control

Material changes to the **HRC definition**, the **DRC definition**, the **4-of-7 threshold**, the **free-tier ritual floor**, the **module protocol**, or the **destination catalog families** require:

1. Explicit PR description of metric/oracle delta, including worked examples  
2. Update to this package in the same change set  
3. Update to the pure recompute helpers in `puzzled-core` when the formula changes  
4. No silent dual definitions in app comments, dashboards, or ADRs alone  

Revision history lives in git. Bump the **Status** date line in this README when the package ships.

---

## What this revision changed (2026-08-12)

| Before (living package tip) | After |
|-----------------------------|--------|
| Executive Polar = DRC (same-day finishers) | Executive Polar = **HRC** (4-of-7 finishers) |
| “Weekly ritualists” as a supporting metric | That quantity **is** the Polar; DRC remains the atom |
| S0 = “DRC recomputable for 7 consecutive days” | S0 = **oracles exist**; HRC may be 0; do not wait a week to call instrumentation done |
| Growth loop ended at “new DRC” | Growth loop must **convert DRC → HRC**; share without return is a fad engine |
| Monetization cohorts by DRC density | Conversion thesis is **HRC density**; free DRC floor still creates the path |

History under [history/](history/) is not rewritten.
