import { describe, expect, test } from 'bun:test'
import { formatCountdown, msUntilNextProductDay } from './day-boundary'

/**
 * The countdown must target the product-day boundary (midnight Asia/Hong_Kong,
 * 16:00 UTC), not UTC midnight: the daily set, the free rotation and the day key
 * all flip at 16:00 UTC, so a UTC-midnight clock is eight hours wrong.
 *
 * Every case pins `now`, so no expectation depends on the day the suite runs.
 */
describe('day boundary clock', () => {
	test('the boundary is midnight in Asia/Hong_Kong, not UTC', () => {
		// 15:59:59Z is 23:59:59 in Hong Kong: one second to the boundary.
		expect(msUntilNextProductDay(new Date('2026-09-20T15:59:59Z'))).toBe(1000)
		// One second later the product day has just turned over: a full day left.
		expect(msUntilNextProductDay(new Date('2026-09-20T16:00:00Z'))).toBe(86_400_000)
		// 00:00:00Z is 08:00 HKT, i.e. sixteen hours into the product day.
		expect(msUntilNextProductDay(new Date('2026-09-20T00:00:00Z'))).toBe(16 * 60 * 60 * 1000)
		// 23:59:59Z is 07:59:59 HKT: a UTC-midnight clock would claim one second
		// left, while the product day still has sixteen hours and one second.
		expect(msUntilNextProductDay(new Date('2026-09-20T23:59:59Z'))).toBe(16 * 60 * 60 * 1000 + 1000)
	})

	test('the label is zero-padded HH:MM:SS and never negative', () => {
		expect(formatCountdown(0)).toBe('00:00:00')
		expect(formatCountdown(1000)).toBe('00:00:01')
		expect(formatCountdown(61_000)).toBe('00:01:01')
		expect(formatCountdown(3_661_000)).toBe('01:01:01')
		expect(formatCountdown(86_399_000)).toBe('23:59:59')
		// A clock that reads a negative delta renders the boundary, not "-1".
		expect(formatCountdown(-5000)).toBe('00:00:00')
	})
})
