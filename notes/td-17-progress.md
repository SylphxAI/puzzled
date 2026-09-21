# TD-17 - server-side puzzle generation / generation scripts - progress + decision

Branch: debt/td17-generation-scripts
Worktree: $HOME/workspace/.worktrees/github.com/SylphxAI/puzzled/td-17
Base: origin/main = b199007999789d862ac236b94ba010b1c3ff18e1 (fetched + verified 2026-09-21).

## Register row (tech-debt-register.md, written against e590b5c)

> TD-17 | Server-side puzzle generation is reachable only from a script nothing runs |
> `games/registry.server.ts` 215 lines; only importer `scripts/generate-content.ts:15`;
> `package.json:29` `generate:content`; `grep -n generate:content .github/workflows/*.yml` -> 0;
> `scripts/generate-brand-icons.ts` -> 0 references anywhere |
> Dead-at-runtime code that reads as the generation authority competes with the kernel's; an orphan
> script breaks the "everything in scripts/ is wired" assumption |
> Remedy: **Decide and record: schedule content generation (and name where output lands) or delete
> `registry.server.ts` + `generate-content.ts`; delete or wire `generate-brand-icons.ts`**

## Verdict at b1990079

- **Content tool chain** (`registry.server.ts` <- `generate-content.ts` <- `generate:content`): **KEPT. Not deleted.**
  Reachable only from the tool, but deletion is barred by current accepted docs/protocol (below); the
  register's other option ("schedule content generation and name where output lands") is S4/platform
  scope, outside this task's touch limits.
- **`scripts/generate-brand-icons.ts`: WIRED** (package.json `generate:brand-icons`), not deleted.
  Its output (committed PNGs) is consumed by the app; register remedy was "delete or wire".
- **Nothing deleted.** No source files removed; `generate:content` retained (humans may use it).

## Reachability evidence (exact commands, run at b1990079 in this worktree)

- `rg -n 'registry\.server' .` -> only 5 hits: `scripts/generate-content.ts:15` (the sole importer),
  `src/games/registry.test.ts:12,161` (comments on empty skipped tests), `src/games/registry.ts:241`
  (comment), `docs/north-star/history/pr64-attestation.md:73` (history).
- `rg -n 'generateGamePuzzle' .` -> `scripts/generate-content.ts:15,74` + its own definition; nothing else.
- `rg -n 'shouldAlert' . / 'formatGenerationSummary' .` -> own defs + `test.skip` placeholders only
  (`registry.test.ts:160-177`, already skipped: "cannot import 'server-only'").
