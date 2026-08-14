# Puzzled North Star package

**Status:** Normative product + delivery doctrine (2026-08-13)  
**Scope:** What Puzzled *is*, what success *is*, and what must never be traded away.  
**Not this package:** Sylphx Platform infra runbooks; ephemeral PR checklists (see [history/](history/)).

---

## One line

**Puzzled is a light, positive, daily ritual of brain games—minutes a day, optional depth, unlimited catalog under one protocol—habit first, subscription second, shareable results without spoilers.**

**North Star Metric:** [daily puzzle completers](NORTH-STAR-METRIC.md).

---

## Package map (read order)

| # | Document | Role |
|---|----------|------|
| 1 | **[VISION.md](VISION.md)** | Ambition, category, competitors, what we are not |
| 2 | **[NORTH-STAR-METRIC.md](NORTH-STAR-METRIC.md)** | daily puzzle completers definition, oracle, anti-metrics, stages |
| 3 | **[RITUAL-AND-MODULE-PROTOCOL.md](RITUAL-AND-MODULE-PROTOCOL.md)** | Day key, game modules, finish, result cards, entertainment vs puzzle |
| 4 | **[GROWTH-AND-VIRALITY.md](GROWTH-AND-VIRALITY.md)** | Share loop, invite, social without hardcore PvP |
| 5 | **[MONETIZATION.md](MONETIZATION.md)** | Free floor, subscription value, fail-closed gating |
| 6 | **[METRICS-TREE.md](METRICS-TREE.md)** | Supporting metrics, dashboards, kill signals |
| 7 | **[STRATEGY-ROADMAP.md](STRATEGY-ROADMAP.md)** | Capability order S0–S5; kill/pivot signals |
| 8 | **[EVIDENCE-AND-ORACLES.md](EVIDENCE-AND-ORACLES.md)** | Layers: source / CI / deploy / live; golden journeys |
| 9 | **[DELIVERY-AUTHORITY.md](DELIVERY-AUTHORITY.md)** | Merge gates, game catalog floor, clean-break vs product |
| 10 | **[history/](history/)** | PR #64 attestation (historical only) |

**Engineering stack north star** (Connect / Rust / content tool):  
[ADR-170](../adr/ADR-170-clean-break-north-star.md), [ADR-169](../adr/ADR-169-capability-first-modular-ddd.md), [ADR-168](../adr/ADR-168-portfolio-puzzled-rust-north-star.md).  
Stack is *how we ship*; this package is *what winning means*.

**Repo entry:** [PROJECT.md](../../PROJECT.md).

---

## Principles applied here

Depth · Correctness · Simplicity · Evolvability · Observability · Performance · Reliability · Security · Economy  
(See org constitution; product doctrine below binds them to Puzzled.)

| Principle | Product binding |
|-----------|-----------------|
| Depth | Root cause of viral daily games = shared day + finish + non-spoiler card—not “more games.” |
| Correctness | daily puzzle completers and play outcomes are server-oracled; green CI ≠ live habit. |
| Simplicity | Five concepts carry an unbounded catalog; shrinking ambition is not simplicity. |
| Evolvability | New game = module under protocol; one authority for finish/share/entitlement. |
| Observability | `ritual.completed` and share/pay events must be queryable in minutes. |
| Performance | Daily content and finish path have explicit load shape; claim only measured. |
| Reliability | Today’s ritual down = product-incident class; degrade with honest UI. |
| Security | No client-trusted solutions; least privilege on billing/identity. |
| Economy | Each module prices content + verification + attention; “saved eng days” is not a cost story. |

---

## Authority

| Question | Authority |
|----------|-----------|
| What is the North Star Metric? | [NORTH-STAR-METRIC.md](NORTH-STAR-METRIC.md) |
| May we delete a game or gut play? | [DELIVERY-AUTHORITY.md](DELIVERY-AUTHORITY.md) |
| What is a legal game module? | [RITUAL-AND-MODULE-PROTOCOL.md](RITUAL-AND-MODULE-PROTOCOL.md) |
| Free vs paid? | [MONETIZATION.md](MONETIZATION.md) |
| Sole API transport / play authority? | ADR-170 |

Conflicts: **player-facing product floors outrank engineering convenience.**  
Stack clean-break may not hollow games or the free daily ritual.

---

## Change control

Material changes to the daily-puzzle-completer definition, free-tier ritual floor, or module protocol require:

1. Explicit PR description of metric/oracle delta  
2. Update to this package in the same change set  
3. No silent dual definitions in app code comments alone  

Revision history lives in git; bump the **Status** date line in this README when the package ships.
