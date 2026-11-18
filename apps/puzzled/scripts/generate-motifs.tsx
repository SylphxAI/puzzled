import { mkdirSync, writeFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { GameMotif, MOTIF_SLUGS } from '../src/shared/components/games/game-motif'

// Regenerate after changing a miniature in src/shared/components/games/game-motif.tsx.
const dir = new URL('../public/motifs/', import.meta.url)
mkdirSync(dir, { recursive: true })
for (const slug of MOTIF_SLUGS) {
	for (const zoom of [false, true]) {
		writeFileSync(
			new URL(`${slug}${zoom ? '-zoom' : ''}.svg`, dir),
			`${renderToStaticMarkup(<GameMotif slug={slug} zoom={zoom} standalone />)}\n`,
		)
	}
}
