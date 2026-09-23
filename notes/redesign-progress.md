# PZ redesign — progress (in-session lane, 2026-09-22 01:4x BST)

Spawned children died twice with no output (36s, 8s) -> per briefing skill, work continues
IN-SESSION from a fresh worktree. Branch: feat/redesign-atmosphere @ origin/main 7dd8e93.

## Premise check vs tree (CORRECTIONS to the brief)
- The S3 day surface already landed on main: HomeDay = date + puzzle number + HKT countdown +
  one CTA, sales structure removed, playerCount null-safe (no 'be the first'). Brief's 'hero is
  a sales page' premise is STALE. What remains is the SHELL around it.
- Display font already partially in: Space Grotesk -> --font-day-display-family (scoped to
  .day-surface). Tailwind default indigo (#4f46e5, rgb(99 102 241) shadows) still owns the shell.
- #180-183 are all MERGED into origin/main (7dd8e93 includes #180/#182/#183).

## Slice-1 scope (revised to what the tree still needs)
1. Spread atmosphere beyond .day-surface: global palette (kill indigo), warm ritual accent,
   ink/paper surfaces, re-tinted shadows, per-game colors on cards.
2. Typography: display voice on headings, tabular numerals global (streak/countdown/stats).
3. Nav de-SaaS: Pricing -> footer; primary = Play/Games/Stats/Leaderboard.
4. Polish: hover/press micro-interactions, spacing rhythm, WCAG 2.2 AA contrast.

## Next action
- bun install (running), dev server, before screenshots, then the edits in globals.css /
  layout.tsx / console-chrome.tsx, after screenshots, build + tests, commit + push.

## 01:5x BST — slice 1 done in-session
- globals.css: full palette re-tint (warm paper light / deep ink dark, terracotta primary,
  orange-400 dark primary, warm shadows/aurora/grid/gradient), global .numeral voice,
  display font = Space Grotesk (via --font-display chain).
- nav-items.ts: /pricing removed from NAV_ITEMS (footer + value points keep it).
- Verification: unit tests 1214 pass / 5 fail (getBaseUrl x4 + schema/attribution parity —
  environment-dependent, untouched areas; to re-verify on CI). Biome clean on touched files.
- Screenshots: notes/screenshots before-* / after-* (desktop+mobile x light+dark).
  NOTE: local dev has no puzzled API (API_INTERNAL_URL unset) so both sides show the honest
  'could not read' states equally; the skin comparison is fair, the data is absent.
- Next: result share card slice; per-game theme cards spread; empty states polish; retake shots
  against a live local stack; independent review before any landing.

## 2026-09-23 ~02:5x BST — CI a11y lane was RED on this branch; fixed with evidence
- Failing job: Accessibility (WCAG 2.2 AA), run 35747193624 — 20 specs (desktop-light + mobile-light of `notes` routes).
- Root causes (axe, from the job log): (1) `bg-primary/10 text-primary` = #c2410c on #f4e4d8 = 4.17:1 (nav pills, bottom-nav, chips);
  (2) footer language switcher `text-white/90` on the paper `bg-background` button = 1.06:1; (3) `text-amber-700` chips
  tipped under 4.5 by the warmer page background.
- Fixes on branch: light `--color-primary` #c2410c -> #9a3412 (hover #7c2d12) — text-on-tint now 5.8:1, text-on-paper 6.8:1, white-on-fill 7.3:1;
  footer switcher gets `tone="inverse"` (transparent on ink band, white text); amber chips -> `text-amber-800` (6.4:1).
- Evidence: LOCAL spec `bunx playwright test e2e-tests/a11y.e2e.ts -g light` against the dev server = **30 passed (0 failed)**;
  dark re-run in progress; probe scripts committed (scripts/a11y-probe*.ts). Screenshots retaken on the final palette.
