# PZ redesign spec — direction v1 (for later slices to reuse)
- Concept: midnight study x arcade. A nightly ritual, not a shop.
- Canvas: deep ink blue-black (dark default) / warm paper (light). No cold slate, no indigo.
- Ritual accent: warm amber/orange — streak, countdown, today, CTA. Arcade-sign fill:
  amber fill + deep ink text (kills the white-on-indigo SaaS button).
- Game color: the 11 per-game themes own their cards; the shell never steals their hue.
- Type: display = Space Grotesk (headings, hero); numerals = JetBrains Mono tabular
  (puzzle no., countdown, streak, times). Body stays Inter.
- Motion: fold text paints first frame (LCP rule kept); motion lives on board/tiles;
  press = scale(0.98) + warm shadow; never animate the hero headline.
- Voice: the day speaks (date, puzzle no., time left). Never a pitch in the first screen.
  Never claim an empty room.
