---
version: alpha
name: Puzzled
description: Daily light brain games. Bright tiles on a chalk-white board, one amber answer dot, chunky friendly type.
colors:
  primary: "#F4B42A"
  on-primary: "#1A1712"
  primary-edge: "#C98A0B"
  secondary: "#1A1712"
  on-secondary: "#FCFBF8"
  surface: "#FCFBF8"
  surface-container: "#F2EFE8"
  on-surface: "#1A1712"
  on-surface-variant: "#5C564B"
  outline: "#DDD7CB"
  accent-text: "#7A5200"
  success: "#1D7A4C"
  on-success: "#FFFFFF"
  error: "#C42B1C"
  on-error: "#FFFFFF"
  focus: "#2458D6"
  tile-coral: "#FF8A6B"
  tile-teal: "#2BB3A3"
  tile-violet: "#A596FF"
  tile-leaf: "#86CB6E"
  tile-sky: "#62B8F2"
  tile-rose: "#F59BC0"
  surface-dark: "#141311"
  surface-container-dark: "#1F1D1A"
  on-surface-dark: "#F3EFE7"
  on-surface-variant-dark: "#ADA698"
  outline-dark: "#38342E"
  primary-dark: "#F4B42A"
  on-primary-dark: "#1A1712"
  secondary-dark: "#F3EFE7"
  on-secondary-dark: "#141311"
  accent-text-dark: "#F7CF73"
  success-dark: "#5DD39A"
  error-dark: "#FF8A7A"
  on-error-dark: "#1A1712"
  focus-dark: "#7EA6FF"
typography:
  display: { fontFamily: Bricolage Grotesque, fontSize: 48px, fontWeight: 800, lineHeight: 1.0, letterSpacing: -0.03em }
  headline-lg: { fontFamily: Bricolage Grotesque, fontSize: 32px, fontWeight: 800, lineHeight: 1.1, letterSpacing: -0.02em }
  headline-md: { fontFamily: Bricolage Grotesque, fontSize: 24px, fontWeight: 700, lineHeight: 1.15, letterSpacing: -0.01em }
  title: { fontFamily: Bricolage Grotesque, fontSize: 18px, fontWeight: 700, lineHeight: 1.25 }
  body-md: { fontFamily: Figtree, fontSize: 16px, fontWeight: 400, lineHeight: 1.55 }
  body-sm: { fontFamily: Figtree, fontSize: 14px, fontWeight: 400, lineHeight: 1.5 }
  label-lg: { fontFamily: Figtree, fontSize: 16px, fontWeight: 700, lineHeight: 1.2 }
  label-md: { fontFamily: Figtree, fontSize: 14px, fontWeight: 600, lineHeight: 1.2 }
  label-sm: { fontFamily: Figtree, fontSize: 12px, fontWeight: 700, lineHeight: 1.2, letterSpacing: 0.04em }
  tile-glyph: { fontFamily: Bricolage Grotesque, fontSize: 28px, fontWeight: 800, lineHeight: 1.0, fontFeature: '"tnum"' }
  numeral: { fontFamily: Figtree, fontSize: 20px, fontWeight: 700, lineHeight: 1.0, fontFeature: '"tnum"' }
rounded:
  none: 0px
  sm: 6px
  md: 12px
  lg: 20px
  xl: 28px
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  xxl: 48px
  gutter: 16px
  margin-mobile: 16px
  margin-desktop: 32px
  content-max: 1040px
  board-max: 480px
  tap-min: 48px
  edge: 4px
