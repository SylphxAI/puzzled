# Independent review — PR #184 feat/redesign-atmosphere (SylphxAI/puzzled)

Verifier: review subagent (slice-1), never the author. Head reviewed: **820e9ec** (commits e74fcbe skin, 0aaa880 shots, b3e5346 a11y fix, 9a38620 notes, 820e9ec biome) vs base **origin/main 7dd8e93** (ancestry confirmed: "7dd8e93 IS ancestor of HEAD"). Worktree: /data/sylphx/home/work/pz-rev-slice1 (branch review/redesign-slice1; never pushed to author branch).
Predecessor check: no leftover notes/review-slice1-verdict.md existed anywhere under work/, worktrees/, repos/ — predecessors died with no output; unknown treated as empty.
Live-host checks: UNVERIFIED by policy (outbound HTTPS unreliable); all evidence below is local/static/git.

## VERDICT: PASS — no blockers found in this diff. Advisory residuals R1-R5 below.

## Evidence table
| # | Claim under test | Method | Reproduced result |
|---|---|---|---|
| 1a | light bg rgb(250,246,239) | token globals.css:190 + committed screenshot pixels | #faf6ef = rgb(250,246,239) — MATCH |
| 1b | dark bg rgb(14,18,38) | token globals.css:217 + screenshot pixels | #0e1226 = rgb(14,18,38) — MATCH |
| 1c | h1 resolves Space Grotesk first | chain globals.css:25 (day-display first) + layout.tsx:49-50 (Space_Grotesk) + .font-display globals.css:616 | MATCH (static); redesign-verify.ts itself not executed (no dev server run, bounded instruction) |
| 2 | WCAG ratios both themes | node relative-luminance script, tints composited over real surfaces | all claimed pairs pass 4.5 text / 3.0 UI (table below) |
| 3 | b3e5346 minimal and correct | read diff of b3e5346 alone | 2 CSS token lines + 3 one-class edits + 1 footer prop; correct (notes below) |
| 4 | a11y spec 30/0 light + 30/0 dark | NOT rerun locally (instruction: CI runs it) | fallback: hand-computed contrast + CI status; Accessibility lane IN_PROGRESS at review time (run 35809041601) |
| 5 | 5 unit failures pre-existing | read tests + env deps + diff scope | proven pre-existing by construction (no test file or exercised source touched) |
| 6 | screenshots after match tokens, before do not | ImageMagick pixel samples on committed PNGs | after-light (720,450)=250,246,239 OK; after-dark=14,18,38 OK; before-light=#ffffff no; before-dark=15,23,42 (old slate) no — MATCH |
| 7 | lint/typecheck clean on diff | CI lane on head 820e9ec | Lint & Type Check SUCCESS (43s); 820e9ec is itself the biome fix |
| 8 | no stray edits | per-commit stat + name-status vs 7dd8e93 | none outside apps/puzzled/** + notes/** |

## Contrast math (WCAG 2.x; text 4.5:1, large/UI 3:1)
LIGHT (paper #faf6ef, card #fffdf8):
- primary #9a3412 on paper = **6.78:1** (claim 6.8; globals.css:129)
- primary on primary/10 tint over paper (#f0e3d9) = **5.81:1** (claim 5.8)
- primary on primary/10 tint over card (#f5e9e1) = 6.13:1
- primary-foreground #fff7ed on primary = **6.88:1** (claim "7.3:1 white-on-fill" is pure #ffffff = 7.31:1; token value still passes AA — R2)
- muted-foreground #5b5170 on background = **6.83:1**, on card = **7.23:1** (globals.css:197)
- amber-800 #92400e on amber-500/10 tint (#faedd8) = **6.13:1**; on amber-700/10 (#f3e6d8) = 5.78:1
- stat-streak #9a3412 on its /10 tint = 5.81:1; stat-winrate #15803d on paper = 4.66:1; stat-best #b45309 on paper = 4.66:1 (thin pass; no /10 tints of winrate/best exist in code)
- ring #ea580c on paper = 3.30:1 (UI ok); ink band: #f6f1e7 on #1e1b4b = **14.20:1**
Pre-fix reproduction of author axe findings: #c2410c on #f4e4d8 = **4.18:1** (claim 4.17); white/90 on paper = 1.07:1 (claim 1.06); amber-700 #b45309 on amber-500/10 = 4.34:1 (under 4.5, consistent).
DARK (ink #0e1226, card #191d38, muted #232846):
- primary #fb923c on ink = **8.19:1** (globals.css:240); on primary/10 tint = **7.09:1**
- primary-foreground #1e1b4b on primary = **7.06:1** (comment claims 7.3/8.0 — cosmetic staleness, R3)
- muted-foreground #a9a3c4 on background = **7.70:1**, card 6.85:1, muted 5.96:1 (globals.css:230)
- stat colors on their /10 tints: winrate 8.94, streak 7.09, cyan 10.42, violet 8.39 (all pass)
- ink band dark: #f2ecdf on #0b1020 = 16.08:1

## b3e5346 notes (minimal & correct)
- globals.css:129-130 only: --color-primary #c2410c->#9a3412, hover ->#7c2d12. No other token moved in this commit.
- footer.tsx:33: old prop className="border-white/20 text-white/90" left the outline Button bg-background (#faf6ef) => white-on-paper 1.07:1; new tone="inverse" yields border-white/25 bg-transparent text-white (language-switcher.tsx:106) over surface-ink (globals.css:607, ink #1e1b4b) => ~15:1. Minimal, correct.
- three amber edits one class each, dark: variants kept: stats/page.tsx:167, milestone-rings.tsx:18, difficulty-selection-view.tsx:59.
- No remaining light-on-light: every text-white in shared/components/layout/ is on the ink band or inside the inverse tone (footer.tsx:38/67/105, language-switcher.tsx:106, logo.tsx:37).

## Pre-existing test failures (claim 1214 pass / 5 fail)
Diff touches no test file and no module those tests exercise (name-status: globals.css, 3 components, nav-items.ts, 5 scripts, notes, 8 PNGs).
- getBaseUrl x4 (utils.test.ts:54-74, site-origin.test.ts:161-177): assert localhost/prod-origin; behave per env (VERCEL_URL / NEXT_PUBLIC_APP_URL / NODE_ENV); files identical at 7dd8e93 and head.
- schema-parity (apps/puzzled/src/lib/db/schema-parity.test.ts:31): needs Atlas + SCHEMA_PARITY_DEV_URL dev DB; exit 2 fails by design. Env-dependent, untouched.
=> The same 5 fail on origin/main; not introduced by this branch.

## Residuals (advisory, non-blocking)
- R1 milestone-rings.tsx:20 gold text-amber-600 on bg-amber-500/15 = **2.66:1** if rendered with milestones loaded — pre-existing line untouched by branch; recommend follow-up.
- R2 "7.3:1 white-on-fill" true for #ffffff; actual token #fff7ed = 6.88:1 (still passes).
- R3 stale numeric comments (dark block 7.3/8.0 vs computed 7.06/8.19) — cosmetic.
- R4 input border #e6dccd on paper = 1.26:1 — pre-existing non-text-contrast risk (old #e2e8f0 ~1.3:1), unchanged.
- R5 CI at review time (run 35809041601, head 820e9ec): pass = Lint & Type Check, SEO Contract, Migration Integrity, Rust API, Security Scan; IN_PROGRESS = Unit Tests, Accessibility (WCAG 2.2 AA), Lighthouse Budgets. Final green not yet observed.
- Hygiene: 5 probe scripts committed (a11y-probe{,2,3}.ts near-duplicates) — not unrelated edits, but repo-noise; cleanup candidate.

Artifacts: /data/sylphx/home/tmp/review-slice1/ (step*.txt, contrast*.mjs). ~16 tool calls used.

## Addendum (same session, ~03:2x)
- 1c concrete anchor: the home h1 is features/home/components/home-day.tsx:106 with class font-display; .font-display -> var(--font-display) -> Space_Grotesk first (globals.css:25,616-617; layout.tsx:49-50).
- Pushed: review/redesign-slice1 @ 71ba91e (verdict file). Author branch untouched.
- CI re-read at this time (gh pr checks 184):
Accessibility (WCAG 2.2 AA)	pass	4m9s	https://github.com/SylphxAI/puzzled/actions/runs/35809041601/job/107016473780	
Build	pass	3m31s	https://github.com/SylphxAI/puzzled/actions/runs/35809041601/job/107017102951	
Lighthouse Budgets	pass	7m50s	https://github.com/SylphxAI/puzzled/actions/runs/35809041601/job/107016473797	
Lint & Type Check	pass	43s	https://github.com/SylphxAI/puzzled/actions/runs/35809041601/job/107016193025	
Migration Integrity	pass	12s	https://github.com/SylphxAI/puzzled/actions/runs/35809041601/job/107016192883	
Rust API	pass	2m17s	https://github.com/SylphxAI/puzzled/actions/runs/35809041601/job/107016193129	
SEO Contract	pass	56s	https://github.com/SylphxAI/puzzled/actions/runs/35809041601/job/107016473792	
Security Scan	pass	19s	https://github.com/SylphxAI/puzzled/actions/runs/35809041601/job/107016193126	
Unit Tests	pass	2m18s	https://github.com/SylphxAI/puzzled/actions/runs/35809041601/job/107016473849	
