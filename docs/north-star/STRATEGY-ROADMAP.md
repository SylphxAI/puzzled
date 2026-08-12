# Strategy roadmap (capability order)

**Status:** Normative sequencing guidance (not a calendar commitment)  
**Revision:** 2026-08-12  
**Rule:** Ambition stays full; **order** protects the basis (DRC → suite → paid).

---

## 1. Why sequence matters

Building “all games of this type” without a working **daily finish + share + event** basis produces a museum of half-wired titles.  
Building paywalls before DRC produces a quiet store.

This roadmap is the **evolvability path**: each stage unlocks the next without dual systems.

---

## 2. Stages

### Stage S0 — Instrument and prove the unit

| Deliver | Done when |
|---------|-----------|
| Day key SSOT in api | Documented + single implementation |
| `ritual.completed` (or table equivalent) | Recomputable DRC for 7 days |
| One flagship free daily | P1 golden journey live |
| Result card v1 | Non-spoiler share works |

**Exit:** [NORTH-STAR-METRIC.md](NORTH-STAR-METRIC.md) S0.

### Stage S1 — Habit

| Deliver | Done when |
|---------|-----------|
| Streak (gentle) | Visible; no dark punish-to-pay |
| Home “today” suite entry | User can find free ritual in one hop |
| D1/D7 ritual retention dashboards | Alertable |

**Exit:** S1 in NSM doc; retention curves exist (values may be low; honesty > theater).

### Stage S2 — Suite under protocol

| Deliver | Done when |
|---------|-----------|
| ≥3 puzzle_ritual modules fully protocol-compliant | Each has server validate + card |
| Module registry metadata for free/premium | Server enforced |
| Entertainment oracles optional (DFC only) | DRC unpolluted |

**Exit:** New module can ship without changing auth/share/billing cores.

### Stage S3 — Subscription

| Deliver | Done when |
|---------|-----------|
| Archive / depth gates | Fail-closed; free floor intact |
| Platform billing wired | Entitlement oracle green |
| Conversion cohorts by DRC density | Reviewable monthly |

**Exit:** Monetization does not reduce free DRC floor.

### Stage S4 — Catalog scale

| Deliver | Done when |
|---------|-----------|
| Content pipeline SLA for day_key ahead | Reliability |
| Module quality bar automated where possible | Economy of attention |
| Disable switch per module | Blast radius control |

**Exit:** Catalog growth is operationally boring (good).

### Stage S5 — Social depth (optional)

Parallel compare, light co-op, clubs — only after S1–S2.  
Must not redefine DRC.

---

## 3. Parallel tracks (non-blocking)

| Track | Notes |
|-------|-------|
| Custom domain serving | Platform domain_hostnames + DNS verify; not a substitute for DRC |
| Performance budgets | Finish path SLO under load tests |
| Localization | After protocol stable; day_key remains SSOT |

---

## 4. Kill / pivot criteria

| Signal | Response |
|--------|----------|
| Cannot get free users to first finish | Fix land/TTFF before any new modules |
| DRC flat while catalog grows | Protocol or UX broken—stop adding modules |
| Paid users’ DRC collapses | Reverse toxic gates |
| Share converts to zero landings | Card/deep link broken—Sev-2 growth |

---

## 5. Mapping to engineering

| Stage | Engineering emphasis |
|-------|----------------------|
| S0–S1 | ADR-170 play path, content store, events |
| S2 | Dispatch table, core validators, registry |
| S3 | Billing entitlement, archive APIs |
| S4 | Content tool, ops flags, load |

Delivery authority still protects the catalog during all stages.
