# PZ S3 — direction: the day, and the tokens it needs

> **Superseded 2026-09-26.** The token slice, the display face and the day-surface layout below were replaced by the full redesign recorded in [`docs/design/README.md`](../../design/README.md). This file stays as the record of the S3 diagnosis.

**Status:** program SSOT for stage S3's design direction. Design intent plus the observations that
establish it — this document is **not** evidence that anything is implemented, deployed or live.
**Scope:** the `apps/puzzled` web surface.
**Authority:** `docs/vision.md` and `docs/capabilities.md` win over this document; the field contract under
them is `docs/north-star/` (in particular `RITUAL-AND-MODULE-PROTOCOL.md`); company law is
`SylphxAI/owner`. Program siblings: `README.md` (stages), `gaps.md` (register), `ia.md` (IA),
`s2-audit.md` (S2 record).

## 0. What was measured, and against which revision

| What | Revision | How |
| --- | --- | --- |
| Static reads, the served fold, the raw-key sweep, screenshots | `origin/main` = **`e590b5c`** ("test(web): pin the one-hop console redirect for the default locale (#159)") | materialised with `git archive` into `$HOME/work/pz-s3-before` (the canonical clone was never switched), `bun install --frozen-lockfile`, then `SKIP_ENV_VALIDATION=true NODE_ENV=production bun run build` and `bun run start -p 4322` |
| The same observations after this slice | branch `s3/day-surface` | built the same way in the assignment worktree, served with `bun run start -p 4321` |
| One production probe | `https://puzzled.gg/` — a **stale deployment pinned at `83bd8d4`** | `urllib` GET, 2026-09-20 |

The live site is not evidence about `e590b5c`, and `e590b5c` is not evidence about the live site. Every
claim below says which one it rests on. Evidence files live under `$HOME/work/pz-program/evidence/s3/`.

## 1. Diagnosis

Each claim names the observation that establishes it.

**1. The public shell opens as a marketing funnel.** The top nav is Home / Games / Stats / Archive /
Leaderboard / **Pricing** — `src/shared/components/layout/nav-items.ts:20-27` (`showInTopNav: true`;
`/archive` joined the row in #152). The home fold at `e590b5c` was a sales composition: an eyebrow chip
row, a headline, a subhead, **two co-primary CTAs** (`home-hero.tsx:115` `hero.playCta`,
`:121` `hero.browseCta`), **three trust bullets** (`:129` `hero.trustFree` and its two siblings) and a
metadata card (`:162` `hero.featuredLabel`, `:189` the difficulty chips). The served fold reads:
"A free puzzle, every single day … Play Crowns | Browse all games | Free puzzle every day No account
needed New puzzles at midnight (HKT)". The shelf below it carries premium "Unlock" badges
(`src/features/home/components/today-lineup.tsx:65`; the served `/` renders "Unlock" four times).

**2. The shell palette is Tailwind's default indigo/violet with indigo-tinted shadows.**
`src/app/globals.css:129` — `--color-primary: #4f46e5`, which is Tailwind's **indigo-600**;
`--color-secondary: #8b5cf6` is violet-500. Every shadow in the token layer is tinted
`rgb(99 102 241)` — **indigo-500** — e.g. `--shadow-card` (`:50`), `--shadow-glow` (`:56`), and the
dark-mode block re-tints them `rgb(129 140 248)` (`:270`). Meanwhile the games already own **11
distinct themes** (`src/games/theme-colors.ts`), so the shelf is more colourful than the brand around it.

**3. The type trio is the default SaaS stack.** `src/app/[locale]/layout.tsx:18-38` — Inter (body),
Plus Jakarta Sans (display), JetBrains Mono (code). No display personality and **no dedicated numeral
voice**, in a product where the streak, the timer and the puzzle number are the drama. A
`tabular-nums`/`.tnum` utility exists, which is alignment, not a voice.

**4. The day has no identity on the surface.** `getPuzzleNumber` exists
(`src/features/daily/lib/puzzle-utils.ts:18`) and at `e590b5c` is read only by
`src/features/daily/server.ts:6` — a grep of the base tree for `getPuzzleNumber` in `.tsx` files
returns **zero render sites**. The countdown that does exist
(`src/features/daily/components/next-puzzle-countdown.tsx`) renders on the result modal
(`game-result.tsx:247`) and the already-completed view (`already-completed-view.tsx:265`), never on
`/`. The served `/` at `e590b5c` contains no puzzle number and no reset time.

**5. Social presence is inverted.** `home-hero.tsx:218-219` renders
`playerCount > 0 ? t('hero.playersToday', …) : t('hero.playersTodayNone')`, and `playersTodayNone` is
"Be the first to finish today" (`src/messages/en-US/home.json:27` at the base revision). A landed read
of zero therefore tells a visitor that nobody has finished — and the default path is where a first-time
visitor lands.

**6. Commerce sits on the shelf.** `today-lineup.tsx:20,27,60,65` pass `showUnlock` and the
`lineup.unlock` string into every tile; the served `/` tile order is name, tagline, meta, then
"Premium … Unlock" — the second thing you read is the paywall, not the puzzle.

**7. The feedback machinery exists; the viral unit does not.** `triggerSound`/`triggerHaptic` are wired
into the modules (`src/games/word-guess/word-guess-game.tsx:16,110-115`, and 11 more module files) and
`Celebration`/`StarBurst` are imported by the same module (`:7`). The protocol's non-spoiler result card
is `docs/north-star/RITUAL-AND-MODULE-PROTOCOL.md` §6 "Result card (viral unit)" (`:133`), and register
row **G3** (`docs/program/website-refactor/gaps.md:13`) records the gap: every share site calls
`navigator.share({ text })`, and no `canvas`/`toBlob`/card-rendering helper exists anywhere in `src`
(re-verified: zero matches). **Still open after this slice.**

**8. Defects leak into the shop window.** The live home page prints `games.crowns.difficulty.easy`,
`…medium` and `…hard` as visible text (probe of `https://puzzled.gg/`, 2026-09-20: the string appears
3× in the served HTML). It reproduces on my base revision `e590b5c`: the served `/` at `4322` rendered
exactly those three keys from the featured-module card, while `/games`, `/games/crowns`,
`/games/word-guess`, `/pricing`, `/support`, `/login` and `/signup` were clean. Cause: the fold bound
`games.<slugToCamelCase(slug)>.difficulty.<level>` with no fallback through the `games` namespace,
which is `resolveGameMessages(locale)` (`src/lib/i18n/request.ts`), and four of the five
difficulty-capable modules had no `difficulty` block in their catalogue. Fixed in this slice — names
everywhere, real `difficultyDescriptions` blocks, `descriptionKey` repointed at them, and a guard that
scans every registered config × every locale (`src/lib/i18n/difficulty-copy.test.ts`). The served
branch build renders **0** raw keys and 0 `undefined`/`NaN` across the eight surfaces swept.

## 2. Direction

### 2.1 The first screen is the day, not the pitch

The home fold becomes the day: the **product day** (Asia/Hong_Kong, formatted in the viewer's locale,
via `lib/product-day.ts` and `formatProductDay`), the module's **puzzle number**, and a **"resets in"
clock** to the next product-day boundary. Exactly **one primary action** — "Play today's <Module>" —
with "Browse all games" demoted to a quiet text link. Today's module is shown as a **non-spoiler board
preview** built from the module's own theme (a tile motif; decorative to assistive technology, with a
caption that says so), not a card of metadata rows. The three trust bullets leave the fold for the
evergreen explainer zone, together with the rest of the explanation.

