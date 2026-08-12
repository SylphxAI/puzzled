# North Star Metric — Habitual Ritual Completers (HRC)

**Status:** Normative  
**Revision:** 2026-08-12  
**Single source of truth** for “are we winning at the product level?”

**Executive Polar:** Habitual Ritual Completers (HRC)  
**Atomic input:** Daily Ritual Completers (DRC)  
**Entertainment twin (never Polar):** Daily Fun Completers (DFC)

HRC is a **pure function** of a user's DRC day-series. There is one Polar. DRC is not a second Polar, not a vanity twin, and not optional to instrument.

---

## 1. The Polar

### 1.1 Name

**Habitual Ritual Completers (HRC)**

### 1.2 One-sentence definition

> **The number of distinct users who, in the trailing 7 product days ending on calendar day \(D\) (timezone SSOT below), have a qualifying Daily Ritual Completer day on at least 4 of those 7 days.**

### 1.3 Formal definition

Let:

- \(TZ\) = product day-key timezone SSOT (**`Asia/Hong_Kong`** until explicitly changed in this document, `puzzled-core` daily-time, and api together).
- \(D\) = calendar date in \(TZ\), written `YYYY-MM-DD`.
- \(W(D) = \{D-6, D-5, D-4, D-3, D-2, D-1, D\}\) — seven consecutive product days **ending on \(D\) inclusive**.
- \(\mathrm{DRC\_set}(d)\) = the set of user identifiers with a qualifying ritual finish on day \(d\) (see §2).
- User \(u\) is **habitual on \(D\)** iff

\[
\bigl|\{ d \in W(D) \mid u \in \mathrm{DRC\_set}(d) \}\bigr| \ge 4
\]

Then:

\[
\mathrm{HRC}(D) = \bigl|\{ u \mid u \text{ is habitual on } D \}\bigr|
\]

**Threshold:** 4 of 7.  
**Window:** trailing 7 product days, not ISO week, not “calendar week starting Monday,” not user-local week.  
**Consecutive days are not required.** Monday + Wednesday + Friday + Sunday counts. That is deliberate (see §4.3).

Multiple finishes or multiple games on the same day still produce **one** DRC day, therefore **one** tick toward the 4.

### 1.4 Worked examples

Assume qualifying `puzzle_ritual` finishes only. Window for \(D\) = Friday 14th is Sat 8 … Fri 14.

| User | Days with a DRC in the window | Count | HRC(Fri 14)? |
|------|-------------------------------|-------|--------------|
| A | Mon, Tue, Wed, Thu | 4 | Yes |
| B | Sat 8, Sun 9, Wed, Fri (skips allowed) | 4 | Yes |
| C | Mon, Tue, Wed | 3 | No |
| D | All seven days, two games each day | 7 | Yes (still one person) |
| E | Seven entertainment-oracle finishes, zero `puzzle_ritual` | 0 | No (those are DFC days) |
| F | Four archive wins, zero daily ritual | 0 | No |
| G | Same guest UUID, four daily wins | 4 | Yes (guest-legal; report the split) |
| H | Four daily wins on four *different* guest UUIDs (cleared storage) | 1 each | Four DRC days, **zero** HRC people — identity rot |

Example H is why HRC-auth and HRC-guest are reported separately (§2.4).

### 1.5 What HRC is not

| Not | Why |
|-----|-----|
| A 7-day consecutive streak | Punishes travel, illness, and life; invites hostage UX |
| “Opened the app 4 times” | Opens are not value |
| “Finished 4 modules today” | That is same-day depth, not habit |
| Paid users only | Polar must be creatable on the free floor |
| A weekly unique that ignores finish | WAU is not a ritual |
| An average | Polar is a **count of people** in a state |

---

## 2. The atom — Daily Ritual Completers (DRC)

HRC cannot be honest if DRC is not honest. This section is the contract for a DRC day.

### 2.1 One-sentence definition

> **The number of distinct users who, on calendar day \(D\) in \(TZ\), complete at least one qualifying *puzzle ritual* finish.**

### 2.2 Formal definition

\[
\mathrm{DRC}(D) = \bigl|\{ u \mid u \text{ has } \ge 1 \text{ qualifying ritual finish on day } D \}\bigr|
\]

Multiple finishes or multiple games by the same user on day \(D\) still count as **one** toward DRC.  
DRC measures **return to complete today’s ritual**, not grind volume.

### 2.3 Qualifying finish (Correctness oracle)

A finish **qualifies** for a DRC day if and only if **all** of the following hold:

| # | Condition | Authority |
|---|-----------|-----------|
| 1 | Event is produced by the **api** after successful play validation | ADR-170 server-authoritative play |
| 2 | Content is **day-keyed** (`day_key = D` in \(TZ\)) or is the designated **featured free rotation** for \(D\) | Ritual protocol |
| 3 | Module is classified **`puzzle_ritual`** (not `entertainment_oracle`) | Module registry |
| 4 | Outcome is a **terminal success or honest terminal fail** that the product treats as “today’s attempt resolved” (fail-complete may count if the module defines a single daily attempt) | Per-module finish contract |
| 5 | Not a dry-run, admin inject, or load-test marker | Event flags |
| 6 | Mode is **daily ritual**, not archive, not practice | `qualifies_as_ritual` in core |

**Non-qualifying (explicit):**

- Practice modes marked non-ritual  
- Archive play of past days (feeds other metrics, not DRC for day \(D\), not HRC)  
- Entertainment-oracle completions (DFC only)  
- Client-only “I finished” without server validation  
- Abandoned / in-progress sessions  

### 2.4 Identity

**Guests:** Guest finish is allowed and *should* create a DRC day. Identity must be **stable for the day** (device/session bound as implemented: `X-Puzzled-Guest-Id` / `puzzled_guest_id` → `guest_<uuid>` → storage UUID). Default: authenticated + guest-with-stable-id both enter DRC and therefore *can* enter HRC.

**Always report splits:**

| Series | Who |
|--------|-----|
| HRC total / DRC total | All qualifying identifiers |
| HRC-auth / DRC-auth | Platform-authenticated users only |
| HRC-guest / DRC-guest | Guest identifiers only |

**Upgrade:** when a guest signs in, day history should merge onto the account where implemented. Until merge is proven, treat guest HRC as **fragile** (device clear = new person). Do not celebrate guest-HRC growth without checking identity churn.

**One finish per `(user, module, day_key)`:** re-entry is review, not a second DRC tick. The product floor is already-played rejection (409 or equivalent), not silent double count.

### 2.5 Event contract (minimum)

```text
ritual.completed
  user_id          // Platform sub or guest storage UUID
  game_module_id   // slug
  day_key          // YYYY-MM-DD in TZ
  finish_kind      // success | exhausted_fail | other_terminal
  content_id       // server puzzle id (optional for deterministic generators)
  at               // timestamp
  is_ritual        // true
  module_class     // puzzle_ritual | entertainment_oracle | ...
```

Persistence equivalent (S0 sole path): `game_sessions` rows written by `PuzzleService.SubmitGuess` after server validation.

---

## 3. Oracles (must stay in lockstep with this file)

Pure recompute lives in `puzzled_core::puzzle_play::ritual_completion`:

| Quantity | Helper | Notes |
|----------|--------|-------|
| DRC(\(D\)) | `compute_drc` | Distinct `user_id` on that `day_key` |
| HRC(\(D\)) | `compute_hrc` | Distinct `user_id` with ≥ `HABITUAL_MIN_DAYS` (4) distinct DRC days in the 7-day window ending \(D\) |

SQL recipes (documentation + live ops; bound `$1` = end `day_key` `YYYY-MM-DD`):

**DRC**

```sql
SELECT COUNT(DISTINCT user_id)::bigint AS drc
FROM game_sessions
WHERE day_key = $1
  AND is_ritual = true
  AND module_class = 'puzzle_ritual'
  AND status IN ('won', 'lost');
```

**HRC**

```sql
WITH daily AS (
  SELECT user_id, day_key
  FROM game_sessions
  WHERE is_ritual = true
    AND module_class = 'puzzle_ritual'
    AND status IN ('won', 'lost')
    AND day_key >= to_char(($1::date - 6), 'YYYY-MM-DD')
    AND day_key <= $1
  GROUP BY user_id, day_key
)
SELECT COUNT(*)::bigint AS hrc
FROM (
  SELECT user_id
  FROM daily
  GROUP BY user_id
  HAVING COUNT(*) >= 4
) t;
```

**Oracle re-run:** warehouse or Postgres recompute must match the dashboard within rounding of late events (document lag SLA, default 15 minutes). If dashboard and `compute_hrc` disagree, the **pure function + SQL** win until the dashboard is fixed. Dual definitions are a defect.

Constants: `HABITUAL_WINDOW_DAYS = 7`, `HABITUAL_MIN_DAYS = 4`. Changing either is a **material Polar change** (see README change control).

---

## 4. Why this Polar (critical argument)

### 4.1 Amplitude three-part test

A North Star Metric must (Amplitude, Sholtz, retrieved 2026-08-12):

