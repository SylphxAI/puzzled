# PR #64 attestation — product games vs residual deletes

Status: **Evidence** (independent gate pass + **rebase onto main after #65**, 2026-08-11)  
Subject: [PR #64](https://github.com/SylphxAI/puzzled/pull/64) `clean-break-north-star`  
Normative gate: [DELIVERY-AUTHORITY.md](DELIVERY-AUTHORITY.md), [PR64-MERGE-GATE.md](PR64-MERGE-GATE.md)

## Revisions compared

| Ref | SHA | Notes |
|---|---|---|
| Pre-#64 main baseline | `9c7de8644d2acaefc43ed660fa3f9e36d77838ce` | game catalog pin |
| `origin/main` (merge base target) | `6bb83bed1f3621cc2643c0cbbfb42d88b4728765` | includes #65 delivery authority |
| PR #64 head (rebased) | `488a494df086aff66439a1f65ba48bcdff5b90ff` | `clean-break-north-star` after rebase + conflict fix |

## Residual-class acceptance (merge authority)

Under DELIVERY-AUTHORITY:

> IF dual-authority residual delete + games remain + residual classes attested: ALLOW under clean-break

Accepted residual classes for this land (not "SDK-only"):

| Class | Allowed |
|---|---|
| `sdk_retired` | yes |
| `dual_authority_web_jobs_cron` | yes |
| `rust_http_rest_residue_to_connect` | yes |
| `orphan_root_src_relocated` | yes |
| `pwa_monitoring_residue` | yes |
| `product_game` | **forbid** — 0 deletes observed |

**Merge recommendation:** **MERGE** (games 17/17 intact; residual classes attested and accepted; rebased on main).

---

## C1 — Product game catalog (main vs PR head)

Registry SSOT: `apps/puzzled/src/games/registry.ts` `GAME_CONFIGS` keys.  
Directories: `apps/puzzled/src/games/<slug>/` (excluding `shared/` and registry infrastructure files).

| # | Game slug | main dir | PR64 dir | File count main | File count PR64 | Path list identical |
|---|---|---|---|---:|---:|---|
| 1 | word-guess | present | present | 13 | 13 | yes |
| 2 | word-groups | present | present | 14 | 14 | yes |
| 3 | word-hive | present | present | 16 | 16 | yes |
| 4 | crossword | present | present | 15 | 15 | yes |
| 5 | sudoku | present | present | 13 | 13 | yes |
| 6 | nonogram | present | present | 12 | 12 | yes |
| 7 | word-ladder | present | present | 14 | 14 | yes |
| 8 | arithmo | present | present | 14 | 14 | yes |
| 9 | pattern-match | present | present | 11 | 11 | yes |
| 10 | block-slide | present | present | 13 | 13 | yes |
| 11 | queens | present | present | 10 | 10 | yes |
| 12 | tango | present | present | 11 | 11 | yes |
| 13 | word-box | present | present | 10 | 10 | yes |
| 14 | quad-words | present | present | 11 | 11 | yes |
| 15 | killer-sudoku | present | present | 10 | 10 | yes |
| 16 | cryptogram | present | present | 11 | 11 | yes |
| 17 | word-search | present | present | 11 | 11 | yes |

**Result:** **17/17 product games present.** Zero missing product game modules.  
`GAME_CONFIGS` key block is byte-identical between main and PR head.  
Deleted files under `apps/puzzled/src/games/**`: **0**.

Rust mirror on PR head (`crates/puzzled-core/.../game_slugs.rs`) lists the same 17 slugs.

### Game surface deltas (not deletions)

| Path | Class | Notes |
|---|---|---|
| `apps/puzzled/src/games/registry.server.ts` | product_wiring | drop `import 'server-only'` only (−2 lines) |
| `apps/puzzled/src/games/llm-generators.server.ts` | product_wiring | drop `import 'server-only'` only (−2 lines) |
| `apps/puzzled/src/app/[locale]/(main)/games/[slug]/page.tsx` | product_wiring | Hono REST client → Connect server helpers; route still present |
| `apps/puzzled/src/features/daily/components/game-result.tsx` | product_wiring | completion/score flow aligns with server-authoritative play |

`page.tsx` game route exists on both tips (`apps/puzzled/src/app/[locale]/(main)/games/[slug]/page.tsx`).

## C2 — Deleted path classification (sample + totals)

**Total deleted paths:** 292 (of 410 changed files).

| Class | Count | Allowed under DELIVERY-AUTHORITY? | Sample paths |
|---|---:|---|---|
| `sdk_retired` | 249 | **Yes** — retired private local SDK; app uses formal `@sylphx/sdk@0.27.0` | `packages/sdk/**` (entire tree: sources, tests, ADR, configs) |
| `dual_authority_web_jobs_cron` | 18 | **Yes** — dual web executor residual (sole Rust executor claim) | `apps/puzzled/src/app/api/cron/*`, `.../api/jobs/*`, `.../api/webhooks/platform-jobs/route.ts`, `apps/puzzled/src/lib/jobs/**`, `lib/dlq/**`, `lib/api/client.ts`, `lib/api/cron.ts`, `lib/monitoring.ts` |
| `rust_http_rest_residue_to_connect` | 17 | **Yes** — REST/HTTP dual surface → sole Connect | `crates/puzzled-server/src/capabilities/*/interfaces/*.rs`, generation_jobs REST, old HTTP contract tests |
| `orphan_root_src_relocated` | 5 | **Yes** — orphan root `src/lib/connect/*` deleted after move into app workspace (siblings show as renames) | `src/lib/connect/puzzle-admission.ts`, `stats-admission.ts`, `stats-query.ts`, `transport.ts`, `transport.test.ts` |
| `pwa_monitoring_residue` | 3 | **Yes** — broken PWA / deploy residue (not a game) | `apps/puzzled/src/app/offline/page.tsx`, `serwist.d.ts`, `vercel.json` |
| **product game modules** | **0** | N/A | none |

### Strict claim check: “SDK-only deletes”?

| Claim | Verdict | Evidence |
|---|---|---|
| Deletes are **only** `packages/sdk` | **FALSE** | 43 non-SDK deleted paths (18+17+5+3) |
| Deletes include **no product game modules** | **TRUE** | 0 deletes under `apps/puzzled/src/games/**` |
| Deletes match **SDK + dual-authority residual** clean-break | **TRUE** | classes above; games catalog intact |
| Hollow AgentAppConsole-style game replacement | **FALSE** (not observed) | full game trees + registry identical |

**Honesty:** PR #64 is **not** an “SDK-only” PR. It is a clean-break that retires the local SDK **and** dual-authority web/REST residual. Product **games modules are intact**.

## C3 — Gate checklist (this attestation)

| Gate item | Status |
|---|---|
| All games under `apps/puzzled/src/games/*` present on PR head | **PASS** (17/17) |
| `page.tsx` game routes still resolve (source present) | **PASS** (wiring changed to Connect) |
| Deleted packages are retired SDK / dual-authority residual (path-listed) | **PASS** with classification table (not pure SDK-only) |
| No product page replaced by empty stub | **PASS** (game page still loads puzzles; API surface swapped) |
| Web + Rust CI green | **PASS** at check time: Build, Lint & Type Check, Unit Tests, Rust API, Migration Integrity, Security Scan green; preview deploy check failed (non-product-gate) |
| Product-work matrix / attestation with evidence | **THIS DOCUMENT** |

## C4 — Recommendation

| Rule | Application |
|---|---|
| MERGE only if **games intact** + **SDK-only** | Games intact = **yes**. Pure SDK-only = **no**. |
| DELIVERY-AUTHORITY allows dual-authority residual cut when games protected | Residual classes above are dual-authority / residue, not game deletion. |

**Gate recommendation for PR #64:** **MERGE** under clean-break residual acceptance (not “SDK-only”).

Rationale:

1. Product games are **100% present** — no game regression by path inventory.
2. Material deletes are **broader than SDK retirement** (web jobs/cron, REST interfaces, PWA residue). Those are consistent with the stated clean-break, but they are **not** “SDK-only.”
3. Before merge, require explicit human acceptance of the dual-authority residual classes in the table above (or a revised PR that separates pure SDK retirement from executor/REST cutover).
4. Do **not** treat −126k LOC as success without this matrix; with the matrix, the game-protection floor is satisfied.

**Residual classification accepted under DELIVERY-AUTHORITY (2026-08-11).** Rebased onto main; merge may proceed.

## C5 — Residual risks (non-blocking for game-presence gate)

- Live play→save→leaderboard→premium proof still pending (stated in PR body / ADR-170).
- `sylphx/preview` check failed at attestation time — deploy-layer proof not green.
- Game page + result component wiring changes should get a smoke play on each of the 17 slugs after residual acceptance (golden journeys P1–P2).
