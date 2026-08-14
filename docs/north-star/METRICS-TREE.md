# Metrics tree under daily puzzle completers

**Status:** Normative instrumentation targets  
**Revision:** 2026-08-13  
**Root:** [daily puzzle completers](NORTH-STAR-METRIC.md)

---

## 1. Tree

```
daily_puzzle_completers(D)      ← North Star
│
├── HABIT
│   ├── Ritual retention D1 / D7 / D28
│   │     cohort = users whose first daily-puzzle-completer day is day 0
│   │     success = daily puzzle completers again on day N
│   ├── Weekly ritualists
│   │     users with daily puzzle completers on ≥4 distinct days in trailing 7
│   ├── Streak distribution
│   │     share of daily puzzle completers with streak ≥3, ≥7 (gentle product)
│   └── Time-to-first-finish (TTFF)
│         for new users; p50/p90
│
├── DEPTH (suite, not grind)
│   ├── Modules per daily puzzle completer per day (p50/p90)
│   ├── Featured-module finish rate
│   └── Module contribution
│         daily puzzle completers attributed by first finish module that day
│
├── FUN (secondary)
│   ├── daily entertainment completers (entertainment_oracle)
│   └── Oracle→puzzle crossover
│         daily entertainment completers who become daily puzzle completers within 7 days
│
├── GROWTH
│   ├── Share rate = shares / ritual finishes
│   ├── Share landings (ref)
│   ├── New daily puzzle completers from share landings
│   └── Viral coefficient (product of rates; diagnostic)
│
├── QUALITY / RELIABILITY
│   ├── Ritual serve error rate (today content)
│   ├── Submit validation error rate
│   ├── Finish path latency p50/p95
│   └── Client JS error rate on play surfaces
│
└── REVENUE (lagging)
    ├── Free→paid conversion (by daily-puzzle-completer density cohorts)
    ├── Paid daily puzzle completers (should not collapse)
    ├── Churn / reactivation
    └── Archive-gate conversion (intent→subscribe)
```

---

## 2. Definitions (selected)

### 2.1 Ritual retention Dn

Among users whose **first-ever** qualifying daily-puzzle-completer day is \(D_0\), the fraction with a qualifying daily-puzzle-completer finish on calendar day \(D_0+n\) (same TZ).

Not “opened the app.” **Completed a ritual.**

### 2.2 Weekly ritualists

Users with \(\ge 4\) distinct day_keys with daily puzzle completers in the trailing 7-day window ending \(D\).  
Leading indicator of subscription readiness.

### 2.3 Modules per daily puzzle completer

For users in \(\texttt{daily\_puzzle\_completers}(D)\), count distinct `game_module_id` with a finish that day; report distribution.  

**Healthy band (hypothesis):** p50 ∈ {1, 2, 3}; extreme p90 grind may signal unhealthy pressure—investigate UX.

---

## 3. Guardrail metrics (stop-the-line)

| Signal | Why |
|--------|-----|
| daily puzzle completers day-over-day drop > threshold without deploy/content explanation | Habit regression |
| Free daily finish error rate spike | Reliability incident |
| Share rate collapse after card change | Growth regression |
| Paid users’ daily puzzle completers << free daily puzzle completers | Monetization toxicity |
| daily entertainment completers ≫ daily puzzle completers while product claims “brain training” | Positioning drift |

Thresholds are set in ops dashboards; **existence** of alerts is required (Observability floor).

---

## 4. What not to dashboard as “success”

- Catalog count alone  
- Unbounded session length as a goal  
- Push send volume  
- Raw play count without unique users  

---

## 5. Implementation notes

- Prefer server-emitted events over client analytics alone for daily puzzle completers / finish.  
- Client analytics may enrich UX funnels (TTFF, rage clicks).  
- Day_key and user_id joins must be documented for warehouse jobs.  
- Privacy: aggregate by default; raw event retention per policy.

---

## 6. Review cadence

| Cadence | Review |
|---------|--------|
| Daily | daily puzzle completers, free-finish errors |
| Weekly | Retention, share funnel, module mix |
| Monthly | Monetization cohorts, catalog ROI (Economy) |
