# Evidence and oracles

**Status:** Normative  
**Revision:** 2026-08-12  

**Rule:** A green check, HTTP 200, or “Deployed” status is **not** by itself proof of product North Star success. Evidence is **layered**.  
**Polar:** [HRC](NORTH-STAR-METRIC.md) is a live, recomputable quantity. Until the HRC oracle can run, Polar success is *not even false* — it is unmeasured.

---

## 1. Layers

| Layer | Question | Example artifacts |
|-------|----------|-------------------|
| **Source** | Is the contract in git? | This package; ADR-170; proto; `compute_hrc` / `compute_drc`; validators |
| **CI** | Did automated oracles pass? | unit tests, cargo test, next build, proto gates |
| **Deploy** | Is the intended revision the desired deploy? | env desired SHA, image digests |
| **Live** | Does production behavior match postconditions? | HRC/DRC recomputes, healthz git SHA, play finish API, P1 journey |

**Fact ≠ inference.** “Users will love it” is not live evidence.  
**Green ≠ proof.** CI green without ritual finish rows is incomplete.  
**HRC = 0 ≠ oracle missing.** Zero can be the true count. Missing SQL is the defect.  
**`GetTodayOverview.playerCount` is not DRC.** UTC / unfiltered chrome. Polar is `compute_drc` / `compute_hrc` only ([CUTOVER.md](CUTOVER.md)).

Keep source / CI / deploy / live distinct in every status report.

---

## 2. Product oracles (must be re-runnable)

### 2.1 DRC oracle

Given day \(D\):

1. Query all qualifying finish rows with `day_key = D` and `module_class = puzzle_ritual`.  
2. Distinct user/guest keys → \(\mathrm{DRC}(D)\).  
3. Dashboard must match within agreed lag.

**Postgres equivalent (S0 sole path):** `game_sessions` rows written by `PuzzleService.SubmitGuess` after server validation:

```sql
SELECT COUNT(DISTINCT user_id)::bigint AS drc
FROM game_sessions
WHERE day_key = $1          -- YYYY-MM-DD in Asia/Hong_Kong
  AND is_ritual = true
  AND module_class = 'puzzle_ritual'
  AND status IN ('won', 'lost');
```

Pure recompute: `puzzled_core::puzzle_play::ritual_completion::compute_drc`.

### 2.2 HRC oracle (Polar)

Given end day \(D\):

1. Take qualifying DRC days in \(W(D) = [D-6, D]\).  
2. Distinct users with ≥ 4 distinct day_keys in that window → \(\mathrm{HRC}(D)\).  
3. Dashboard must match `compute_hrc` within agreed lag.

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

Pure recompute: `puzzled_core::puzzle_play::ritual_completion::compute_hrc`.  
Constants: `HABITUAL_WINDOW_DAYS = 7`, `HABITUAL_MIN_DAYS = 4`.

**Splits:** repeat with `user_id` matching / not matching guest storage IDs → HRC-auth / HRC-guest.

**Do not** approximate HRC as `avg(DRC) * 7` or `count(users with streak ≥ 4)`. Those are different quantities.

### 2.3 Play correctness oracle

For each shipped module:

1. Known content fixture + sequence of moves/guesses.  
2. Server accepts only valid terminal paths.  
3. Solution never present in GetDaily/GetPuzzle responses.  
4. Double finish rejected or idempotent without a second DRC tick.  
5. Guard is **not** skipped when `puzzle_id` is null (deterministic generators).

### 2.4 Free-floor oracle

On a free (non-premium) identity, including guest:

1. Can complete today’s free ritual without payment.  
2. Receives a result card.  
3. Archive (if gated) fails closed with clear upgrade path — not silent 500.  
4. Four such days in a week remain *possible* (Polar creatable on free).

### 2.5 Share oracle

After finish:

1. Card payload contains no solution.  
2. Deep link opens the correct module for the intended `day_key` rule (today vs labeled archive).

### 2.6 Premium oracle

With active subscription mock/live:

