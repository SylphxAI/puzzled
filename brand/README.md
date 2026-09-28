# Puzzled brand

This folder is the source of truth for the Puzzled brand: the vector masters,
the generated icons and the colour and type tokens, with where each file came
from. Every surface copies from here. `brand/tokens.css` and every raster are
generated - edit a master, then run `python3 brand/build.py` (pillow, resvg-py
and numpy; the header of `build.py` says how). `python3 brand/build.py --check`
verifies the generated files and the surface copies with the standard library
alone, and CI runs it.

## Name

- **Running text:** Puzzled. It keeps the Latin name in every locale; the zh-HK
  and zh-CN text writes it as "Puzzled" ("歡迎來到 Puzzled！"). The subscription
  is "Puzzled Plus", two words and two capitals.
- **Legal name and operator:** Puzzled is operated by Sylphx Limited,
  registered in England and Wales, company no. 16438428, registered office
  128 City Road, London EC1V 2NX. The company line lives in the footer
  copyright and on the legal pages; it is never part of the brand, never
  locked up with the mark and never carries the logo.
- **Capitals:** nothing is capitalised only in the logo. The wordmark draws
  "Puzzled" in the same spelling as running text; never "PUZZLED".
- **Domain:** puzzled.gg.

## Files

| Need | File |
|---|---|
| The mark: ink tile, question-mark hook, amber dot | `svg/puzzled-symbol.svg` |
| The mark in one colour, for any ink (`currentColor`) | `svg/puzzled-symbol-mono.svg` |
| The mark all black / all white | `svg/puzzled-symbol-black.svg`, `svg/puzzled-symbol-white.svg` |
| The word alone, `currentColor` / black / white | `svg/puzzled-wordmark.svg`, `svg/puzzled-wordmark-black.svg`, `svg/puzzled-wordmark-white.svg` |
| App icon master (rounded ground) | `svg/puzzled-app-icon.svg` |
| iOS home screen (square, opaque) | `svg/puzzled-app-icon-square.svg` |
| Android maskable (full bleed, glyph in the safe zone) | `svg/puzzled-maskable.svg` |
| Browser tab: 16 and 32 px, pixel grids | `favicon/grid-16.txt`, `favicon/grid-32.txt` (hand-editable), `favicon/favicon.svg` (the 32 px grid, switches to a paper tile in dark mode), `favicon/favicon.ico` (16, 32, 48) |
| Ready-made PNGs | `favicon/favicon-{16,32,48}.png`; `app-icon/apple-touch-icon-180.png`; `app-icon/icon-{48,72,96,128,144,152,192,384,512}.png`; `app-icon/icon-maskable-512.png` |
| Colour and type values | `tokens.json`; the generated CSS variables are `tokens.css` |
| Generator | `build.py` and its spec `brand.json` |
| Where each file came from | `provenance.json` |

There is no lockup file: the header and footer compose the mark and the
wordmark in React, and no single file draws the pair. Do not invent one.

## Colours

| Token | Hex | Use |
|---|---|---|
| `paper` | `#F7F4EE` | page ground (light) |
| `paper-dark` | `#121110` | page ground (dark) |
| `card` | `#FFFFFF` | raised surfaces (light) |
| `card-dark` | `#1C1B18` | raised surfaces (dark) |
| `ink` | `#1A1712` | text and the primary action fill (light); the ground of the mark |
| `ink-dark` | `#F2EEE6` | text and the primary action fill (dark) |
| `muted` | `#5F584C` | secondary text (light) |
| `muted-dark` | `#AAA396` | secondary text (dark) |
| `border` | `#E4DED2` | hairlines (light) |
| `border-dark` | `#2F2C27` | hairlines (dark) |
| `accent` | `#F4B42A` | the mark's amber tile, Plus markers, the win badge; a fill only, never small text on paper |
| `accent-text` | `#6E4A00` | text that carries the accent (light) |
| `accent-text-dark` | `#F7CF73` | text that carries the accent (dark) |
| `focus` | `#2458D6` | focus ring, 2px offset 2px (light) |
| `focus-dark` | `#7EA6FF` | focus ring (dark) |

The game colours (one pastel field per game) are content colours, not brand
colours; they stay with the games in `apps/puzzled/src/games/theme-colors.ts`.

## Type

- **Display:** Fraunces, SIL OFL 1.1. Headlines, game names and big numbers
  only. Self-hosted: `apps/puzzled/src/app/fonts/fraunces-display.woff2` is the
  instanced variable face (opsz 96, SOFT 50, WONK 0, weights 500-700, Latin
  subset, about 30 KB, preloaded);
  `apps/puzzled/public/fonts/fraunces-600.ttf` is the weight-620 static face
  for the Open Graph route, which cannot read WOFF2. Both are made with
  fontTools; provenance in `apps/puzzled/public/fonts/README.md`.
- **Text and interface:** the platform face (`-apple-system`, Segoe UI,
  Roboto), with PingFang TC / Noto Sans TC for zh-Hant and PingFang SC /
  Noto Sans SC for zh-CN. Nothing to host, nothing to load.
- **Numbers:** tabular figures (`.tnum`, `.numeral`) in the app.

## Small sizes

16 and 32 px are not scaled-down vectors. The master is rendered at 8x and each
pixel takes the colour most of its samples agree on, or stays empty when fewer
than half of them are filled (`snap_threshold` in `brand.json`). The result is
`favicon/grid-16.txt` and `favicon/grid-32.txt`: one character per pixel, a
letter for each palette colour and `.` for empty. They are meant to be
hand-edited, and later runs draw from the edited grid; `python3 brand/build.py
--resnap` redraws both grids from the master and throws the edits away.
`favicon.svg` is the 32 px grid as rectangles, and it swaps ink and paper when
the browser is in a dark theme (`dark_map` in `brand.json`), so the tile stays
readable on a dark tab strip.

