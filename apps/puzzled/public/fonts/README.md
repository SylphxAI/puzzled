Provenance: Fraunces (SIL Open Font License 1.1, see OFL.txt) from google/fonts.

- `src/app/fonts/fraunces-display.woff2`: the page display face. Instanced at
  opsz 96, SOFT 50, WONK 0, weight axis kept at 500-700, subset to Latin.
- `public/fonts/fraunces-600.ttf`: the same face at weight 620 as a static TTF,
  because the Open Graph route (next/og, satori) cannot read WOFF2.

Both are made with fontTools (`fontTools.varLib.instancer`, then `pyftsubset`).
The wordmark in `public/brand/wordmark.svg` is the weight-620 outline of the word "Puzzled".