components:
  button-primary: { backgroundColor: "{colors.primary}", textColor: "{colors.on-primary}", typography: "{typography.label-lg}", rounded: "{rounded.md}", padding: 16px, height: 56px }
  button-primary-pressed: { backgroundColor: "{colors.primary-edge}", textColor: "{colors.on-primary}" }
  button-secondary: { backgroundColor: "{colors.secondary}", textColor: "{colors.on-secondary}", typography: "{typography.label-lg}", rounded: "{rounded.md}", padding: 16px, height: 48px }
  button-ghost: { backgroundColor: "{colors.surface}", textColor: "{colors.on-surface}", typography: "{typography.label-md}", rounded: "{rounded.md}", padding: 12px, height: 48px }
  input: { backgroundColor: "{colors.surface}", textColor: "{colors.on-surface}", typography: "{typography.body-md}", rounded: "{rounded.md}", padding: 14px, height: 52px }
  input-error: { backgroundColor: "{colors.surface}", textColor: "{colors.error}" }
  card: { backgroundColor: "{colors.surface}", textColor: "{colors.on-surface}", rounded: "{rounded.lg}", padding: 20px }
  nav: { backgroundColor: "{colors.surface}", textColor: "{colors.on-surface}", typography: "{typography.label-md}", height: 56px, padding: 16px }
  game-tile: { backgroundColor: "{colors.surface}", textColor: "{colors.on-surface}", typography: "{typography.tile-glyph}", rounded: "{rounded.md}", size: 56px }
  game-tile-correct: { backgroundColor: "{colors.tile-teal}", textColor: "{colors.on-surface}" }
  game-tile-present: { backgroundColor: "{colors.primary}", textColor: "{colors.on-primary}" }
  game-tile-absent: { backgroundColor: "{colors.surface-container}", textColor: "{colors.on-surface-variant}" }
  daily-card: { backgroundColor: "{colors.tile-coral}", textColor: "{colors.on-surface}", typography: "{typography.headline-lg}", rounded: "{rounded.xl}", padding: 24px }
  game-card: { backgroundColor: "{colors.tile-sky}", textColor: "{colors.on-surface}", typography: "{typography.title}", rounded: "{rounded.lg}", padding: 16px }
  result-card: { backgroundColor: "{colors.secondary}", textColor: "{colors.on-secondary}", typography: "{typography.headline-md}", rounded: "{rounded.xl}", size: 1080px }
  chip-plus: { backgroundColor: "{colors.primary}", textColor: "{colors.on-primary}", typography: "{typography.label-sm}", rounded: "{rounded.full}", padding: 6px }
  button-primary-dark: { backgroundColor: "{colors.primary-dark}", textColor: "{colors.on-primary-dark}" }
  button-secondary-dark: { backgroundColor: "{colors.secondary-dark}", textColor: "{colors.on-secondary-dark}" }
  card-dark: { backgroundColor: "{colors.surface-dark}", textColor: "{colors.on-surface-dark}" }
  caption-dark: { backgroundColor: "{colors.surface-dark}", textColor: "{colors.on-surface-variant-dark}", typography: "{typography.body-sm}" }
  input-error-dark: { backgroundColor: "{colors.surface-dark}", textColor: "{colors.error-dark}" }
  streak-badge: { backgroundColor: "{colors.surface}", textColor: "{colors.accent-text}", typography: "{typography.numeral}", rounded: "{rounded.full}", padding: 8px }
  streak-badge-dark: { backgroundColor: "{colors.surface-dark}", textColor: "{colors.accent-text-dark}" }
  toast-success: { backgroundColor: "{colors.success}", textColor: "{colors.on-success}", typography: "{typography.label-md}", rounded: "{rounded.md}", padding: 12px }
---

# Puzzled

## Overview

Puzzled (puzzled.gg) is a daily set of short word, logic and number puzzles;
one is free every day, takes minutes and needs no account. Players: anyone with a
phone and a coffee break, in English, zh-HK or zh-CN. The design must
make starting instant, finishing feel like a small win, and the result card
worth sending.

**Personality: the toy box, not the newspaper.** Chunky, bright tiles on a
clean board: tactile, cheerful, quick. Not cream paper and serifs, not a
casino, not a brain-training lab.

**The tile is the idea.** The mark is an ink tile with a question-mark hook
and an amber dot; that amber dot is the moment the answer clicks. Games are
tiles, buttons are tiles with a pressable edge, and the one amber thing on a
screen is the thing to press next.

