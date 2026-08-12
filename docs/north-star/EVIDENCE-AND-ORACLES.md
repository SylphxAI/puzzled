# Evidence and oracles

**Status:** Normative  
**Revision:** 2026-08-12  

**Rule:** A green check, HTTP 200, or “Deployed” status is **not** by itself proof of product North Star success. Evidence is **layered**.

---

## 1. Layers

| Layer | Question | Example artifacts |
|-------|----------|-------------------|
| **Source** | Is the contract in git? | This package; ADR-170; proto; validators |
| **CI** | Did automated oracles pass? | unit tests, cargo test, next build, proto gates |
| **Deploy** | Is the intended revision the desired deploy? | env desired SHA, image digests |
| **Live** | Does production behavior match postconditions? | DRC events, healthz git SHA, play finish API |

**Fact ≠ inference.** “Users will love it” is not live evidence.  
**Green ≠ proof.** CI green without ritual.completed emission is incomplete.

---

## 2. Product oracles (must be re-runnable)

### 2.1 DRC oracle

Given day \(D\):

1. Query all `ritual.completed` (or equivalent server tables) with `day_key = D` and `module_class = puzzle_ritual`.  
2. Distinct user/guest keys → \(\mathrm{DRC}(D)\).  
3. Dashboard must match within agreed lag.

### 2.2 Play correctness oracle

For each shipped module:

1. Known content fixture + sequence of moves/guesses.  
2. Server accepts only valid terminal paths.  
3. Solution never present in GetDaily/GetPuzzle responses.  
4. Double finish rejected or idempotent without double DRC.

### 2.3 Free-floor oracle

On a free (non-premium) identity:

1. Can complete today’s free ritual without payment.  
2. Archive (if gated) fails closed with clear upgrade path—not silent 500.

### 2.4 Share oracle

After finish:

1. Card payload contains no solution.  
2. Deep link opens the correct module for day_key.

### 2.5 Premium oracle

With active subscription mock/live:

1. Archive allowed when entitled.  
2. On billing uncertainty: free floor still works; premium features fail closed.

---

## 3. Golden journeys (delivery floor)

| ID | Journey | Pass |
|----|---------|------|
| **P1** | Open free today’s module → play → terminal → result card | Server finish recorded |
| **P2** | Share card → land as new guest → play same day | New potential DRC |
| **P3** | Second module same day | Optional; does not break P1 |
| **P4** | Auth: sign in → streak/history visible | No identity spoof |
| **P5** | Premium: archive access when entitled | Fail-closed otherwise |
| **P6** | Health: api `/healthz` + web ready | Deploy liveness |
| **P7** | Admin: list games / basic ops | Operator path |

Engineering clean-break must not delete P1–P7 without replacement oracles.

---

## 4. Live proof bar (lifecycle)

Per [PROJECT.md](../../PROJECT.md) and ADR-170 §6:

Until **live proof**, lifecycle remains **dev-phase** for *production claims*.

**Minimum live proof for “product north star is real”:**

1. Deployed web + api images from mainline Dockerfiles.  
2. P1 completed on a deployed environment with server persistence.  
3. `ritual.completed` (or equivalent) observable.  
4. Health endpoints report the expected git SHA (or documented digests).

**DRC-scale success** is later: sustained DRC and retention—not required for “stack works,” required for “business north star working.”

---

## 5. Incident severity (product)

| Class | Example | Response |
|-------|---------|----------|
| **Sev-1 product** | Today’s free ritual unservable / all finishes fail | Immediate fix; DRC drop expected |
| **Sev-2** | Single module broken; others fine | Module disable flag if needed; fix |
| **Sev-3** | Share broken; finish works | Growth impact; fix within agreed SLA |

Observability test: signal → locus → cause in minutes for Sev-1.

---

## 6. Domains and edge

Public apex domains (`puzzled.gg`) are **serving** only when Platform `domain_hostnames` are verified and gateway routes exist.  
Legacy `customDomains` strings alone are **not** proof of public serving ([Platform domain doctrine](https://github.com/SylphxAI/platform)—product hostnames SSOT).

Evidence for “public site works”:

- HTTP success on the hostname users care about **and**  
- Response from the intended env/service (SHA or content fingerprint).
