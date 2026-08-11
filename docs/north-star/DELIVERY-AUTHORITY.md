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
| Play each shipped game | Full 17-slug catalog on main (see table below) |
| Difficulty / progress flows | Per-game UX |
| Auth / settings | As product defines |
| Admin games | Operator surface |
| Analytics | Product-defined (no ellipsis jobs) |
| All registry games playable | Every slug above |

## Engineering clean-break (allowed)

PR #64-class work may:

- Sole Connect + sole Rust executor  
- Delete **retired private** local SDK (`packages/sdk` / private workspace) when product uses formal `@sylphx/sdk`  
- Remove dual authority residuals (web jobs/cron/REST dual surface)

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
`9c7de8644d2acaefc43ed660fa3f9e36d77838ce`). Optional tag of pre-merge main when #64 merges.

```text
IF #64 removes a game without matrix: REJECT merge.
IF only SDK delete + games remain: ALLOW (engineering clean-break).
IF dual-authority residual delete + games remain + residual classes attested: ALLOW under clean-break (not "SDK-only").
IF dual product authority remains after claim sole Rust: REJECT.
IF claim is "SDK-only" but non-SDK product paths deleted without residual attestation: REJECT.
```

## Full game catalog (no ellipsis)

**Pinned baseline SHA (main before #64):** `9c7de8644d2acaefc43ed660fa3f9e36d77838ce`  
Tag: (optional) `pre-pr64-main` must point at this SHA when cut.

Registry-facing game modules on baseline (17 directories under
`apps/puzzled/src/games/` excluding `shared/`):

| Game slug | Rule |
|---|---|
| word-guess | required |
| word-groups | required |
| word-hive | required |
| crossword | required |
| sudoku | required |
| nonogram | required |
| word-ladder | required |
| arithmo | required |
| pattern-match | required |
| block-slide | required |
| queens | required |
| tango | required |
| word-box | required |
| quad-words | required |
| killer-sudoku | required |
| cryptogram | required |
| word-search | required |

Do **not** list infrastructure files (`registry.ts`, `shared/`) as games.

## Attestation schema for #64 deletes

For each material delete path group: class ∈
`{sdk_retired, dual_authority_web_jobs_cron, rust_http_rest_residue_to_connect,
orphan_root_src_relocated, pwa_monitoring_residue, product_game, other}` +
count + sample paths + allow/forbid.

**Forbid:** claiming “SDK-only” if any non-`sdk_retired` class path is deleted
without residual attestation.  
**Forbid:** any `product_game` class delete without must_restore.

See filled evidence: [pr64-attestation.md](pr64-attestation.md).

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
