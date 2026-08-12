import { describe, expect, test } from 'bun:test'
import { freeGameForDayKey, getTodaysFreeGame, isGameFreeOnDay } from './free-rotation'

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
