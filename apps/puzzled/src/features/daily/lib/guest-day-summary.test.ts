import { describe, expect, test } from 'bun:test'
import {
	normalizeGuestGameStore,
	shiftGuestDayKey,
	summarizeGuestCompletions,
} from './guest-day-summary'

const completion = (date: string, gameSlug: string, completedAt = `${date}T04:00:00.000Z`) => ({
	gameSlug,
	date,
	status: 'won' as const,
	attempts: 1,
	score: 87,
	completedAt,
})

describe('guest day summary', () => {
	test('uses the product day boundary rather than UTC', () => {
		const store = normalizeGuestGameStore({
			version: 1,
			games: [completion('2026-08-12', 'tango', '2026-08-12T16:30:00.000Z')],
		})

		expect(store.version).toBe(2)
		expect(store.games[0]?.date).toBe('2026-08-13')
		expect(store.games[0]?.gameSlug).toBe('duo')
		expect(store.games[0]?.score).toBe(87)
	})

	test('derives modules and a consecutive guest streak', () => {
		const games = [
			completion('2026-08-11', 'sudoku'),
			completion('2026-08-12', 'queens'),
			completion('2026-08-13', 'word-guess'),
			completion('2026-08-13', 'sudoku'),
		]
		const summary = summarizeGuestCompletions(games, '2026-08-13')

		expect(summary.completedSlugs).toEqual(['sudoku', 'word-guess'])
		expect(summary.completedCount).toBe(2)
		expect(summary.currentStreak).toBe(3)
		expect(summary.hasPlayedToday).toBe(true)
		expect(summary.totalGamesPlayed).toBe(4)
	})

	test('keeps the prior run visible until today is played', () => {
		const summary = summarizeGuestCompletions(
			[completion('2026-08-11', 'sudoku'), completion('2026-08-12', 'sudoku')],
			'2026-08-13',
		)

		expect(summary.currentStreak).toBe(2)
		expect(summary.hasPlayedToday).toBe(false)
	})

	test('shifts civil product days without timezone drift', () => {
		expect(shiftGuestDayKey('2026-01-01', -1)).toBe('2025-12-31')
		expect(shiftGuestDayKey('2026-12-31', 1)).toBe('2027-01-01')
	})
})
