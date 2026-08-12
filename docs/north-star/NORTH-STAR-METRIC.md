# North Star Metric — Daily Ritual Completers (DRC)

**Status:** Normative  
**Revision:** 2026-08-12  
**Single source of truth** for “are we winning at the product level?”

---

## 1. The metric

### Name

**Daily Ritual Completers (DRC)**

### One-sentence definition

> **The number of distinct users who, on calendar day \(D\) in the product day-key timezone, complete at least one qualifying *puzzle ritual* finish.**

### Formal definition

Let:

- \(TZ\) = product day-key timezone SSOT (**`Asia/Hong_Kong`** until explicitly changed in this document and code together).  
- \(D\) = calendar date in \(TZ\).  
- \(U\) = set of user identifiers with a **server-accepted** finish event on day \(D\).

Then:

\[
\mathrm{DRC}(D) = \bigl|\{ u \mid u \text{ has } \ge 1 \text{ qualifying ritual finish on day } D \}\bigr|
\]

Multiple finishes or multiple games by the same user on day \(D\) still count as **one** toward DRC.  
DRC measures **return to complete today’s ritual**, not grind volume.

---

## 2. Qualifying finish (Correctness oracle)

A finish **qualifies** for DRC if and only if **all** of the following hold:

| # | Condition | Authority |
|---|-----------|-----------|
| 1 | Event is produced by the **api** after successful play validation | ADR-170 server-authoritative play |
| 2 | Content is **day-keyed** (`day_key = D` in \(TZ\)) or is the designated **featured free rotation** for \(D\) | Ritual protocol |
| 3 | Module is classified **`puzzle_ritual`** (not pure `entertainment_oracle`) | Module registry |
| 4 | Outcome is a **terminal success or honest terminal fail** that the product treats as “today’s attempt resolved” (see protocol: fail-complete may count if the module defines a single daily attempt) | Per-module finish contract |
| 5 | Not a dry-run, admin inject, or load-test marker | Event flags |

**Guests:** If the product allows guest finish, guest identity must be **stable for the day** (device/session bound as implemented) and documented; otherwise only authenticated users enter DRC. **Default:** authenticated + guest-with-stable-day-id both allowed; report DRC total and DRC-auth split.

**Non-qualifying (explicit):**

- Practice modes marked non-ritual  
- Archive play of past days (feeds other metrics, not DRC for day \(D\))  
- Entertainment-oracle completions (separate **Daily Fun Completers**, DFC)  
- Client-only “I finished” without server validation  

### Event contract (minimum)

```text
ritual.completed
  user_id          // or guest_day_id
  game_module_id   // slug
  day_key          // YYYY-MM-DD in TZ
  finish_kind      // success | exhausted_fail | other_terminal
  content_id       // server puzzle id
  at               // timestamp
  is_ritual        // true
  module_class     // puzzle_ritual | entertainment_oracle | ...
```

**Oracle re-run:** Given warehouse or Postgres, recompute \(\mathrm{DRC}(D)\) from raw events and match the dashboard within rounding of late events (document lag SLA, default 15 minutes).

---

## 3. Why this NSM (and not alternatives)

| Candidate | Verdict |
|-----------|---------|
| **DRC** | Aligns daily habit, free-tier honesty, suite growth, subscription readiness |
| Raw DAU | Includes bounce and non-finish |
| Puzzles completed (count) | Rewards multi-grind; does not measure “came back for the day” |
| Share count | Gameable; secondary growth input |
| Paid MAU | Lagging; warps early product toward walls |
| Game catalog size | Vanity; capability is protocol coverage |
| Time-in-app | Can reward dark patterns |

**Critical argument:** For a NYT Games–class product, the economic and cultural unit is **“I did today’s thing.”** That unit is DRC. Catalog breadth multiplies *reasons* to complete; it must not redefine the unit.

---

## 4. Entertainment split (protect the NSM)

| Class | Metric | Rationale |
|-------|--------|-----------|
| `puzzle_ritual` | **DRC** | Positive light learning / brain play |
| `entertainment_oracle` | **DFC** (Daily Fun Completers)—same shape as DRC | Fun, random OK; must not inflate “brain ritual” success |

Product may surface both on the home page; **executive NSM is DRC only.**

---

## 5. Stage targets (directional; calibrate live)

Targets are **not** vanity OKRs. They force learning. Recalibrate when live baselines exist.

| Stage | Name | Exit criterion (examples) |
|-------|------|---------------------------|
| **S0** | Instrument | DRC recomputable from production events for 7 consecutive days |
| **S1** | One ritual | ≥1 flagship module; D7 *ritual retention* of new DRC users measurable |
| **S2** | Suite habit | ≥3 puzzle_ritual modules; median modules-per-DRC-user in a healthy band (not zero, not infinite grind) |
| **S3** | Paid habit | Conversion tracked for users with ≥7 DRC days in prior 14; free daily finish never removed |

Industry casual-puzzle retention bands vary widely; **do not copy mobile hyper-casual medians as Puzzled OKRs.** Build Puzzled’s own DRC cohort curves.

---

## 6. Anti-patterns (forbidden “wins”)

1. Counting unfinished starts as DRC.  
2. Letting the client assert completion.  
3. Moving the day boundary per user without documenting multi-TZ (until multi-TZ is a deliberate protocol change).  
4. Gating the *only* free daily finish behind pay so DRC collapses into paid-only.  
5. Optimizing share bots to fake viral without finish quality.  
6. Renaming DRC in dashboards without updating this file.

---

## 7. Ownership

| Role | Responsibility |
|------|----------------|
| Product | Protect definition; approve module_class |
| Engineering | Emit events; server validation; day_key SSOT in api |
| Data / ops | Dashboard + anomaly alerts on DRC drop |

**Economy note:** Any proposal to “save cost by dropping instrumentation” trades Observability and Correctness; state the budget explicitly and do not merge silent drops of `ritual.completed`.