Two rules the surface must obey, in either direction it is later taken:

- **Never claim an unread fact.** `playerCount: number | null` stays the contract: `null` is "the read
  has not landed" and renders nothing, and a landed **zero renders nothing either** — a visitor must
  never be told that nobody is playing. The "Be the first to finish today" string is deleted from all
  five catalogues, not merely unrendered.
- **LCP discipline is not negotiable.** The fold text paints in the first frame with no opacity
  entrance animation: Chrome only counts text as an LCP candidate once it is painted at full opacity,
  so an animated hero hands the slot to whatever else paints first (the consent bar, on this page).
  Motion stays on the board preview beside the text.

### 2.2 The token layer the day needs, and its limits

This slice adds a **display-face token** (`--font-day-display-family`, a real fetch), a **tile
radius/shadow scale** (`--day-tile-radius`, `--day-tile-shadow`, `--day-tile-shadow-hover`) and moves
the **ritual elements** — today's date, the puzzle number, the streak, the countdown — onto the warm
accent this product already declares for delight moments (`--color-accent-warm`, `#f97316`). All of it
is declared under `.day-surface` and consumed by nothing else.

Two constraints shaped it, and both are measured rather than assumed:

- **Contrast.** White on `#f97316` is 3.0:1 and `#f97316` on white is 3.0:1, so the accent is used as
  fill and glow, never as the colour of small text: text that carries the accent uses
  `--color-accent-warm-foreground` (`#7c2d12`, ~8.9:1 on the soft warm surface). The one primary
  action keeps the AA-checked `--color-primary` fill for the same reason.
- **Font budget.** One new face, `preload: false` so it never blocks the first paint. A second,
  purely-numeral face is deliberately deferred.

**Scoped means scoped:** nothing outside `.day-surface` changes colour, radius, shadow or type. This
slice exists so the direction can be judged on one surface before it spreads.

### 2.3 What counts as done for the stage

The direction is only real when the day surface, the tokens and the strings ship together and are
visible in a served production build; typecheck, the unit lane and the build are the floor, not the
proof. Every new string exists in all five locales, and new key paths carry a scan-and-fail guard
(the difficulty guard is the template).

## 3. What this slice deliberately does not cover

- **The viral unit (G3).** No result card is implemented: the protocol §6 requirements and the register
  row are unchanged, and the share path is still `navigator.share({ text })`.
- **The rest of the shell.** Marketing, the catalog, the game pages, auth, pricing and the console keep
  the indigo/violet palette, the indigo-tinted shadows and the card radius scale.
- **The shelf's commerce.** `Premium`/`Unlock` on the tiles, the nav's `Pricing` entry and the order of
  the nav row are recorded above, not changed here.
- **The shell's IA.** `/archive` and `Pricing` stay where they are.
- **360px responsive coverage, the a11y harness in CI, the Lighthouse budget** — register gaps G4/G5 and
  stage S6, untouched.
- **The signed-in console** and the member variants beyond the copy swap.
- **A numeral face.** The display face carries tabular numerals for now.
- **The other ten module themes.** The preview consumes the themed colours; they are not audited here.
