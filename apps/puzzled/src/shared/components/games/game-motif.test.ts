import { describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { getAllGameMetadata } from '@/games/registry'
import { GameMotif, GameMotifImage, hasGameMotif, MOTIF_SLUGS, motifSrc } from './game-motif'

const PUBLIC = new URL('../../../../public', import.meta.url)

describe('game board miniatures', () => {
	test('every registered game has its own decorative miniature', () => {
		for (const game of getAllGameMetadata()) {
			expect(hasGameMotif(game.slug)).toBe(true)
			const svg = renderToStaticMarkup(createElement(GameMotif, { slug: game.slug }))
			expect(svg).toContain('aria-hidden="true"')
			expect(svg).toContain('viewBox="0 0 160 100"')
		}
	})

	test('zoom crops the canvas margin; an unknown game draws nothing', () => {
		const zoomed = renderToStaticMarkup(createElement(GameMotif, { slug: 'sudoku', zoom: true }))
		expect(zoomed).toContain('viewBox="14 8 132 84"')
		expect(renderToStaticMarkup(createElement(GameMotif, { slug: 'nope' }))).toBe('')
		expect(renderToStaticMarkup(createElement(GameMotifImage, { slug: 'nope' }))).toBe('')
	})

	test('the static files in public/motifs are exactly the generated miniatures', () => {
		// Regenerate with `bun scripts/generate-motifs.tsx` after changing a motif.
		const expected = MOTIF_SLUGS.flatMap((slug) => [false, true].map((zoom) => ({ slug, zoom })))
		const files = readdirSync(new URL(`${PUBLIC.pathname}/motifs`, 'file://')).sort()
		expect(files).toEqual(
			expected.map(({ slug, zoom }) => motifSrc(slug, zoom).replace('/motifs/', '')).sort(),
		)
		for (const { slug, zoom } of expected) {
			const onDisk = readFileSync(`${PUBLIC.pathname}${motifSrc(slug, zoom)}`, 'utf8')
			const generated = `${renderToStaticMarkup(createElement(GameMotif, { slug, zoom, standalone: true }))}\n`
			expect(onDisk).toBe(generated)
			expect(onDisk).toContain('xmlns="http://www.w3.org/2000/svg"')
		}
	})

	test('the image variant is one decorative, lazily decoded node', () => {
		const html = renderToStaticMarkup(
			createElement(GameMotifImage, { slug: 'word-hive', zoom: true }),
		)
		expect(html).toContain('src="/motifs/word-hive-zoom.svg"')
		expect(html).toContain('alt=""')
		expect(html).toContain('loading="lazy"')
	})
})
