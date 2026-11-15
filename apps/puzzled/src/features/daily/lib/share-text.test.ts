import { describe, expect, test } from 'bun:test'
import {
	formatRitualShareText,
	ritualShareDeepLink,
	ritualSharePath,
	shareLandingPath,
	shareOrigin,
	shareTextLooksNonSpoiler,
} from './share-text'

describe('shareOrigin', () => {
	test('preserves scheme and strips trailing slash', () => {
		expect(shareOrigin('https://puzzled.gg/')).toBe('https://puzzled.gg')
		expect(shareOrigin('HTTPS://puzzled.gg///')).toBe('https://puzzled.gg')
		expect(shareOrigin('http://localhost:3000/')).toBe('http://localhost:3000')
		expect(shareOrigin('puzzled.gg/')).toBe('https://puzzled.gg')
		expect(shareOrigin('  ')).toBe('https://puzzled.gg')
	})
})

describe('ritualSharePath', () => {
	test('module path carries utm_source=share', () => {
		expect(ritualSharePath('sudoku')).toBe('/games/sudoku?utm_source=share')
	})

	test('carries the archive mode with the day_key and utm_source=share', () => {
		// The landing only resolves the shared day from an archive-mode request, so
		// the share path must carry both halves of the contract (G1).
		expect(ritualSharePath('sudoku', '2026-08-12')).toBe(
			'/games/sudoku?mode=archive&date=2026-08-12&utm_source=share',
		)
	})

	test('canonicalizes retired slugs', () => {
		expect(ritualSharePath('queens', '2026-08-13')).toBe(
			'/games/crowns?mode=archive&date=2026-08-13&utm_source=share',
		)
		expect(ritualSharePath('tango')).toBe('/games/duo?utm_source=share')
	})

	test('ignores an invalid or impossible day', () => {
		expect(ritualSharePath('sudoku', 'not-a-date')).toBe('/games/sudoku?utm_source=share')
		expect(ritualSharePath('sudoku', '2026-02-30')).toBe('/games/sudoku?utm_source=share')
	})
})

describe('ritualShareDeepLink', () => {
	test('preserves https:// origin + module + day + utm_source=share', () => {
		expect(ritualShareDeepLink('https://puzzled.gg', 'sudoku', '2026-08-12')).toBe(
			'https://puzzled.gg/games/sudoku?mode=archive&date=2026-08-12&utm_source=share',
		)
	})
})

describe('formatRitualShareText', () => {
	test('does not invent a puzzle number when the result day is unknown or invalid', () => {
		for (const puzzleDate of [undefined, '', 'not-a-date', '2026-02-30']) {
			const text = formatRitualShareText({
				origin: 'https://puzzled.gg',
				gameSlug: 'sudoku',
				gameName: 'Sudoku',
				puzzleDate,
				status: 'won',
			})
			expect(text.split('\n')[0]).toBe('🏆 Sudoku')
			expect(text).toContain('https://puzzled.gg/games/sudoku?utm_source=share')
		}
	})

	test('won path is non-spoiler and deep-links the shared day', () => {
		const text = formatRitualShareText({
			origin: 'https://puzzled.gg',
			gameSlug: 'sudoku',
			gameName: 'Sudoku',
			puzzleDate: '2026-08-12',
			status: 'won',
			attempts: 1,
			difficultyLabel: 'Medium',
		})
		expect(text).toContain('🏆 Sudoku (Medium) • #955')
		expect(text).toContain('✅ 1 attempts')
		expect(text).toContain(
			'https://puzzled.gg/games/sudoku?mode=archive&date=2026-08-12&utm_source=share',
		)
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

	test('crossword flagship includes module path and day_key', () => {
		const text = formatRitualShareText({
			origin: 'https://puzzled.gg',
			gameSlug: 'crossword',
			gameName: 'Crossword Mini',
			puzzleDate: '2026-08-13',
			status: 'won',
			statLine: '⏱️ 1:23',
		})
		expect(text).toContain('🏆 Crossword Mini • #956')
		expect(text).toContain(
			'https://puzzled.gg/games/crossword?mode=archive&date=2026-08-13&utm_source=share',
		)
		expect(text).not.toContain('Play at puzzled.gg')
		expect(shareTextLooksNonSpoiler(text)).toBe(true)
		expect(text.toLowerCase()).not.toMatch(/steam|answer|solution/)
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
		expect(text).toContain(
			'https://puzzled.gg/games/sudoku?mode=archive&date=2026-08-12&utm_source=share',
		)
	})
})

describe('share landing link (ref = server-issued share id)', () => {
	const SHARE_ID = '0b6f5d6e-2c8a-4a53-9f0e-6a4d3f1c9e11'

	test('a share id makes the link the landing carrying it as ref', () => {
		expect(shareLandingPath(SHARE_ID)).toBe(`/r/${SHARE_ID}?utm_source=share`)
		expect(ritualShareDeepLink('https://puzzled.gg', 'sudoku', '2026-08-12', SHARE_ID)).toBe(
			`https://puzzled.gg/r/${SHARE_ID}?utm_source=share`,
		)
	})

	test('without a share id the module link is kept', () => {
		expect(ritualShareDeepLink('https://puzzled.gg', 'sudoku', '2026-08-12', '  ')).toBe(
			'https://puzzled.gg/games/sudoku?mode=archive&date=2026-08-12&utm_source=share',
		)
	})

	test('the shared text carries the https permalink with utm_source=share and nothing that spoils', () => {
		const text = formatRitualShareText({
			origin: 'https://puzzled.gg',
			gameSlug: 'word-guess',
			gameName: 'Word Guess',
			puzzleDate: '2026-09-28',
			status: 'won',
			attempts: 3,
			shareId: SHARE_ID,
		})
		expect(text).toContain('🏆 Word Guess • #1002')
		expect(text).toContain(`https://puzzled.gg/r/${SHARE_ID}?utm_source=share`)
		expect(text).toContain('3 attempts')
		expect(shareTextLooksNonSpoiler(text)).toBe(true)
	})
})
