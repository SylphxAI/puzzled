import { describe, expect, test } from 'bun:test'
import { getAllGameMetadata, getGameSlugs } from '@/games/registry'
import { slugToCamelCase } from '@/lib/game-slug'
import { buildCatalogEntries, type CatalogEntry, filterCatalogEntries } from './catalog'

/**
 * Golden player titles per canonical slug. Deliberately independent from the
 * registry `name` field: the player-facing catalogue never ships "Word Guess"
 * for `word-guess` (that title is "Five").
 */
const CANONICAL_TITLES: Record<string, string> = {
	'word-guess': 'Five',
	'word-groups': 'Threads',
	'word-hive': 'Hive',
	crossword: 'Mini Grid',
	sudoku: 'Sudoku',
	nonogram: 'Paint',
	'word-ladder': 'Rungs',
	arithmo: 'Arithmo',
	'pattern-match': 'Match',
	'block-slide': 'Slides',
	crowns: 'Crowns',
	duo: 'Duo',
	'word-box': 'Frame',
	'quad-words': 'Quad',
	'killer-sudoku': 'Cage Sudoku',
	cryptogram: 'Cipher',
	'word-search': 'Hunt',
	'number-path': 'Path',
	'pip-place': 'Spots',
}

function build(isPremium: boolean, freeGameSlug = 'sudoku'): CatalogEntry[] {
	return buildCatalogEntries({
		modules: getAllGameMetadata(),
		freeGameSlug,
		isPremium,
	})
}

function entryFor(entries: readonly CatalogEntry[], slug: string): CatalogEntry {
	const entry = entries.find((candidate) => candidate.slug === slug)
	if (!entry) throw new Error(`missing catalog entry for ${slug}`)
	return entry
}

describe('buildCatalogEntries', () => {
	test('lists every registered module exactly once', () => {
		const entries = build(false)
		const registryOrder = getAllGameMetadata().map((game) => game.slug)

		expect(entries.map((entry) => entry.slug)).toEqual(registryOrder)
		expect(entries).toHaveLength(getGameSlugs().length)
		expect(new Set(entries.map((entry) => entry.slug))).toEqual(new Set(getGameSlugs()))
	})

	test('maps every registry slug to its canonical player title', () => {
		const entries = build(false)

		expect(Object.keys(CANONICAL_TITLES).sort()).toEqual([...getGameSlugs()].sort())
		for (const entry of entries) {
			expect(entry.canonicalTitle).toBe(CANONICAL_TITLES[entry.slug])
		}
	})

	test('derives i18n keys from the canonical slug, not alias config keys', () => {
		const entries = build(false)

		// Multi-word slugs are the interesting case; literal expectations keep
		// the camelCase transform independently pinned from the shared helper.
		expect(entryFor(entries, 'word-guess').titleKey).toBe('games.wordGuess.name')
		expect(entryFor(entries, 'killer-sudoku').taglineKey).toBe('games.killerSudoku.tagline')

		const crowns = entryFor(entries, 'crowns')
		expect(crowns.titleKey).toBe('games.crowns.name')
		expect(crowns.taglineKey).toBe('games.crowns.tagline')

		const duo = entryFor(entries, 'duo')
		expect(duo.titleKey).toBe('games.duo.name')
		expect(duo.taglineKey).toBe('games.duo.tagline')

		for (const entry of entries) {
			const camel = slugToCamelCase(entry.slug)
			expect(entry.titleKey).toBe(`games.${camel}.name`)
			expect(entry.taglineKey).toBe(`games.${camel}.tagline`)
			expect(entry.duration.length).toBeGreaterThan(0)
		}
	})

	test("marks only the product day's free module as free for a free viewer", () => {
		const entries = build(false, 'crowns')

		const freeEntries = entries.filter((entry) => entry.freeToday)
		expect(freeEntries.map((entry) => entry.slug)).toEqual(['crowns'])
		expect(freeEntries[0]?.locked).toBe(false)

		for (const entry of entries) {
			if (entry.slug === 'crowns') continue
			expect(entry.freeToday).toBe(false)
			expect(entry.locked).toBe(true)
		}
	})

	test('unlocks every module for a premium viewer while keeping the free badge', () => {
		const entries = build(true, 'crowns')

		expect(entries.every((entry) => entry.locked === false)).toBe(true)
		expect(entries.filter((entry) => entry.freeToday).map((entry) => entry.slug)).toEqual([
			'crowns',
		])
	})

	test('treats an inbound alias as the canonical free module', () => {
		const entries = build(false, 'queens')
		const crowns = entryFor(entries, 'crowns')

		expect(crowns.freeToday).toBe(true)
		expect(crowns.locked).toBe(false)
	})

	test('returns an empty list for an empty registry', () => {
		expect(buildCatalogEntries({ modules: [], freeGameSlug: 'sudoku', isPremium: false })).toEqual(
			[],
		)
	})
})

describe('filterCatalogEntries', () => {
	const titled = [
		{ slug: 'word-guess', title: 'Five' },
		{ slug: 'crowns', title: 'Crowns' },
		{ slug: 'sudoku', title: 'Sudoku' },
	] as const

	test('keeps the full list for an empty query', () => {
		expect(filterCatalogEntries(titled, '')).toEqual([...titled])
		expect(filterCatalogEntries(titled, '   ')).toEqual([...titled])
	})

	test('matches titles case-insensitively and trims the query', () => {
		expect(filterCatalogEntries(titled, 'five').map((entry) => entry.slug)).toEqual(['word-guess'])
		expect(filterCatalogEntries(titled, '  CRO ').map((entry) => entry.slug)).toEqual(['crowns'])
	})

	test('returns nothing when no title matches', () => {
		expect(filterCatalogEntries(titled, 'checkers')).toEqual([])
	})
})
