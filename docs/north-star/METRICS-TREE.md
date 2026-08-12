# Metrics tree under DRC

**Status:** Normative instrumentation targets  
**Revision:** 2026-08-12  
**Root:** [Daily Ritual Completers (DRC)](NORTH-STAR-METRIC.md)

---

## 1. Tree

```
DRC(D)                          ← North Star
│
├── HABIT
│   ├── Ritual retention D1 / D7 / D28
│   │     cohort = users with first DRC on day 0
│   │     success = DRC again on day N
│   ├── Weekly ritualists
│   │     users with DRC on ≥4 distinct days in trailing 7
│   ├── Streak distribution
│   │     share of DRC users with streak ≥3, ≥7 (gentle product)
│   └── Time-to-first-finish (TTFF)
│         for new users; p50/p90
│
├── DEPTH (suite, not grind)
│   ├── Modules per DRC user per day (p50/p90)
│   ├── Featured-module finish rate
│   └── Module contribution
│         DRC attributed by first finish module that day
│
├── FUN (secondary)
│   ├── DFC — Daily Fun Completers (entertainment_oracle)
│   └── Oracle→puzzle crossover
│         DFC users who become DRC within 7 days
│
├── GROWTH
│   ├── Share rate = shares / ritual finishes
│   ├── Share landings (ref)
│   ├── New DRC from share landings
│   └── Viral coefficient (product of rates; diagnostic)
│
├── QUALITY / RELIABILITY
│   ├── Ritual serve error rate (today content)
│   ├── Submit validation error rate
│   ├── Finish path latency p50/p95
│   └── Client JS error rate on play surfaces
│
└── REVENUE (lagging)
    ├── Free→paid conversion (by DRC density cohorts)
    ├── Paid DRC (should not collapse)
    ├── Churn / reactivation
    └── Archive-gate conversion (intent→subscribe)
```

---

## 2. Definitions (selected)

### 2.1 Ritual retention Dn

Among users whose **first-ever** qualifying DRC day is \(D_0\), the fraction with a qualifying DRC on calendar day \(D_0+n\) (same TZ).

Not “opened the app.” **Completed a ritual.**

### 2.2 Weekly ritualists

Users with \(\ge 4\) distinct day_keys with DRC in the trailing 7-day window ending \(D\).  
Leading indicator of subscription readiness.

### 2.3 Modules per DRC user

For users in \(\mathrm{DRC}(D)\), count distinct `game_module_id` with a finish that day; report distribution.  

**Healthy band (hypothesis):** p50 ∈ {1, 2, 3}; extreme p90 grind may signal unhealthy pressure—investigate UX.

---

## 3. Guardrail metrics (stop-the-line)

| Signal | Why |
|--------|-----|
| DRC day-over-day drop > threshold without deploy/content explanation | Habit regression |
| Free daily finish error rate spike | Reliability incident |
| Share rate collapse after card change | Growth regression |
| Paid users’ DRC << free DRC | Monetization toxicity |
| Entertainment DFC ≫ DRC while product claims “brain training” | Positioning drift |

Thresholds are set in ops dashboards; **existence** of alerts is required (Observability floor).

---

## 4. What not to dashboard as “success”

- Catalog count alone  
- Unbounded session length as a goal  
- Push send volume  
- Raw play count without unique users  

---

## 5. Implementation notes

- Prefer server-emitted events over client analytics alone for DRC/finish.  
- Client analytics may enrich UX funnels (TTFF, rage clicks).  
- Day_key and user_id joins must be documented for warehouse jobs.  
- Privacy: aggregate by default; raw event retention per policy.

---

## 6. Review cadence

| Cadence | Review |
|---------|--------|
| Daily | DRC, free-finish errors |
| Weekly | Retention, share funnel, module mix |
| Monthly | Monetization cohorts, catalog ROI (Economy) |