1. Archive allowed when entitled.  
2. On billing uncertainty: free floor still works; premium features fail closed.

### 2.7 Habit-path oracle (S1)

1. A user who finished yesterday is not told they already finished *today*.  
2. Guest sign-in does not drop prior DRC days (or the gap is attested as residual).  
3. First-DRC → HRC conversion is computable from the same rows (even if the rate is 0).

---

## 3. Golden journeys (delivery floor)

| ID | Journey | Pass |
|----|---------|------|
| **P1** | Open free today’s module → play → terminal → result card | Server finish recorded (DRC-day candidate) |
| **P2** | Share card → land as new guest → play same day | New potential DRC |
| **P3** | Second module same day | Optional; does not break P1; still one DRC day |
| **P4** | Auth: sign in → streak/history visible | No identity spoof; guest history attach if claimed |
| **P5** | Premium: archive access when entitled | Fail-closed otherwise |
| **P6** | Health: api `/healthz` + web ready | Deploy liveness; SHA or digest |
| **P7** | Admin: list games / basic ops | Operator path |

Engineering clean-break must not delete P1–P7 without replacement oracles.

**P1 is necessary for DRC. It is not sufficient for HRC.** Do not call Polar “live proven” from a single P1.

---

## 4. Live proof bar (lifecycle)

Per [PROJECT.md](../../PROJECT.md) and ADR-170 §6:

Until **live proof**, lifecycle remains **dev-phase** for *production claims*.

**Minimum live proof that the stack works:**

1. Deployed web + api images from mainline Dockerfiles.  
2. P1 completed on a deployed environment with server persistence.  
3. Qualifying finish row observable.  
4. Health endpoints report the expected git SHA (or documented digests).

**Minimum live proof that Polar is *measurable*:**

5. `compute_drc` and `compute_hrc` (or the SQL recipes) run against that environment’s `game_sessions` and return numbers (including 0).

**Minimum live proof that Polar is *working as a business*:**

6. Sustained HRC-auth and a measured first-DRC → HRC conversion — later, not required for “stack works,” required for “business North Star working.”

Do not collapse (4), (5), and (6).

---

## 5. Incident severity (product)

| Class | Example | Response |
|-------|---------|----------|
| **Sev-1 product** | Today’s free ritual unservable / all finishes fail | Immediate fix; DRC and then HRC will drop |
| **Sev-2** | Single module broken; others fine | Module disable flag if needed; fix |
| **Sev-2 habit** | Already-played fires across days; guest upgrade wipes history | HRC will silently die; treat as product incident, not “metrics noise” |
| **Sev-3** | Share broken; finish works | Growth impact; fix within agreed SLA |

Observability test: signal → locus → cause in minutes for Sev-1.

**Locus cheat-sheet:**

| Symptom | Look first |
|---------|------------|
| DRC drop | SubmitGuess, content for today, identity, DB |
| HRC drop, DRC stable | Return path, reminders, already-played-across-days, identity merge |
| HRC-guest only | Storage / cookie / header path |
| Paid HRC drop | Entitlement fail-open/closed, archive UX |

---

## 6. Public hostnames and edge

Public apex domains are **serving** only when Platform `domain_hostnames` are verified and gateway routes exist.  
Legacy `customDomains` strings alone are **not** proof of public serving (Platform product-hostnames SSOT).

Evidence for “public site works”:

- HTTP success on the hostname users care about **and**  
- Response from the intended env/service (SHA or content fingerprint).

A green api with a hanging public hostname is a **serve residual**, not Polar success and not Polar failure. Do not use it as a Polar excuse.

---

## 7. How to write a Polar status (agents and humans)

Required shape:

```text
Layer: source | CI | deploy | live
HRC(D) = <n or unmeasured>   (auth/guest split if live)
DRC(D) = <n or unmeasured>
Oracle: compute_hrc / SQL ran? yes/no
P1: pass/fail/not-run
Residuals: ...
Inference (labeled): ...
```

Forbidden shape: “North Star is done because the PR merged.”