- `grep -n generate:content .github/workflows/*.yml` -> **0** (register's own check, re-verified).
- Sweep of `apps/puzzled/e2e-tests`, `packages/`, `apps/puzzled/atlas`, `.github/workflows` for all
  symbols above -> **0 hits**.
- `rg -n 'generate-content|generate:content|generate-brand-icons'` repo-wide -> self-headers,
  `package.json:29`, `PROJECT.md:43`, `AGENTS.md:48`, `docs/adr/ADR-170...:69` only.
- Last touched (git log --format with dates):
  - `registry.server.ts`: a4f8ae4 2026-08-13 (prior: c1f5e1d #64 2026-08-11).
  - `generate-content.ts`: c1f5e1d 2026-08-11 - **created** there as the deliberate successor of the
    deleted web job executor (same commit deletes `api/cron/generate-daily-puzzles`,
    `api/jobs/generate-puzzles`, `lib/jobs/handlers/generate-puzzles.ts`).
  - `generate-brand-icons.ts`: a568423 2026-09-17 (#142; PR body: icons "regenerated from one source by
    scripts/generate-brand-icons.ts").
  - No commit cites actually *running* either tool; no run logs exist on this host (last run: unknown).

## Decision (recorded)

1. **Do not delete the content tool chain** - it is retained and required by current, accepted documents:
   - ADR-170 (accepted) §4: "Runtime generation is deleted. `scripts/generate-content.ts` is a standalone
     content tool (procedural + LLM via existing generators) that imports daily puzzles ahead of time into
     the content store. The api service serves and validates from that store." (docs/adr/ADR-170...:69-71)
   - `AGENTS.md:48`: "the content tool (`apps/puzzled/scripts/generate-content.ts`) is the only non-Rust
     backend-adjacent code and it is a standalone tool, not a service."
   - `PROJECT.md:43-44`: "Content: `apps/puzzled/scripts/generate-content.ts` imports day-keyed puzzles
     into the content store (`daily_puzzles`); the api serves and validates from it."
   - docs/north-star/RITUAL-AND-MODULE-PROTOCOL.md §9 (:198, :201): "Preferred: pre-generated content via
     content tool into `daily_puzzles` (ADR-170)." ... "Ops: content for day D+n should exist before day
     D+n traffic (Reliability)."
   - Kernel-side classification keeps it live: `crates/puzzled-core/.../job_catalog.rs:13-14` - LLM_GAMES
     = word-groups, crossword, cryptogram "still require LLM pre-generation (web residual)"; the TS LLM
     generators are reachable only through `registry.server.ts`.
   - The store it feeds is served and preferred at runtime: `connect_puzzle.rs:208` "Content store remains
     preferred when a row exists", :326 "stored row first, then documented deterministic generators".
   - It is the **only writer of `daily_puzzles`** in the repo: `db.insert(dailyPuzzles)` at
     `scripts/generate-content.ts:82` (no other TS/Rust/atlas writer found).
   - The register's alternative "schedule content generation (and name where output lands)" remains open as
     roadmap S4 ("Content tool, ops flags, load", docs/north-star/STRATEGY-ROADMAP.md:106) and needs
     `.github/workflows` or platform ops - both outside this task's touch limits (.github/** off-limits).
     Recorded as a follow-up, not a reason to delete live-by-design infrastructure.
2. **Wire `generate-brand-icons.ts`** (register: "delete or wire"): add
   `"generate:brand-icons": "bun run scripts/generate-brand-icons.ts"` to `apps/puzzled/package.json`
   (same pattern as `verify:seo` <-> `seo-verify.ts`, `generate:content` <-> `generate-content.ts`).
   - Output consumed: `src/app/[locale]/layout.tsx:210-213` links `/favicon.png`, `/favicon.ico`,
     `/apple-touch-icon.png`; `public/manifest.webmanifest:44-62` refs `/icons/*.png`; layout metadata
     `logo` -> `/icons/icon-512.png`. #142 (4 days before base) established the script as the reproducer
     of those committed PNGs; deleting it would leave no regeneration path.
   - A CI "regenerate and diff" gate for the icons would need a `.github/workflows` change (off-limits
     here; noted for the .github owner).

## Proofs (change = package.json one-line script entry + this note)

- **Baseline** `env -u NODE_ENV bun test src` @ b1990079, before any edit:
  **1141 pass / 6 skip / 0 fail**; 34667 expect() calls; 1147 tests across 116 files; 98.07s
  (td17-tests-before.txt).
- **After** `env -u NODE_ENV bun test src` @ 6327b51: **1141 pass / 6 skip / 0 fail**; 34667 expect() calls; 1147 tests across 116 files; 102.61s (td17-tests-after.txt) - identical totals to the baseline.
- `bun run typecheck` (tsc --noEmit && tsc --noEmit -p tsconfig.e2e.json): **exit 0** (td17-typecheck.txt).
- `bun run lint` (biome check .): **exit 0**; 23 pre-existing infos (all `lint/style/useTemplate` in result-card files from #164; none in changed files) (td17-biome.txt).
- `SKIP_ENV_VALIDATION=true NODE_ENV=production bun run build`: **exit 0**, full route table emitted; `git status --porcelain` clean after the build (td17-build.txt).
- CI/build paths that could invoke the content tools: **none** - neither name appears in any workflow;
  build steps (next build, scripts/assert-document-route.mjs, cargo build) do not touch them.

## Next action

PR: https://github.com/SylphxAI/puzzled/pull/173 (base main; open for review). TD-17 closes as: content tool KEPT (decision recorded), brand icons WIRED. Local gates green (above).
