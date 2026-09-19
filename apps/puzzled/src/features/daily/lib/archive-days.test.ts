/**
 * Archive index day list (G2).
 *
 * The list is derived on the server from the product-day calendar — never from
 * a client's play history — and every row names the module that ran that day
 * on the same rotation the daily ritual uses.
 */
import { describe, expect, test } from 'bun:test'
import { FREE_GAME_ROTATION } from '@/lib/free-rotation'
import { ARCHIVE_WINDOW_DAYS, archiveDayKeys, archiveDays, archivePlayPath } from './archive-days'

describe('archiveDayKeys', () => {
	test('lists the days before today, newest first, and excludes today', () => {
		expect(archiveDayKeys('2026-09-19', 3)).toEqual(['2026-09-18', '2026-09-17', '2026-09-16'])
	})

	test('defaults to the archive window', () => {
		expect(archiveDayKeys('2026-09-19')).toHaveLength(ARCHIVE_WINDOW_DAYS)
		expect(archiveDayKeys('2026-09-19')).not.toContain('2026-09-19')
	})

	test('crosses a month and a year boundary', () => {
		expect(archiveDayKeys('2026-03-01', 2)).toEqual(['2026-02-28', '2026-02-27'])
		expect(archiveDayKeys('2026-01-02', 3)).toEqual(['2026-01-01', '2025-12-31', '2025-12-30'])
	})

	test('handles a leap day', () => {
		expect(archiveDayKeys('2028-03-01', 2)).toEqual(['2028-02-29', '2028-02-28'])
	})

	test('an empty or negative window lists nothing', () => {
		expect(archiveDayKeys('2026-09-19', 0)).toEqual([])
		expect(archiveDayKeys('2026-09-19', -5)).toEqual([])
	})

	test('rejects a malformed day key', () => {
		expect(() => archiveDayKeys('19-09-2026', 1)).toThrow('invalid_day_key')
	})
})

describe('archiveDays', () => {
	test('names the module that ran on each day', () => {
		const days = archiveDays('2026-09-19', FREE_GAME_ROTATION.length)
		expect(days.map((day) => day.dayKey)).toEqual(
			archiveDayKeys('2026-09-19', FREE_GAME_ROTATION.length),
		)
		for (const day of days) {
			expect(FREE_GAME_ROTATION as readonly string[]).toContain(day.gameSlug)
		}
	})

	test('one rotation length of days covers every module exactly once', () => {
		const days = archiveDays('2026-09-19', FREE_GAME_ROTATION.length)
		expect(new Set(days.map((day) => day.gameSlug)).size).toBe(FREE_GAME_ROTATION.length)
	})
})

describe('archivePlayPath', () => {
	test('is the dated archive route in the existing module shape', () => {
		expect(archivePlayPath('sudoku', '2026-09-10')).toBe(
			'/games/sudoku?mode=archive&date=2026-09-10',
		)
	})
})
