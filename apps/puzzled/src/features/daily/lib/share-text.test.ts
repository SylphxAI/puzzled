import { describe, expect, test } from 'bun:test'
import {
	formatRitualShareText,
	ritualShareDeepLink,
	ritualSharePath,
	shareHost,
	shareTextLooksNonSpoiler,
} from './share-text'

describe('shareHost', () => {
	test('strips scheme and trailing slash', () => {
		expect(shareHost('https://puzzled.gg/')).toBe('puzzled.gg')
		expect(shareHost('http://localhost:3000')).toBe('localhost:3000')
	})
})

describe('ritualSharePath', () => {
	test('module path only', () => {
		expect(ritualSharePath('sudoku')).toBe('/games/sudoku')
	})

	test('includes day_key when valid', () => {
		expect(ritualSharePath('sudoku', '2026-08-12')).toBe('/games/sudoku?date=2026-08-12')
	})

	test('ignores invalid date', () => {
		expect(ritualSharePath('sudoku', 'not-a-date')).toBe('/games/sudoku')
	})
})

describe('ritualShareDeepLink', () => {
	test('host + module + day', () => {
		expect(ritualShareDeepLink('https://puzzled.gg', 'sudoku', '2026-08-12')).toBe(
			'puzzled.gg/games/sudoku?date=2026-08-12',
		)
	})
})

describe('formatRitualShareText', () => {
	test('won path is non-spoiler and deep-links module day', () => {
		const text = formatRitualShareText({
			origin: 'https://puzzled.gg',
			gameSlug: 'sudoku',
			gameName: 'Sudoku',
			puzzleDate: '2026-08-12',
			status: 'won',
			attempts: 1,
			difficultyLabel: 'Medium',
		})
		expect(text).toContain('🏆 Sudoku (Medium) • 2026-08-12')
		expect(text).toContain('✅ 1 attempts')
		expect(text).toContain('puzzled.gg/games/sudoku?date=2026-08-12')
		expect(shareTextLooksNonSpoiler(text)).toBe(true)
		expect(text.toLowerCase()).not.toContain('solution')
	})

	test('lost path no solution leak', () => {
		const text = formatRitualShareText({
			origin: 'https://puzzled.gg',
			gameSlug: 'sudoku',
			gameName: 'Sudoku',
			puzzleDate: '2026-08-12',
			status: 'lost',
		})
		expect(text).toContain('❌ Failed')
		expect(shareTextLooksNonSpoiler(text)).toBe(true)
	})

	test('statLine override for time-based games', () => {
		const text = formatRitualShareText({
			origin: 'https://puzzled.gg',
			gameSlug: 'sudoku',
			gameName: 'Sudoku',
			puzzleDate: '2026-08-12',
			status: 'won',
			statLine: '⏱️ 1:23',
			difficultyLabel: 'medium',
		})
		expect(text).toContain('⏱️ 1:23')
		expect(text).toContain('puzzled.gg/games/sudoku?date=2026-08-12')
	})
})
