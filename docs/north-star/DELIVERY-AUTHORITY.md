# Puzzled — Delivery Authority

Status: **Normative** (player product outranks ADR-170 convenience on games)  
Revision: 2026-08-11  
Especially binding for: open **PR #64** clean-break

## Product ambition

**Puzzled is a production puzzle-game application:** many real games, user
accounts/settings, analytics, admin, and reliable deploy — not an empty shell
after SDK cleanup.

### Required user jobs (floor)

| Job | Notes |
|---|---|
| Play each shipped game | arithmo, block-slide, crossword, … full catalog on main |
| Difficulty / progress flows | Per-game UX |
| Auth / settings | As product defines |
| Admin games | Operator surface |
| Analytics | Product-defined (no ellipsis jobs) |
| All registry games playable | Every slug above |

## Engineering clean-break (allowed)

PR #64-class work may:

- Sole Connect + sole Rust executor  
- Delete **retired private** local SDK (`sdk-local-retired` / private packages) when product uses formal `@sylphx/sdk`  
- Remove dual authority residuals  

Must **not**:

- Delete games or main player journeys  
- Treat 126k LOC deletion as success without product-work matrix  
- Merge if games/pages regress vs main tip before the PR  

## Gate for PR #64 (and successors)

Before merge:

1. **Product-work matrix** (or explicit statement): every main-tip game slug still playable; page routes preserved or parity successor.  
2. No AgentAppConsole-style hollow replacement for games.  
3. Independent review of “retired SDK only” claim with path list.  
4. CI: web build + Rust + real game unit paths green.

Baseline for regressions: **current `main` before merge** (tip at writing:
check `git rev-parse origin/main`). Optional tag of pre-merge main when #64 merges.

```text
IF #64 removes a game without matrix: REJECT merge.
IF only SDK delete + games remain: ALLOW (engineering clean-break).
IF dual product authority remains after claim sole Rust: REJECT.
```

## Full game catalog (no ellipsis)

**Pinned baseline SHA (main before #64):**   
Tag:  (must point at this SHA).

Registry-facing game modules on baseline (17 directories under  excluding shared):

| Game slug | Rule |
|---|---|
|  | required |
|  | required |
|  | required |
|  | required |
|  | required |
|  | required |
|  | required |
|  | required |
|  | required |
|  | required |
|  | required |
|  | required |
|  | required |
|  | required |
|  | required |
|  | required |
|  | required |

Do **not** list infrastructure files (registry.ts, shared/) as games.

## Attestation schema for #64 deletes
For each material delete path group: .

**Forbid:** claiming “SDK-only” if any  class path is deleted without must_restore.

## Golden journeys (floor)


| ID | Journey |
|---|---|
| P1 | Open game slug → play → complete/fail honestly |
| P2 | Difficulty selection works |
| P3 | Auth session if required for progress |
| P4 | Admin list games |
| P5 | Deploy health for web+api |

## Relationship to ADR-168/169/170

Rust/Connect north star is engineering. Delivery authority protects **player
product** from clean-break overclaim.
