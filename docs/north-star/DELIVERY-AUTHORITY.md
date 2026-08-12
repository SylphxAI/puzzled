# Delivery authority — product floors vs engineering clean-break

**Status:** Normative  
**Revision:** 2026-08-12  
**Supersedes:** 2026-08-11 PR #64–centric wording (historical gate materials under [history/](history/))

---

## 1. Purpose

This document decides **what may land on `main`** when engineering ambition (sole Connect, sole Rust, deletions) collides with **player product** and **North Star** (HRC, DRC atom, free daily ritual, catalog).

**Hierarchy:**

1. Security / data integrity floors  
2. **Player product floors** (this file + VISION + NSM)  
3. Engineering clean-break (ADR-170)  
4. Convenience, line-count reduction, “looks clean”

Path: **PR → Merge Queue → main → auto deploy → live oracles** as configured.  
**Merged ≠ done. Deployed ≠ done.**

---

## 2. Product floors (non-negotiable)

A change **must not** merge if it:

| # | Floor |
|---|--------|
| F1 | Deletes or hollows a **catalog game** without DELIVERY exception (see §4) |
| F2 | Removes the **free daily ritual finish** for non-premium users, or makes HRC impossible without pay |
| F3 | Restores **client-trusted** solutions, scores, or completion flags |
| F4 | Reintroduces a **second play authority** (e.g. dual REST submit path) while claiming sole api |
| F5 | Breaks golden journeys **P1–P7** without a successor oracle ([EVIDENCE-AND-ORACLES.md](EVIDENCE-AND-ORACLES.md)) |
| F6 | Ships a new module without **server validator + registry + result-card mapping** |
| F7 | Counts entertainment oracles as Polar success, or claims HRC/DRC without an instrumentation path |
| F8 | Changes HRC/DRC formulas, the 4-of-7 threshold, or `day_key` TZ without a North Star package + core-oracle update in the **same** change set |
| F9 | Drops ritual finish persistence, `compute_hrc`, or `compute_drc` to “save cost” without an explicit Economy budget and product ack |

Engineering clean-break **may**:

- Delete retired dual surfaces (REST/Hono dual client, residual job executors) when residual classes are attested  
- Delete private retired SDK forks when product uses Platform SDK  
- Refactor internals aggressively  

Engineering clean-break **may not** treat “LOC deleted” as success without the product matrix.

---

## 3. Relationship to the North Star Metric

Landing code that cannot emit a qualifying finish, or cannot recompute **DRC** and **HRC** from those finishes, eventually fails product success — even if CI is green.

New play paths must preserve a path to ritual finish rows.  
New metric names in dashboards must not fork [NORTH-STAR-METRIC.md](NORTH-STAR-METRIC.md).

HRC = 0 on a young environment is **not** a merge reject.  
Missing `compute_hrc` after this revision **is** a merge reject for changes that touch the Polar contract.

---

## 4. Game catalog floor

Destination (not yet a delete-protection list): [CATALOG.md](CATALOG.md).  
`queens` / `tango` remain protected until the Crowns / Duo rename ships with redirects.

### 4.1 Protected slugs

The following **`puzzle_ritual`** modules are protected (directories under `apps/puzzled/src/games/`, excluding `shared/`):

| Slug |
|------|
| word-guess |
| word-groups |
| word-hive |
| crossword |
| sudoku |
| nonogram |
| word-ladder |
| arithmo |
| pattern-match |
| block-slide |
| queens |
| tango |
| word-box |
| quad-words |
| killer-sudoku |
| cryptogram |
| word-search |

### 4.2 Add

Allowed when protocol-complete (see [RITUAL-AND-MODULE-PROTOCOL.md](RITUAL-AND-MODULE-PROTOCOL.md)) + tests + this table updated in the same PR if the floor list is meant to expand as protected.

Adding a module **must not** change HRC or DRC definitions.

### 4.3 Remove or replace

Requires:

1. Explicit PR section: user migration, redirects, data retention  
2. Update to this catalog and module registry  
3. Acceptance that DRC and HRC may drop; mitigation plan  
4. Human product owner ack in PR (not silent agent merge)

Hollowing (route lives, play dead) counts as remove.

---

## 5. Merge decision procedure

For any material PR:

```text
IF product game deleted without §4.3: REJECT
IF free daily finish removed: REJECT
IF HRC made paid-only: REJECT
IF client-trusted play returns: REJECT
IF dual play authority claimed sole: REJECT
IF Polar/atom formula changed without package + core oracle: REJECT
IF residual deletes lack attestation when non-obvious: REJECT
IF CI required checks fail: REJECT
IF product matrix shows playable catalog + P1 path: ALLOW (subject to review)
```

### 5.1 Residual attestation (when deleting large trees)

For material delete groups, classify each path group:

`sdk_retired` | `dual_authority` | `rest_residue` | `orphan_relocated` | `pwa_residue` | `product_game` | `other`

- **Forbid** `product_game` without §4.3  
- **Forbid** claiming “SDK-only” if non-`sdk_retired` paths deleted without classes listed  

Historical example: [history/pr64-attestation.md](history/pr64-attestation.md).

---

## 6. Golden journeys (gate)

| ID | Must remain possible on main after merge |
|----|------------------------------------------|
| P1 | Free today play → terminal → card |
| P2 | Share land → play |
| P3 | Multi-module same day (if suite claims multi) |
| P4 | Auth history/streak path |
| P5 | Premium archive fail-closed / allow when entitled |
| P6 | api health + web serve |
| P7 | Admin games list (if admin ships) |

---

## 7. Evidence layers for “done”

See [EVIDENCE-AND-ORACLES.md](EVIDENCE-AND-ORACLES.md).

**Merged ≠ done.**  
**Deployed ≠ done.**  
**Done for a product change** means the relevant layer oracles pass — including live when the claim is live.

Path: **PR → Merge Queue → main → auto deploy → live proof** as configured for the env.

This package change is **done** when it is on `main` via that path (source doctrine landed). Polar *working* as a business remains a live-habit claim and is not completed by the merge.

---

## 8. Public hostnames

Public custom domains are not “done” because `customDomains` contains a string.  
Serving requires Platform **domain_hostnames** verification and gateway routes.  
Do not substitute manual cluster hacks for the product domain path.

Hostname residuals are **not** Polar residuals and not a reason to bypass Merge Queue.

---

## 9. History

| Artifact | Role |
|----------|------|
| [history/PR64-MERGE-GATE.md](history/PR64-MERGE-GATE.md) | One-time merge checklist for clean-break PR #64 |
| [history/pr64-attestation.md](history/pr64-attestation.md) | Evidence for #64 residual classes |

These are **not** living product North Star; they remain for audit. Do not “update history to match HRC.”