1. Align to **realized customer value**  
2. **Represent strategy** so a stranger can read the metric and guess the product  
3. Be a **leading indicator** of revenue, not revenue itself  

Puzzled’s value is *“I did today’s light ritual and I will likely do it again this week.”*  
Puzzled’s strategy is *become the daily home for an unbounded class of those rituals, then subscribe the habituated.*  
Puzzled’s revenue motion is *NYT-Games-class SaaS: pay for continuity of a habit you already have.*

HRC is the smallest count that is all three. DRC is the first clause only.

### 4.2 Competing candidates

| Candidate | Verdict |
|-----------|---------|
| **HRC (4/7)** | Polar. Value + strategy + leads subscription. |
| **DRC** | **Atom.** Necessary, operational, fad-compatible if used as Polar. |
| Raw DAU | Includes bounce and non-finish. |
| Puzzles completed (count) | Rewards multi-grind; does not measure “came back for the day.” |
| Share count | Gameable; secondary growth input. |
| D7 ritual retention | Cohort diagnostic; not a stock Polar you can plot every day as “are we winning.” |
| Consecutive streak ≥ 7 | Hostage-compatible; punishes real life; teaches dark UX. |
| Paid MAU | Lagging; warps early product toward walls. |
| Game catalog size | Vanity; capability is protocol coverage. |
| Time-in-app | Can reward dark patterns. |
| DFC | Entertainment only; positioning poison if used as Polar. |

**Critical argument:** For a NYT Games–class product, the cultural unit is “I did today’s thing” (DRC) and the **economic unit** is “this is part of my week” (HRC). Wordle proved the first can explode without the second persisting. Catalog breadth multiplies *reasons* to complete; it must not redefine either unit.

### 4.3 Why 4 of 7, not 3, 5, or consecutive 7

| Threshold | Meaning | Risk |
|-----------|---------|------|
| 3/7 | Weekend-plus-one can pass | Counts casual dabblers as habitual; weak leading-revenue signal |
| **4/7** | **Most days this week** | **Decision.** Allows two skips (travel, life) without hostage design |
| 5/7 | Near-daily | Invites streak-shame UX to “make Polar move”; overfits early power users |
| 7/7 consecutive | Perfect attendance | Almost certainly a dark-pattern magnet; rejects the actual human week |

**4/7 is a decision, not a law of nature.** Recalibrate only with:

1. Live correlation of threshold membership → 28-day paid conversion / unpaid retention  
2. A PR that updates this file, the constants, and the tests together  
3. An explicit statement of what the old 4/7 series should be called in historical charts (`HRC4` vs `HRC5`) so time series do not silently jump  

Until that evidence exists, **do not A/B the Polar in dashboards**. Experiment on *inputs* (share, suite, reminders), not on the definition of winning.

**Trailing 7 vs ISO week:** every product day has an \(\mathrm{HRC}(D)\). An ISO-week Polar would be silent Monday–Saturday and jump on Sunday. Operationally worse; culturally the same idea.

### 4.4 Why DRC remains first-class

HRC without DRC is a castle on fog:

- Daily ops need a **same-day** pulse (is today’s ritual broken?). HRC moves slowly.  
- New users cannot be HRC on day one. Activation is “first DRC,” not “first HRC.”  
- Incident locus: DRC drop = finish path; HRC drop with stable DRC = return loop.  

**S0 instruments both.** A world where DRC is green and HRC is not recomputable is a world that will optimize the fad.

### 4.5 Game Puzzled is playing (Amplitude taxonomy)

Amplitude’s three games: Attention, Transaction, Productivity.

Puzzled is **not** maximizing minutes (Attention-as-time-spent). Minutes-a-day is a *constraint*, not an objective.  
Puzzled is **not** maximizing transactions per session.  
Puzzled is closest to a **subscription productivity-of-mood ritual**: the “work” is a finished daily, the output is a competent, shareable close.

If a proposal would win by increasing time-in-app at the expense of clean finishes, it is playing the wrong game.

---

## 5. Entertainment split (protect the Polar)

| Class | Daily count | Habit count | Rationale |
|-------|-------------|-------------|-----------|
| `puzzle_ritual` | **DRC** | **HRC** | Positive light learning / brain play |
| `entertainment_oracle` | **DFC** | Do **not** define an HRC-equivalent without a package amendment | Fun, random OK; must not inflate “brain ritual” success |

Product may surface both on the home page. **Executive Polar is HRC only.**  
A “fun weekly regular” who never finishes a puzzle is a DFC story, not a Polar win.

---

## 6. Stage targets (directional; calibrate live)

Targets force learning. They are not vanity OKRs. Recalibrate when live baselines exist.  
Industry casual-puzzle retention bands vary widely; **do not copy mobile hyper-casual medians as Puzzled OKRs.**

