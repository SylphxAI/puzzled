# Puzzled design system

**Status:** current brand and interface system, landed 2026-09-26. It replaces the
"midnight study x arcade" direction in `notes/redesign-spec.md` and the S3 token
slice in `docs/program/website-refactor/s3-direction.md`.
**Code:** tokens live in `apps/puzzled/src/app/globals.css` (`@theme` and `.dark`); a
token change updates this file in the same pull request.

## Brand

- **Positioning:** *A few good puzzles, every day.* One puzzle is always free and
  needs no account; Puzzled Plus opens every game, every past day and every stat.
- **Personality:** calm, clever, crafted.
- **References studied (2026-09-26):**
  - New York Times Games: a bold serif display face, black ink buttons, and one flat
    colour and one glyph per game. Its pricing offers two plans as radio cards.
  - Puzzmo: an editorial daily lineup with hairline rules and a play status per game.
  - Apple News+ Puzzles: iOS type and bottom tabs.
  - Wordle-likes: the result grid as the thing people share.
  - thetimes.com/puzzles blocks automated browsers, so it was not captured.
  - Puzzled takes the calm of paper and ink from these, and adds a native-app shell
    (tab bar, sheets, press feedback) and a result card image instead of a text grid.
- **Name use:** "Puzzled" only. The legal operator, Sylphx Limited, appears in the
  footer copyright line and in the legal pages, never in the brand.

### Mark and wordmark

| Asset | File | Notes |
| --- | --- | --- |
| Symbol (app icon) | `apps/puzzled/public/brand/mark.svg` | A question-mark hook whose dot is one amber tile: the piece you are looking for. 64-unit canvas, 8-unit stroke, round caps |
| Symbol, one colour | `apps/puzzled/public/brand/mark-mono.svg` | `currentColor`; also the Safari pinned-tab mask |
| Wordmark | `apps/puzzled/public/brand/wordmark.svg` | "Puzzled" in Fraunces at weight 620, as outlines (no font needed) |
| Favicon | `apps/puzzled/public/favicon.svg` | Switches to a paper tile in dark mode |
| Raster icons | `apps/puzzled/public/icons/*`, `favicon.ico`, `favicon.png`, `apple-touch-icon.png` | `bun run generate:brand-icons` renders them from `mark.svg` (rounded, square for iOS, maskable with a safe zone) |
| Social image | `apps/puzzled/src/app/[locale]/og/route.tsx` | 1200×630, paper ground; the right panel takes the game's colour, or ink for site pages |
| Result card | `apps/puzzled/src/features/daily/lib/result-card-render.ts` | 1080×1080 PNG, paper ground and the game's colour band; no solution can reach it |

React renders the mark and wordmark through `BrandMark` and `Wordmark` in
`src/shared/components/brand/mark.tsx`, which share their path data with the OG route.

## Tokens

### Colour

| Role | Light | Dark | Use |
| --- | --- | --- | --- |
| Background (paper) | `#f7f4ee` | `#121110` | page ground |
| Card | `#ffffff` | `#1c1b18` | raised surfaces |
| Foreground (ink) | `#1a1712` | `#f2eee6` | text, the primary action fill |
| Muted text | `#5f584c` | `#aaa396` | secondary text (AA on paper, card and muted) |
| Border | `#e4ded2` | `#2f2c27` | hairlines |
| Primary | ink | paper | the one filled action per screen |
| Accent (amber) | `#f4b42a` | `#f4b42a` | the mark's tile, Plus markers, the win badge. Used as a fill only, never as small text on paper |
| Accent text | `#6e4a00` | `#f7cf73` | text that carries the accent |
| Focus ring | `#2458d6` | `#7ea6ff` | 2px, offset 2px |
| Success / error / info | `#176a3b` / `#a82b23` / `#2458d6` | `#6fcf8e` / `#f27b70` / `#7ea6ff` | states |

Dark mode is its own warm charcoal palette, not an inversion. The pastel game fields
keep their colour in dark mode, as printed colour does.

**Game colours** (`src/games/theme-colors.ts`): each game has one flat pastel field, its
glyph in ink, and a deep form of the hue for small text on paper.

| Theme | Field | Deep | Games |
| --- | --- | --- | --- |
| emerald | `#a8d5b5` | `#1d6b3d` | Five |
| cyan | `#a6d8dd` | `#0e5f68` | Sudoku, Hunt, Frame |
| violet | `#c6b9f2` | `#4b37a6` | Crowns, Cipher, Threads |
| amber | `#f5d36b` | `#6e4a00` | Hive, Duo, Quad |
| pink | `#f3b8d0` | `#9a2a5c` | Paint |
| rose | `#f0aba3` | `#9b2f24` | Cage Sudoku |
| blue | `#aec6f2` | `#2045a0` | Mini Grid |
| sky | `#b5ddf4` | `#0f5a85` | Match |
| orange | `#f5bd8e` | `#8e3f0c` | Rungs, Spots |
| lime | `#cfe39a` | `#4a6512` | Arithmo |
| slate | `#cfc9bc` | `#4f4a40` | Slides, Path |

