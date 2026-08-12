# Metrics tree under HRC

**Status:** Normative instrumentation targets  
**Revision:** 2026-08-12  
**Root:** [Habitual Ritual Completers (HRC)](NORTH-STAR-METRIC.md)  
**Atom:** Daily Ritual Completers (DRC)

Do not dashboard a twin Polar. DRC is an input. “Weekly ritualists” is the old name for HRC — retire that label.

---

## 1. Tree

```
HRC(D)                         ← North Star (stock: people habitual on day D)
│
├── ATOM
│   ├── DRC(D)                 ← daily pulse; required input
│   ├── DRC-auth / DRC-guest
│   └── HRC-auth / HRC-guest
│
├── HABIT (how DRC becomes HRC)
│   ├── First-DRC → HRC conversion (14-day)
│   ├── Ritual retention D1 / D7 / D28
│   │     cohort = users with first DRC on day 0
│   │     success = DRC again on day N
│   ├── Days-in-window distribution
│   │     among users with ≥1 DRC in W(D): share with 1, 2, 3, 4+ days
│   ├── Streak distribution
│   │     souvenir, not Polar; share of DRC users with streak ≥3, ≥7
│   └── Time-to-first-finish (TTFF)
│         for new users; p50/p90
│
├── DEPTH (suite, not grind)
│   ├── Modules per DRC user per day (p50/p90)
│   ├── Featured-module finish rate
│   └── Module contribution
│         DRC attributed by first finish module that day
│         HRC attributed by the user's set of modules in W(D) (diagnostic)
│
├── FUN (secondary — never Polar)
│   ├── DFC — Daily Fun Completers (entertainment_oracle)
│   └── Oracle→puzzle crossover
│         DFC users who become DRC within 7 days
│
├── GROWTH
│   ├── Share rate = shares / ritual finishes
│   ├── Share landings (ref)
│   ├── New DRC from share landings
│   ├── New HRC from users whose first DRC was a share landing
│   └── Viral coefficient (product of rates; diagnostic)
│
├── QUALITY / RELIABILITY
│   ├── Ritual serve error rate (today content)
│   ├── Submit validation error rate
│   ├── Already-played false reject / false allow
│   ├── Finish path latency p50/p95
│   └── Client JS error rate on play surfaces
│
└── REVENUE (lagging)
    ├── Free→paid conversion among HRC (prior 14 days)
    ├── Same among one-day DRC (should be lower)
    ├── Paid HRC / paid DRC (must not collapse)
    ├── Churn / reactivation
    └── Archive-gate conversion (intent→subscribe)
```

---

## 2. Definitions (selected)

### 2.1 HRC(\(D\)) and DRC(\(D\))

Normative formulas, identity rules, and SQL: [NORTH-STAR-METRIC.md](NORTH-STAR-METRIC.md).  
This file does not fork those definitions.

### 2.2 Ritual retention Dn

Among users whose **first-ever** qualifying DRC day is \(D_0\), the fraction with a qualifying DRC on calendar day \(D_0+n\) (same TZ).

Not “opened the app.” **Completed a ritual.**

### 2.3 First-DRC → HRC conversion (14-day)

Among users whose first-ever DRC day is \(D_0\), the fraction for whom there exists \(D \in [D_0, D_0+13]\) with \(u \in \mathrm{HRC}(D)\).

Note: a user whose first DRC is today **cannot** be HRC today. The earliest possible HRC day is the day of their fourth DRC day. The 14-day window is long enough for a 4-of-7 pattern with skips.

### 2.4 Days-in-window distribution

For the set of users with ≥ 1 DRC day in \(W(D)\), the histogram of distinct DRC days in that window (1 through 7).

**How to read it:**

- Mass at 1 = fad / bounce  
- Mass at 2–3 = forming  
- Mass at 4+ = HRC  
- Migration of mass from 1 toward 4+ is the habit loop working  

This histogram is often more diagnostic than the HRC scalar alone.

### 2.5 Modules per DRC user

For users in \(\mathrm{DRC}(D)\), count distinct `game_module_id` with a finish that day; report distribution.

**Healthy band (hypothesis):** p50 ∈ {1, 2, 3}; extreme p90 grind may signal unhealthy pressure — investigate UX.  
Suite success is **HRC with p50 ≥ 1 and some 2+**, not p90 = 17.

---

## 3. Guardrail metrics (stop-the-line)

| Signal | Why | Likely locus |
|--------|-----|--------------|
| DRC day-over-day drop > ops threshold without deploy/content explanation | Finish path or traffic | Sev-1 if free ritual unservable |
| HRC drop while DRC is stable | Return loop broken (reminders, home, suite, identity) | Habit, not serve |
| HRC-guest up, HRC-auth flat | Identity rot / storage clears | Do not declare Polar win |
| Free daily finish error rate spike | Reliability incident | Sev-1 product |
| Share rate collapse after card change | Growth regression | Sev-3 |
| Paid users’ HRC ≪ free HRC | Monetization toxicity | Reverse gates |
| DFC ≫ DRC while product claims “brain training” | Positioning drift | Homepage / oracles |
| First-DRC → HRC conversion collapse | Activation broken | Stop catalog + UA |

Thresholds are set in ops dashboards; **existence** of alerts is required (Observability floor). S0 requires the *recompute*; S1 requires the *dashboards*.

---

## 4. What not to dashboard as “success”

- Catalog count alone  
- Unbounded session length as a goal  
- Push send volume  
- Raw play count without unique users  
- DRC spike without the HRC series next to it  
- Guest HRC without the auth split  
- Revenue without paid-HRC  
- Streak length as a proxy for Polar  

---

## 5. Implementation notes

- Prefer server-emitted finish rows over client analytics alone for HRC/DRC.  
- Client analytics may enrich UX funnels (TTFF, rage clicks).  
- `day_key` and `user_id` joins must be documented for warehouse jobs.  
- HRC is a **windowed distinct-count**. Naive “sum of DRC / 7” is not HRC.  
- Privacy: aggregate by default; raw event retention per policy.  
- Late events: 15-minute lag SLA unless ops documents otherwise. Recompute beats increment.  
- Identity merge (guest → auth) must rewrite or alias rows or HRC-auth will undercount the people we just convinced to sign in.

---

## 6. Review cadence

| Cadence | Review |
|---------|--------|
| Daily | DRC, HRC, free-finish errors |
| Weekly | Days-in-window histogram, first-DRC → HRC conversion, share funnel, module mix |
| Monthly | Monetization cohorts by HRC, catalog ROI (Economy), threshold-correlation study (do **not** silently retune 4/7) |

---

## 7. Worked diagnostic (how to argue from the tree)

| Observation | Inference (not a fact until checked) | First check |
|-------------|--------------------------------------|-------------|
| DRC ↑ HRC flat | New people finish once; they do not return | Retention D1, reminder tone, already-played bugs on day 2 |
| HRC ↑ DRC flat | Same people concentrating; acquisition stalled | Share land, TTFF, domain serve |
| Both ↑ | Real growth | Confirm HRC-auth, not guest churn |
| Both ↓ | Broken ritual or lost traffic | P1 journey live, health SHA, content for today |
| Paid conversion ↑ HRC ↓ | Extractive monetization | Free floor oracle |
| Modules/day p90 explodes | Grind or bot | Anti-abuse, UX pressure |

Write the inference down as inference. The Polar number is the fact.