## Clear space and minimum size

Not yet specified. The design doc records none, and no clear-space guide file
exists. The masters are tight to the artwork, so any clear space has to be
added where the logo is placed.

## Do / Don't

The design doc records no usage rules for the mark yet. The rules it does carry
that touch the brand:

- **Do** keep amber a fill. It never carries small text on paper (`accent-text`
  and `accent-text-dark` carry text).
- **Do** let `favicon.svg` swap to the paper tile by itself in dark mode; there
  is no second dark-mode file to choose from.

Everything else a logo sheet normally states is **not yet specified**, so a
file in `svg/` is currently used as drawn.

## Surfaces

These files in the app are copies of files above; do not edit them there, edit
the master here and run `python3 brand/build.py` (CI fails when a copy drifts).

| Surface (URL it serves) | Brand file it copies |
|---|---|
| `apps/puzzled/public/favicon.ico` | `favicon/favicon.ico` |
| `apps/puzzled/public/favicon.png` (32 px) | `favicon/favicon-32.png` |
| `apps/puzzled/public/favicon.svg` | `favicon/favicon.svg` |
| `apps/puzzled/public/apple-touch-icon.png` (180 px) | `app-icon/apple-touch-icon-180.png` |
| `apps/puzzled/public/icons/icon-48.png` … `icon-512.png` | `app-icon/icon-48.png` … `icon-512.png` |
| `apps/puzzled/public/icons/icon-maskable-512.png` | `app-icon/icon-maskable-512.png` |
| `apps/puzzled/public/brand/mark.svg` (named by the proxy skip-list test) | `svg/puzzled-symbol.svg` |
| `apps/puzzled/public/brand/mark-mono.svg` (`<link rel="mask-icon">`) | `svg/puzzled-symbol-mono.svg` |

The sizes are the ones the surfaces already declare: `48x48 72x72 96x96
128x128 144x144 152x152 192x192 384x384 512x512` and the 512 maskable in
`manifest.webmanifest`, `32x32` for `/favicon.png`, and 16, 32 and 48 inside
`/favicon.ico` (`sizes="48x48"`, `rel="apple-touch-icon"` with no size for the
180 px file) from `apps/puzzled/src/app/[locale]/layout.tsx`.

Four files this folder replaced were served but nothing referenced, and are
gone: `apps/puzzled/public/brand/wordmark.svg` (the wordmark is a master now,
drawn from `svg/`), `apps/puzzled/public/icons/favicon-16x16.png` and
`icons/favicon-32x32.png` (duplicates of the 16 and 32 px favicons inside
`favicon.ico` and `favicon.png`), and `apps/puzzled/public/icons/apple-touch-icon.png`
(a duplicate of `/apple-touch-icon.png`). `git grep` finds no reference to any
of the four.

### Surfaces still to move

- `apps/puzzled/src/shared/components/brand/mark.tsx` - `BrandMark` redraws the
  mark and holds `MARK_AMBER`, and `Wordmark` holds the wordmark path data;
  both duplicate `svg/`.
- `apps/puzzled/src/shared/components/layout/logo.tsx` - composes the mark and
  wordmark that a lockup file would draw.
- `apps/puzzled/src/app/[locale]/og/route.tsx` - its own geometry and its own
  `PAPER` and `MUTED` literals.
- `apps/puzzled/src/features/daily/lib/result-card-render.ts` - its own paper,
  border and amber literals for the 1080x1080 card.
- `apps/puzzled/src/shared/components/not-found-view.tsx` - hard-codes the paper,
  ink, muted, line, card and focus hex in an inline stylesheet.
- `apps/puzzled/src/app/[locale]/layout.tsx` - `themeColor` and the JSON-LD
  `logo` hard-code `#f7f4ee`, `#121110` and `/icons/icon-512.png`.

## Provenance

| File | Where it came from |
|---|---|
| `svg/puzzled-symbol.svg`, `svg/puzzled-symbol-mono.svg` | `apps/puzzled/public/brand/mark.svg` and `mark-mono.svg`, added in a5684237 (2026-09-17, #142), redrawn in b17cef0f (2026-09-26, #248 redesign) |
| `svg/puzzled-wordmark.svg` | `apps/puzzled/public/brand/wordmark.svg`, added in b17cef0f (2026-09-26, #248) |
| `svg/puzzled-favicon.svg` | `apps/puzzled/public/favicon.svg`, added under this name in 38528845 (2026-01-08), current form in b17cef0f (2026-09-26, #248) |
| `svg/puzzled-app-icon.svg`, `svg/puzzled-app-icon-square.svg`, `svg/puzzled-maskable.svg` | Written 2026-09-28 for this brand home, wrapping the symbol's own paths in the ground, corner radius and glyph scale that `apps/puzzled/scripts/generate-brand-icons.ts` used (a5684237, 2026-09-17, #142) until this folder replaced it |
| `svg/puzzled-symbol-black.svg`, `-white`, `svg/puzzled-wordmark-black.svg`, `-white` | The mono and wordmark masters with every fill and stroke set to `#000000` / `#FFFFFF`; shapes unchanged |

Every file's SHA-256 is in `provenance.json`.

## Trademark

Not registered. Owner decision owner#781: no trademark filings before the
product earns money. Use ™ at most, never ®.

<!-- similarity: filled in by review -->
