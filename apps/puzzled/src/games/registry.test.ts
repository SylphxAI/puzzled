import { describe, expect, test } from 'bun:test'
import {
	getAllGameMetadata,
	getAllGames,
	getGameConfig,
	getGameMetadata,
	getGameSlugs,
	getSeedFromDate,
	isValidGameSlug,
} from './registry'
import { formatGenerationSummary, shouldAlert } from './registry.server'
import type { GenerationSummary } from './types'

describe('getSeedFromDate', () => {
	test('generates consistent seed from date', () => {
		const date = new Date('2024-12-25T00:00:00Z')
		expect(getSeedFromDate(date)).toBe(20241225)
	})

	test('uses UTC date regardless of timezone', () => {
		// December 31st at 11pm PST is January 1st UTC
		const date = new Date('2024-12-31T23:00:00-08:00')
		// Should be January 1st in UTC
		expect(getSeedFromDate(date)).toBe(20250101)
	})

	test('handles single-digit months and days', () => {
		const date = new Date('2024-01-05T12:00:00Z')
		expect(getSeedFromDate(date)).toBe(20240105)
	})
})

describe('getGameSlugs', () => {
	test('returns array of game slugs', () => {
		const slugs = getGameSlugs()
		expect(Array.isArray(slugs)).toBe(true)
		expect(slugs.length).toBeGreaterThan(0)
	})

	test('contains expected games', () => {
		const slugs = getGameSlugs()
		expect(slugs).toContain('word-guess')
		expect(slugs).toContain('word-groups')
	})
})

describe('isValidGameSlug', () => {
	test('returns true for valid game slug', () => {
		expect(isValidGameSlug('word-guess')).toBe(true)
		expect(isValidGameSlug('word-groups')).toBe(true)
	})

	test('returns false for invalid game slug', () => {
		expect(isValidGameSlug('invalid-game')).toBe(false)
		expect(isValidGameSlug('')).toBe(false)
		expect(isValidGameSlug('WORD-GUESS')).toBe(false) // case-sensitive
	})
})

describe('getGameConfig', () => {
	test('returns config for valid slug', () => {
		const config = getGameConfig('word-guess')
		expect(config).toBeDefined()
		expect(config?.slug).toBe('word-guess')
		expect(config?.name).toBe('Word Guess')
	})

	test('returns undefined for invalid slug', () => {
		expect(getGameConfig('invalid')).toBeUndefined()
	})
})

describe('getAllGames', () => {
	test('returns all games sorted by sortOrder', () => {
		const games = getAllGames()
		expect(games.length).toBeGreaterThan(0)

		// Check sorting
		for (let i = 1; i < games.length; i++) {
			expect(games[i].sortOrder).toBeGreaterThanOrEqual(games[i - 1].sortOrder)
		}
	})

	test('each game has required properties', () => {
		const games = getAllGames()
		for (const game of games) {
			expect(game.slug).toBeDefined()
			expect(game.name).toBeDefined()
			expect(game.description).toBeDefined()
			expect(game.IconComponent).toBeDefined()
			expect(typeof game.generatePuzzle).toBe('function')
			expect(typeof game.validateAndScore).toBe('function')
		}
	})
})

describe('getGameMetadata', () => {
	test('returns metadata for valid slug', () => {
		const metadata = getGameMetadata('word-guess')
		expect(metadata).toEqual({
			slug: 'word-guess',
			name: 'Word Guess',
			description: expect.any(String),
			sortOrder: expect.any(Number),
			category: expect.any(String),
			skills: expect.any(Array),
			difficulty: expect.any(String),
			display: {
				taglineKey: expect.any(String),
				highlightKey: expect.any(String),
				duration: expect.any(String),
				theme: expect.any(String),
			},
			supportsDifficulty: expect.any(Boolean),
			difficultyLevels: undefined, // word-guess doesn't support difficulty
		})
	})

	test('returns null for invalid slug', () => {
		expect(getGameMetadata('invalid')).toBeNull()
	})
})

describe('getAllGameMetadata', () => {
	test('returns metadata for all games', () => {
		const allMetadata = getAllGameMetadata()
		const slugs = getGameSlugs()

		expect(allMetadata.length).toBe(slugs.length)

		for (const metadata of allMetadata) {
			expect(metadata.slug).toBeDefined()
			expect(metadata.name).toBeDefined()
			expect(metadata.description).toBeDefined()
			expect(metadata.sortOrder).toBeDefined()
			expect(metadata.display).toBeDefined()
			expect(metadata.display.taglineKey).toBeDefined()
			expect(metadata.display.theme).toBeDefined()
		}
	})

	test('games are sorted by sortOrder', () => {
		const allMetadata = getAllGameMetadata()
		for (let i = 1; i < allMetadata.length; i++) {
			expect(allMetadata[i].sortOrder).toBeGreaterThanOrEqual(allMetadata[i - 1].sortOrder)
		}
	})
})

describe('shouldAlert', () => {
	test('returns true when there are failures', () => {
		const summary: GenerationSummary = {
			date: '2024-12-25',
			totalGames: 3,
			successful: 2,
			failed: 1,
			results: [],
		}
		expect(shouldAlert(summary)).toBe(true)
	})

	test('returns false when all successful', () => {
		const summary: GenerationSummary = {
			date: '2024-12-25',
			totalGames: 3,
			successful: 3,
			failed: 0,
			results: [],
		}
		expect(shouldAlert(summary)).toBe(false)
	})
})

describe('formatGenerationSummary', () => {
	test('formats summary with all sections', () => {
		const summary: GenerationSummary = {
			date: '2024-12-25',
			totalGames: 2,
			successful: 1,
			failed: 1,
			results: [
				{
					success: true,
					gameSlug: 'word-guess',
					gameName: 'Word Guess',
					strategy: 'seed',
				},
				{
					success: false,
					gameSlug: 'word-groups',
					gameName: 'Word Groups',
					strategy: 'llm',
					error: 'API timeout',
				},
			],
		}

		const formatted = formatGenerationSummary(summary)

		expect(formatted).toContain('2024-12-25')
		expect(formatted).toContain('Total: 2')
		expect(formatted).toContain('Success: 1')
		expect(formatted).toContain('Failed: 1')
		expect(formatted).toContain('Word Guess')
		expect(formatted).toContain('Word Groups')
		expect(formatted).toContain('API timeout')
	})

	test('uses appropriate icons for status', () => {
		const summary: GenerationSummary = {
			date: '2024-12-25',
			totalGames: 2,
			successful: 2,
			failed: 0,
			results: [
				{
					success: true,
					gameSlug: 'word-guess',
					gameName: 'Word Guess',
					strategy: 'seed',
				},
				{
					success: true,
					gameSlug: 'word-groups',
					gameName: 'Word Groups',
					strategy: 'llm',
				},
			],
		}

		const formatted = formatGenerationSummary(summary)

		expect(formatted).toContain('✅ Word Guess')
		expect(formatted).toContain('✅ Word Groups')
	})
})
