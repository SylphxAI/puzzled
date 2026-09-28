import { describe, expect, test } from 'bun:test'
import {
	freeGameForDayKey,
	getTodaysFreeGame,
	getTomorrowsFreeGame,
	isGameFreeOnDay,
} from './free-rotation'

describe('freeGameForDayKey', () => {
	test('matches api game_slugs ordinal0 rotation', () => {
		// 2026-08-13 ordinal0=224, 224%5=4 → crossword (live flagship).
		expect(freeGameForDayKey('2026-08-13')).toBe('crossword')
		expect(isGameFreeOnDay('crossword', '2026-08-13')).toBe(true)
		expect(isGameFreeOnDay('word-guess', '2026-08-13')).toBe(false)
		// Previous product day (UTC evening of 12th is still HKT 13th after 16:00Z).
		expect(freeGameForDayKey('2026-08-12')).toBe('sudoku')
		expect(getTodaysFreeGame(new Date('2026-08-12T20:07:00Z'))).toBe('crossword')
		// UTC midnight 13th is still HKT 13th — must not flip to word-guess.
		expect(getTodaysFreeGame(new Date('2026-08-13T00:30:00Z'))).toBe('crossword')
	})
})

describe('getTomorrowsFreeGame (the teaser data source)', () => {
	test('is the rotation read for the next product day, never a separate list', () => {
		const now = new Date('2026-08-12T20:07:00Z') // HKT 13 Aug 04:07
		expect(getTodaysFreeGame(now)).toBe('crossword')
		expect(getTomorrowsFreeGame(now)).toBe(freeGameForDayKey('2026-08-14'))
	})

	test('flips at the product-day boundary (16:00Z), not at UTC midnight', () => {
		// 15:59Z on the 12th is still HKT 12 Aug; tomorrow is the 13th.
		expect(getTomorrowsFreeGame(new Date('2026-08-12T15:59:00Z'))).toBe(
			freeGameForDayKey('2026-08-13'),
		)
		expect(getTomorrowsFreeGame(new Date('2026-08-12T16:00:00Z'))).toBe(
			freeGameForDayKey('2026-08-14'),
		)
	})

	test('follows the rotation across a year boundary, where day-of-year restarts', () => {
		const now = new Date('2026-12-31T04:00:00Z') // HKT 31 Dec
		expect(getTomorrowsFreeGame(now)).toBe(freeGameForDayKey('2027-01-01'))
	})
})
