import { describe, expect, test } from 'bun:test'
import { getAllGameMetadata, getGameSlugs } from '@/games/registry'
import { slugToCamelCase } from '@/lib/game-slug'
import {
	buildCatalogEntries,
	type CatalogEntry,
	filterCatalogEntries,
	parseCatalogCategory,
	readMessage,
	relatedCatalogSlugs,
} from './catalog'

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

	test('carries each module colour theme, highlight key and category from the registry', () => {
		const entries = build(false)

		for (const moduleMetadata of getAllGameMetadata()) {
			const entry = entryFor(entries, moduleMetadata.slug)
			expect(entry.theme).toBe(moduleMetadata.display.theme)
			expect(entry.highlightKey).toBe(moduleMetadata.display.highlightKey)
			expect(entry.category).toBe(moduleMetadata.category)
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
		{ slug: 'word-guess', title: 'Five', category: 'word' },
		{ slug: 'crowns', title: 'Crowns', category: 'logic' },
		{ slug: 'sudoku', title: 'Sudoku', category: 'logic' },
	] as const

	test('keeps the full list for an empty query', () => {
		expect(filterCatalogEntries(titled, {})).toEqual([...titled])
		expect(filterCatalogEntries(titled, { query: '   ' })).toEqual([...titled])
		expect(filterCatalogEntries(titled, { category: 'all' })).toEqual([...titled])
	})

	test('matches titles case-insensitively and trims the query', () => {
		expect(filterCatalogEntries(titled, { query: 'five' }).map((entry) => entry.slug)).toEqual([
			'word-guess',
		])
		expect(filterCatalogEntries(titled, { query: '  CRO ' }).map((entry) => entry.slug)).toEqual([
			'crowns',
		])
	})

	test('returns nothing when no title matches', () => {
		expect(filterCatalogEntries(titled, { query: 'checkers' })).toEqual([])
	})

	test('filters by registry category and keeps registry order', () => {
		expect(filterCatalogEntries(titled, { category: 'logic' }).map((entry) => entry.slug)).toEqual([
			'crowns',
			'sudoku',
		])
		expect(filterCatalogEntries(titled, { category: 'word' }).map((entry) => entry.slug)).toEqual([
			'word-guess',
		])
	})

	test('combines the title and category filters', () => {
		expect(filterCatalogEntries(titled, { query: 'su', category: 'logic' })).toEqual([
			{ slug: 'sudoku', title: 'Sudoku', category: 'logic' },
		])
		expect(filterCatalogEntries(titled, { query: 'sudoku', category: 'word' })).toEqual([])
	})
})

describe('parseCatalogCategory', () => {
	test('accepts registry categories and collapses everything else to all', () => {
		expect(parseCatalogCategory('word')).toBe('word')
		expect(parseCatalogCategory('spatial')).toBe('spatial')
		expect(parseCatalogCategory(['logic', 'word'])).toBe('logic')
		expect(parseCatalogCategory(undefined)).toBe('all')
		expect(parseCatalogCategory('')).toBe('all')
		expect(parseCatalogCategory('puzzle')).toBe('all')
	})
})

describe('readMessage', () => {
	const reader = (messages: Record<string, string>) => {
		const read = (key: string) => {
			const message = messages[key]
			if (message === undefined) throw new Error(`missing ${key}`)
			return message
		}
		return Object.assign(read, { has: (key: string) => key in messages })
	}

	test('prefers the translated message', () => {
		expect(readMessage(reader({ 'games.sudoku.name': 'Sudoku' }), 'games.sudoku.name', 'X')).toBe(
			'Sudoku',
		)
	})

	test('falls back to registry copy without rendering the dotted key path', () => {
		expect(readMessage(reader({}), 'games.sudoku.name', 'Sudoku')).toBe('Sudoku')
	})
})

describe('relatedCatalogSlugs', () => {
	const modules = getAllGameMetadata()

	test('never relates a module to itself and respects the limit', () => {
		for (const moduleMetadata of modules) {
			const related = relatedCatalogSlugs({ slug: moduleMetadata.slug, modules })
			expect(related).toHaveLength(3)
			expect(related).not.toContain(moduleMetadata.slug)
			expect(new Set(related).size).toBe(related.length)
			for (const slug of related) {
				expect(getGameSlugs()).toContain(slug)
			}
		}
	})

	test('leads with the same category before falling back to registry order', () => {
		const related = relatedCatalogSlugs({ slug: 'sudoku', modules, limit: 3 })
		const categoryBySlug = new Map(modules.map((module) => [module.slug, module.category]))

		expect(related[0]).toBe('nonogram')
		expect(related.filter((slug) => categoryBySlug.get(slug) === 'logic')).toHaveLength(3)
	})

	test('honours an explicit limit and an unknown current module', () => {
		expect(relatedCatalogSlugs({ slug: 'sudoku', modules, limit: 1 })).toEqual(['nonogram'])
		expect(relatedCatalogSlugs({ slug: 'not-a-module', modules, limit: 2 })).toEqual([
			'word-guess',
			'word-groups',
		])
	})
})
