import { describe, expect, test } from 'bun:test'
import { streakWarningHref } from './streak-warning'

describe('streakWarningHref', () => {
	test("routes the return CTA directly to today's free ritual", () => {
		expect(streakWarningHref('sudoku')).toBe('/games/sudoku')
	})

	test('keeps the catalog as the fallback when no ritual is known', () => {
		expect(streakWarningHref()).toBe('/games')
	})
})