**Brand architecture.** Puzzled stands alone. Sylphx is publisher only:
footer copyright, store developer field, legal pages; never by the mark or in
images. Always "Puzzled" (never
"PUZZLED"), Latin in every locale; the subscription is "Puzzled Plus". Use the
existing mark from `brand/svg/` as drawn.

**Voice.** Warm, brief and a little witty, never smug. Second person, short
sentences, plain verbs: "Today's Five is ready." "Solved in 1:42. Nice."
Celebrate finishing, not beating people. No IQ or brain-health claims, no
false urgency, no guilt about missed days. zh-HK copy uses natural
Hong Kong Traditional Chinese, not converted Simplified.

**Images for social posts and marketing.** Flat, tile-built compositions:
rounded squares in the tile colours on a Chalk (#FCFBF8) or Ink (#1A1712)
ground, one amber tile as focal point, a big Bricolage Grotesque headline. Show real puzzle grids mid-solve or result
patterns, never today's answer. Allowed: flat vector shapes, real screenshots in
a plain phone outline. Not allowed: stock photos, light bulbs or brains, 3D
gloss, neon, photoreal AI scenes, mascots, other publishers' games. Default
formats: 1080x1080 and 1080x1350.

## Colors

Two inks, one amber, a clean board and a box of six tile colours.

- **Amber (#F4B42A):** `primary`. The mark's answer dot. Fills the one main
  action per screen, the "present" tile state and Plus chips. Ink text on it;
  never text itself on light grounds.
- **Amber Edge (#C98A0B):** `primary-edge`. Key edge and pressed state of amber
  buttons. Fill only.
- **Ink (#1A1712):** `secondary`, `on-surface`, `on-primary`. Text, the mark's
  ground, secondary buttons, result cards.
- **Chalk (#FCFBF8):** `surface`, `on-secondary`. Page and card ground; near-white,
  deliberately not cream.
- **Board (#F2EFE8):** `surface-container`. The tray under tiles and cards; the
  "absent" tile state.
- **Pebble (#5C564B):** `on-surface-variant`. Secondary text and captions.
- **Hairline (#DDD7CB):** `outline`. Input borders and dividers only.
- **Amber Text (#7A5200):** `accent-text`. Amber-reading text on light grounds
  (streaks, "Plus").
- **Leaf Green (#1D7A4C)** `success` and **Signal Red (#C42B1C)** `error`,
  each with white (#FFFFFF) text (`on-success`, `on-error`). Focus ring is **Blue
  (#2458D6)**, 2px with 2px offset.
- **Tile colours:** Coral (#FF8A6B), Teal (#2BB3A3), Violet (#A596FF), Leaf
  (#86CB6E), Sky (#62B8F2), Rose (#F59BC0). Each game owns one for its card,
  hero and share image. All carry Ink text. Teal is the "correct" state.

**Dark mode** follows the system setting. Night Board (#141311) `surface-dark`, Night
Tray (#1F1D1A) `surface-container-dark`, Bone (#F3EFE7) `on-surface-dark` and
`secondary-dark` (on it, `on-secondary-dark` #141311), Dust (#ADA698)
`on-surface-variant-dark`, Night Line (#38342E) `outline-dark`. Amber stays
#F4B42A `primary-dark` with Ink `on-primary-dark` (#1A1712). Light Amber
(#F7CF73) `accent-text-dark`, Mint (#5DD39A) `success-dark`, Coral Red
(#FF8A7A) `error-dark` with Ink `on-error-dark` (#1A1712), Light Blue
(#7EA6FF) `focus-dark`. Tile colours are unchanged and keep Ink text.

## Typography

- **Display and headlines: Bricolage Grotesque** (SIL OFL), weights 700–800,
  tight tracking: chunky and a bit quirky, like a hand-cut tile. Headlines,
  game names, tile letters, big results.
- **Interface and body: Figtree** (SIL OFL), 400 for text, 600–700 for
  labels and buttons; round and legible at 14–16px.
- **Chinese:** Noto Sans HK for zh-HK and Noto Sans SC for zh-CN (both SIL
  OFL), 700 for headlines, 400 for text. Chinese headlines use
  `letterSpacing: 0` and `lineHeight` at least 1.3.
- **Fallback stack:** the brand face, then `"Noto Sans HK"` / `"Noto Sans
  SC"` by locale, then `system-ui, "PingFang HK", "PingFang SC", sans-serif`.
- **Numbers:** timers, scores and streaks use `numeral` or `tile-glyph`
  (tabular figures) so digits never jump.
- Sentence case everywhere, tags included ("Free today").

## Layout

Mobile first at 375px. One column on phones with 16px margins; desktop
centres content at 1040px max, 32px margins, a two- or three-column game grid.
The play board is one centred column, max 480px.

Spacing runs on a 4px base: 4, 8, 16, 24, 32, 48. Tiles in a grid sit 8px
apart; cards in a list sit 16px apart; sections are 48px apart. Every tap
target is at least 48px. Home shows today's free puzzle above the fold, then a
short rotation; the full catalogue has its own page.

## Elevation & Depth

Depth is **the key press**, not floating shadows: buttons, tiles and game
cards stand on a solid 4px bottom edge with no blur: Amber Edge under amber,
Ink at 20% under light tiles, Ink at 35% under tile colours. Pressed, they
drop 4px and the edge vanishes. Cards sit flat: Chalk on
the Board tray, separated by tone, Hairline only where tone is not enough. Only dialogs and sheets get a blurred
shadow (0 16px 40px Ink at 18%). Dark-mode edges are black at 50%.

## Shapes

Rounded squares echo the mark's tile (corner about 22% of a small tile).
Tiles, buttons and inputs use `md` 12px; game cards and content cards use
`lg` 20px; the daily hero and the result card use `xl` 28px; chips and
avatars are `full`. Small inner marks use `sm` 6px. No sharp corners, round
tiles or blobs. Icons: 2px rounded-stroke line icons, 24px grid.

## Components

- **button-primary:** Amber, Ink `label-lg`, 56px, Amber Edge key edge. One
  per screen ("Play today's Five", "Share result").
- **button-secondary:** Ink with Chalk text, 48px, for the second action.
  **button-ghost** is text on Chalk for tertiary links.
- **input:** Chalk, 2px Hairline border, 52px; focus turns the border Blue;
  errors add a Signal Red border and message below.
- **card:** Chalk on the Board tray, 20px corners and padding.
- **nav:** 56px Chalk bar, mark and "Puzzled" wordmark left, streak and
  account right; phones add a bottom tab bar.
- **game-tile:** the 56px puzzle cell with `tile-glyph`. Empty (Chalk,
  Hairline), correct (Teal), present (Amber), absent (Board, Pebble text);
  each state also changes an icon or shape. Reveal flips in under 300ms.
- **daily-card:** home hero for the free puzzle, on that game's tile colour,
  with name, puzzle number, time estimate and one amber play button.
- **game-card:** catalogue entry on its tile colour, one-line rule, a
  **chip-plus** when locked.
- **result-card:** the 1080px share square: Ink ground, mark and wordmark top
  left, game and puzzle number, the result pattern in tile colours, time in
  `numeral`, puzzled.gg at the foot. Never the answer.
- **streak-badge** (Amber Text numeral) and **toast-success** (Leaf Green)
  are the only celebratory chrome; no confetti storms.

## Do's and Don'ts

- Do keep one Amber button per screen; other actions are Ink or ghost.
- Do give each game one tile colour and use it on its card, hero and share image.
- Do put Ink text on every Amber and tile-colour fill; never white on them.
- Do show the free daily puzzle first and let a guest finish it with no signup.
- Don't use cream paper, newspaper serifs or rule lines; that is another brand.
- Don't put Sylphx next to the mark, in headlines or in any image.
- Don't show today's answer in any post, preview or result card.
- Don't rely on colour alone for tile states.
- Don't use urgency, guilt or IQ claims in copy or images.
- Don't redraw, recolour or add effects to the mark.
