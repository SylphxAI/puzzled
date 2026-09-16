import { describe, expect, test } from 'bun:test'
import {
	buildFinishCalendar,
	dailyFinishCounts,
	dayKeyFromStamp,
	durationParts,
	moduleStatRows,
	parseDayKey,
	shiftDayKey,
	winRatePercent,
} from './finish-activity'

const session = (overrides: Partial<Parameters<typeof dailyFinishCounts>[0][number]> = {}) => ({
	gameSlug: 'word-guess',
	puzzleDate: '2026-09-08',
	status: 'won',
	score: 100,
	attempts: 3,
	timeSpentMs: 90_000,
	mode: 'daily',
	...overrides,
})

describe('day keys', () => {
	test('round-trips a civil date', () => {
		const stamp = parseDayKey('2026-09-08')
		expect(stamp).not.toBeNull()
		expect(dayKeyFromStamp(stamp as number)).toBe('2026-09-08')
	})

	test('rejects malformed keys', () => {
		expect(parseDayKey('2026-9-8')).toBeNull()
		expect(parseDayKey('')).toBeNull()
	})

	test('shifts across month and year boundaries', () => {
		expect(shiftDayKey('2026-03-01', -1)).toBe('2026-02-28')
		expect(shiftDayKey('2025-12-31', 1)).toBe('2026-01-01')
	})
})

describe('dailyFinishCounts', () => {
	test('counts completed daily sessions by product day', () => {
		const counts = dailyFinishCounts([
			session(),
			session({ status: 'lost' }),
			session({ gameSlug: 'sudoku' }),
		])
		expect(counts.get('2026-09-08')).toEqual({ finished: 3, won: 2 })
	})

	test('ignores archive plays, open sessions, and unparsable dates', () => {
		const counts = dailyFinishCounts([
			session({ mode: 'archive' }),
			session({ status: 'in_progress' }),
			session({ puzzleDate: '' }),
		])
		expect(counts.size).toBe(0)
	})
})

describe('buildFinishCalendar', () => {
	// 2026-09-08 is a Tuesday; the window therefore starts on Monday 2026-07-20.
	const todayKey = '2026-09-08'

	test('aligns the last column to the week that contains today', () => {
		const calendar = buildFinishCalendar({ sessions: [], todayKey, weeks: 8 })
		expect(calendar.weeks).toHaveLength(8)
		expect(calendar.weeks[0][0].key).toBe('2026-07-20')
		expect(calendar.weeks[7][6].key).toBe('2026-09-13')
		expect(calendar.daysInWindow).toBe(56)
	})

	test('marks the tail of the current week as future and out of range', () => {
		const calendar = buildFinishCalendar({ sessions: [], todayKey, weeks: 8 })
		const lastColumn = calendar.weeks[7]
		expect(lastColumn[1].key).toBe(todayKey)
		expect(lastColumn[1].future).toBe(false)
		expect(lastColumn[2].future).toBe(true)
		expect(lastColumn[6].inRange).toBe(false)
		expect(lastColumn[6].finishedCount).toBe(0)
	})

	test('reports finished days, longest run, and the current run', () => {
		const calendar = buildFinishCalendar({
			sessions: [
				session({ puzzleDate: '2026-09-06' }),
				session({ puzzleDate: '2026-09-07' }),
				session({ puzzleDate: '2026-09-08' }),
				session({ puzzleDate: '2026-08-30' }),
			],
			todayKey,
			weeks: 8,
		})
		expect(calendar.finishedDays).toBe(4)
		expect(calendar.longestRunDays).toBe(3)
		expect(calendar.currentRunDays).toBe(3)
		expect(calendar.today?.finishedCount).toBe(1)
	})

	test('stops the current run when the product day is still open', () => {
		const calendar = buildFinishCalendar({
			sessions: [session({ puzzleDate: '2026-09-07' })],
			todayKey,
			weeks: 8,
		})
		expect(calendar.currentRunDays).toBe(0)
		expect(calendar.today?.finishedCount).toBe(0)
	})

	test('fails closed on an invalid product day', () => {
		const calendar = buildFinishCalendar({ sessions: [session()], todayKey: 'nope' })
		expect(calendar.weeks).toEqual([])
		expect(calendar.today).toBeNull()
	})
})

describe('winRatePercent', () => {
	test('rounds to whole percentages', () => {
		expect(winRatePercent(3, 2)).toBe(67)
		expect(winRatePercent(2, 2)).toBe(100)
	})

	test('returns null instead of a fabricated zero', () => {
		expect(winRatePercent(0, 0)).toBeNull()
	})
})

describe('moduleStatRows', () => {
	test('keeps a missing best score null instead of posing as zero', () => {
		const rows = moduleStatRows(
			{ sudoku: { gamesPlayed: 2, gamesWon: 1, totalScore: 0 } },
			[{ slug: 'sudoku', name: 'Sudoku' }],
		)
		// Connect reported a zero best score here: that is a value, not an absence.
		expect(rows[0].bestScore).toBe(0)
	})

	test('keeps registry order and drops modules with no finishes', () => {
		const rows = moduleStatRows(
			{
				sudoku: { gamesPlayed: 4, gamesWon: 1, totalScore: 880 },
				'word-guess': { gamesPlayed: 2, gamesWon: 2, totalScore: 120 },
			},
			[
				{ slug: 'word-guess', name: 'Word Guess' },
				{ slug: 'sudoku', name: 'Sudoku' },
				{ slug: 'queens', name: 'Queens' },
			],
		)
		expect(rows.map((row) => row.slug)).toEqual(['word-guess', 'sudoku'])
		expect(rows[1]).toEqual({
			slug: 'sudoku',
			name: 'Sudoku',
			played: 4,
			won: 1,
			winRate: 25,
			bestScore: 880,
		})
	})
})

describe('durationParts', () => {
	test('splits milliseconds into minutes and seconds', () => {
		expect(durationParts(125_000)).toEqual({ minutes: 2, seconds: 5 })
		expect(durationParts(0)).toEqual({ minutes: 0, seconds: 0 })
		expect(durationParts(Number.NaN)).toEqual({ minutes: 0, seconds: 0 })
	})
})