### Type

- **Display:** Fraunces (SIL OFL 1.1), self-hosted as one variable WOFF2 (weights
  500-700, optical size 96, softness 50), subset to Latin, 30 KB, preloaded. It is used
  for headlines, game names and big numbers only. Provenance: `apps/puzzled/public/fonts/README.md`.
- **Text and interface:** the platform face (`-apple-system`, Segoe UI, Roboto), with
  PingFang TC / Noto Sans TC for `zh-Hant` and PingFang SC / Noto Sans SC for `zh-CN`.
  CJK headlines fall back to the CJK serif (Songti / Noto Serif).
- **Numbers:** tabular figures (`.tnum`, `.numeral`) for clocks, streaks and puzzle numbers.
- **Scale (phone → desktop):** page title 34 → 56-64 px; section title 26 → 30 px;
  body 17 px; secondary 13-15 px; tab labels 10.5 px.

### Radius, elevation, motion

- **Radius:** 8 / 10 / 14 / 18 / 22 / 28 / 36 px (`sm` … `4xl`). Cards use 16-22 px,
  sheets 28 px, and buttons are capsules.
- **Elevation:** neutral ink shadows, never tinted. `shadow-card` is nearly flat;
  `shadow-lift` on hover; `shadow-sheet` for bottom sheets. Dark mode swaps shadows for
  a 1px light edge.
- **Motion:** 120 / 180 / 240 / 320 ms with ease-out `cubic-bezier(0.22, 1, 0.36, 1)`.
  Direct manipulation uses a spring. Press feedback is `scale(0.97)` (`.pressable`,
  every Button). `prefers-reduced-motion` turns all animation and transition off
  globally. Headlines are never animated, because they are the LCP element.

## Shell and navigation

| Surface | Phone | Tablet and desktop |
| --- | --- | --- |
| Header | lockup, streak, menu sheet; translucent, safe-area aware | lockup; Today, Games, Archive, Stats as text links with an ink underline for the current page; Puzzled Plus; theme; language; account |
| Tab bar | Today, Games, Archive, Stats, Account; translucent; heavier icon stroke for the current tab; above the home indicator | none |
| Menu sheet | the five tabs, Puzzled Plus, Leaderboard, Support, settings, sound, theme, language | none |
| Footer | lockup, positioning line, language; Play, Product and Legal columns; legal operator line | same, four columns |

## Information architecture

| Page | Job | Notes |
| --- | --- | --- |
| `/` Today | play today's free puzzle in one tap; see the day's lineup | masthead (date, puzzle number, reset clock); one featured card holds the only primary action; lineup; value or member stats; tomorrow; FAQ |
| `/games` | find a game | search, category filter, a 2 / 3 / 4-column grid |
| `/games/{slug}` | learn and play one game | full-bleed cover in the game's colour; the difficulty list; the board; rules, tips, FAQ, related games |
| `/archive` | replay a past day | sign-in gate for guests |
| `/stats`, `/leaderboard` | see your record | 2×2 summary; today's list; streak calendar |
| `/pricing` | understand and buy Puzzled Plus | live prices from `ListPlans`; Plus emphasised; closed-sales state lists what Plus includes |
| `/profile`, `/settings/*`, `/family/join` | manage the account | shared console chrome |
| `/login`, `/signup`, password pages | account access | Sylphx Auth end users |
| `/terms`, `/privacy`, `/support` | legal and help | operator: Sylphx Limited |
| 404, error | recover | 404 offers today's free puzzle first |

Removed from the home page: the "How Puzzled works" steps, the trust bullet row and the
closing sales band (the featured card and the FAQ carry that job). Removed from `/games`:
the featured-game band (the grid marks today's free game), the explainer and the closing
band. Leaderboard moved from the top bar to Stats, the menu sheet and the footer.

## States

- A game whose day has no puzzle shows "Today's {game} isn't ready yet" and links to
  today's free puzzle. It never claims a connection problem. A failed fetch shows a retry.
- Unread personal data renders geometry-matched skeletons, never zeros.
- Dialogs are bottom sheets on phones (grabber, safe-area padding, 28 px corners) and
  centred cards from 640 px.

## Screens

`docs/design/screens/` holds the release screenshots: every key page at 390×844,
820×1180 and 1440×900, in light and dark, as WebP.