| Stage | Name | Exit criterion |
|-------|------|----------------|
| **S0** | Instrument | `compute_drc`, `compute_hrc`, and the SQL recipes run against production `game_sessions` (or an attested warehouse copy). **HRC may be 0.** S0 is *not* “seven consecutive calendar days of traffic.” S0 is *not* “HRC > 0.” |
| **S1** | One ritual, measurable return | ≥ 1 flagship `puzzle_ritual`; first-DRC → HRC conversion within 14 days is computable; D1/D7 ritual retention dashboards exist (values may be low; honesty > theater). |
| **S2** | Suite habit | ≥ 3 protocol-complete `puzzle_ritual` modules; HRC users’ median modules-per-DRC-day in a healthy band (not zero, not infinite grind); new module does not change Polar math. |
| **S3** | Paid habit | Conversion tracked for users who were HRC in the prior 14 days; free daily finish never removed; paid users’ HRC must not collapse relative to free HRC. |
| **S4** | Catalog scale | Content SLA + disable switches; HRC per module-addition reviewed under Economy. |
| **S5** | Social depth | Compare / light co-op / clubs only after S1–S2; must not redefine HRC or DRC. |

**Forbidden S0 reading:** “We must wait a week to declare instrumentation done.” If the oracles exist on day one, S0 is source-complete. Live *habit* proof is a later layer (see [EVIDENCE-AND-ORACLES.md](EVIDENCE-AND-ORACLES.md)).

---

## 7. Anti-patterns (forbidden “wins”)

1. Counting unfinished starts as DRC (hence as HRC).  
2. Letting the client assert completion.  
3. Moving the day boundary per user without a versioned protocol upgrade.  
4. Gating the *only* free daily finish behind pay so DRC/HRC collapse into paid-only.  
5. Optimizing share bots to fake new DRC without finish quality.  
6. Counting four modules on one day as HRC.  
7. Counting four entertainment oracles as HRC.  
8. Renaming HRC or DRC in dashboards without updating this file.  
9. Treating a DRC spike after a campaign as Polar success when HRC is flat.  
10. Raising the threshold to 7/7 and then adding streak-shame to “hit Polar.”  
11. Dropping `ritual.completed` / `game_sessions` ritual columns to save storage (Observability × Correctness).  
12. Using HRC = 0 at S0 as evidence that Polar is “wrong.” It is evidence that habit has not happened yet — or that traffic is young. Both are allowed facts.

---

## 8. Inputs (what teams actually move)

Amplitude recommends 3–5 complementary inputs. Puzzled’s inputs under HRC:

| Input | Dimension | Owner doc |
|-------|-----------|-----------|
| **DRC(\(D\))** | Breadth of today’s finishers | This file §2 |
| **First-DRC → HRC conversion (14-day)** | Frequency / activation | [METRICS-TREE.md](METRICS-TREE.md) |
| **Share → land → first DRC** | Growth efficiency | [GROWTH-AND-VIRALITY.md](GROWTH-AND-VIRALITY.md) |
| **Modules per DRC day (p50)** | Depth of the suite, not grind | [METRICS-TREE.md](METRICS-TREE.md) |
| **Free-ritual serve + submit error rate** | Reliability (without this, nothing else is real) | [EVIDENCE-AND-ORACLES.md](EVIDENCE-AND-ORACLES.md) |

Revenue metrics hang **below** these. They do not replace them.

---

## 9. Ownership

| Role | Responsibility |
|------|----------------|
| Product | Protect HRC and DRC definitions; approve `module_class`; approve threshold changes |
| Engineering | Emit finish rows; server validation; `day_key` SSOT; keep `compute_hrc` / `compute_drc` aligned with this file |
| Data / ops | Dashboard + anomaly alerts on HRC drop, DRC drop, and HRC/DRC divergence |

**Economy note:** Any proposal to “save cost by dropping instrumentation” trades Observability and Correctness. State the budget explicitly. Do not merge silent drops of ritual finish rows.

---

## 10. Relationship to the previous Polar (DRC)

Until this revision, the living package named **DRC** as the North Star Metric and listed “weekly ritualists (≥ 4 of 7)” as a supporting habit metric.

That supporting metric **was the better Polar**. Promoting it is a correction, not a rebrand for its own sake.

Historical DRC series remain valid and must continue. Charts should show:

- DRC(\(D\)) — daily pulse  
- HRC(\(D\)) — Polar  
- first-DRC → HRC conversion — activation  

Do not delete DRC dashboards. Do not leave “weekly ritualists” as a parallel name.
