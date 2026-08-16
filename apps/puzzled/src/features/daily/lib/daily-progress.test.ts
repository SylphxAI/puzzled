import { describe, expect, test } from 'bun:test'
import { summarizeDailyProgress } from './daily-progress'

describe('daily progress', () => {
	test('does not count locked premium modules against the free ritual', () => {
		expect(
			summarizeDailyProgress([
				{ completed: true },
				{ completed: false, locked: true },
				{ completed: false, locked: true },
			]),
		).toEqual({ completedCount: 1, availableCount: 1, allCompleted: true })
	})

	test('counts every playable module for premium suite depth', () => {
		expect(
			summarizeDailyProgress([
				{ completed: true },
				{ completed: false },
				{ completed: true },
				{ completed: false, locked: true },
			]),
		).toEqual({ completedCount: 2, availableCount: 3, allCompleted: false })
	})

	test('does not celebrate an empty playable set', () => {
		expect(summarizeDailyProgress([{ completed: false, locked: true }])).toEqual({
			completedCount: 0,
			availableCount: 0,
			allCompleted: false,
		})
	})
})
