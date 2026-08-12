# Strategy roadmap (capability order)

**Status:** Normative sequencing guidance (not a calendar commitment)  
**Revision:** 2026-08-12  
**Rule:** Ambition stays full; **order** protects the basis (instrument → habit → suite → paid).  
**Polar:** [HRC](NORTH-STAR-METRIC.md). Sequence does not shrink the declared destination.

---

## 1. Why sequence matters

Building “all games of this type” without a working **daily finish + share + recomputable habit** basis produces a museum of half-wired titles.  
Building paywalls before HRC produces a quiet store.  
Waiting a week to call instrumentation done produces theater: S0 becomes a weather report.

This roadmap is the **evolvability path**: each stage unlocks the next without dual systems.  
Agent-native capacity means we do not skip stages because “a module is cheap to type.” Cheap typing makes skipped verification *more* tempting, not less.

The destination remains [VISION.md](VISION.md): unbounded class, NYT-Games-class subscription, light social. S0 is not a reduced vision.

---

## 2. Stages

### Stage S0 — Instrument the Polar and the atom

| Deliver | Done when |
|---------|-----------|
| Day key SSOT in api | Documented + single implementation (`product_day_key`) |
| Qualifying finish rows | `game_sessions` written after server validation |
| `compute_drc` + DRC SQL | Recomputes from those rows |
| `compute_hrc` + HRC SQL | Recomputes from the **same** rows over \(W(D)\) |
| One flagship free daily | P1 golden journey live |
| Result card v1 | Non-spoiler share works |

**Exit:** [NORTH-STAR-METRIC.md](NORTH-STAR-METRIC.md) S0.

**HRC may be 0.** That is a valid compute, not a failed stage.  
**S0 is not** “seven consecutive calendar days of events.” That old wording confused *oracle existence* with *traffic weather*. Multi-day DRC series are **S1 evidence**, not S0’s definition.

### Stage S1 — Habit (make HRC *possible to see moving*)

| Deliver | Done when |
|---------|-----------|
| Streak (gentle) | Visible; no dark punish-to-pay |
| Home “today” suite entry | User can find free ritual in one hop |
| D1/D7 ritual retention dashboards | Alertable |
| First-DRC → HRC conversion dashboard | Alertable; values may be low |
| Days-in-window histogram | Exists |
| HRC/DRC auth–guest splits | Exists |

**Exit:** S1 in the NSM doc; retention and conversion *curves exist* (honesty > theater).  
A non-zero HRC is welcome and still not required if traffic is young — but the **path** from first DRC to HRC must be instrumented and unblocked (already-played must not fire on day 2; guest upgrade must not wipe days).

### Stage S2 — Suite under protocol

| Deliver | Done when |
|---------|-----------|
| ≥ 3 `puzzle_ritual` modules fully protocol-compliant | Each has server validate + card |
| Module registry metadata for free/premium | Server enforced |
| Entertainment oracles optional (DFC only) | HRC/DRC unpolluted |
| New module runbook | Can ship without changing auth/share/billing cores |

**Exit:** Catalog growth is a protocol application, not a product rewrite.  
Protected catalog may already be larger than 3 (it is). S2 is about *protocol completeness of the live suite experience*, not about deleting extras to hit a number.

### Stage S3 — Subscription

| Deliver | Done when |
|---------|-----------|
| Archive / depth gates | Fail-closed; free floor intact |
| Platform billing wired | Entitlement oracle green |
| Conversion cohorts by HRC (prior 14 days) | Reviewable monthly |
| Paid HRC vs free HRC | Guardrail live |

**Exit:** Monetization does not reduce the free DRC floor; HRC remains creatable without pay.

### Stage S4 — Catalog scale

| Deliver | Done when |
|---------|-----------|
| Content pipeline SLA for `day_key` ahead | Reliability |
| Module quality bar automated where possible | Economy of attention |
| Disable switch per module | Blast radius control |
| HRC-lift review per addition | Economy |

**Exit:** Catalog growth is operationally boring (good).

### Stage S5 — Social depth (optional)

Parallel compare, light co-op, clubs, later family profiles — only after S1–S2.  
Must not redefine HRC or DRC. Must not make Polar a team count.

---

## 3. Parallel tracks (non-blocking)

| Track | Notes |
|-------|-------|
| Public hostname serving | Platform `domain_hostnames` + DNS verify + gateway routes; not a substitute for HRC |
| Performance budgets | Finish path SLO under load tests |
| Localization | After protocol stable; `day_key` remains SSOT |
| Accessibility hardening | Required on each module as it ships, not a later season |

These tracks can proceed in parallel. None of them is Polar.

---

## 4. Kill / pivot criteria

| Signal | Response |
|--------|----------|
| Cannot get free users to first finish | Fix land / TTFF before any new modules |
| DRC flat while catalog grows | Protocol or UX broken — stop adding modules |
| HRC flat while DRC grows | Habit loop broken — stop buying traffic; fix return |
| Paid users’ HRC collapses | Reverse toxic gates |
| Share converts to zero landings | Card / deep link broken — Sev-2 growth |
| Guest HRC is the only thing growing | Identity rot — do not pivot the Polar; fix identity |
| Entertainment DFC becomes the homepage story | Positioning drift — kill the homepage experiment |

Kill means **stop the current tactic**. It does not mean shrink the vision to a single game.

---

## 5. Mapping to engineering

| Stage | Engineering emphasis |
|-------|----------------------|
| S0–S1 | ADR-170 play path, content store, finish rows, `compute_hrc` / `compute_drc` |
| S2 | Dispatch table, core validators, registry, cards |
| S3 | Billing entitlement, archive APIs, HRC-cohort conversion |
| S4 | Content tool, ops flags, load |
| S5 | Identity graphs, compare APIs — still one finish authority |

Delivery authority still protects the catalog during all stages.

---

## 6. What “ahead of stage” looks like (honest residuals)

The protected catalog and some play paths may exist **before** S1 dashboards exist. That is allowed. It is **not** permission to claim S1 or S3.

| Claim | Required layer |
|-------|----------------|
| “S0 done” | Oracles exist on production rows; P1 live |
| “Habit working” | Non-trivial HRC-auth *or* a measured first-DRC → HRC conversion, not a hope |
| “Suite working” | ≥ 3 modules protocol-complete *in live play*, not merely directories on disk |
| “Paid working” | Entitlement oracle + free floor + conversion cohorts |
| “We are NYT-scale” | Not a stage exit. Category analog only. |

Merged ≠ done. Deployed ≠ done. See [EVIDENCE-AND-ORACLES.md](EVIDENCE-AND-ORACLES.md).
