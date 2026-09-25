import { describe, expect, test } from 'bun:test'
import { summarizeDailyProgress } from './daily-progress'

describe('daily progress', () => {
	test('counts every module: all are playable', () => {
		expect(
			summarizeDailyProgress([{ completed: true }, { completed: false }, { completed: true }]),
		).toEqual({ completedCount: 2, availableCount: 3, allCompleted: false })
	})

	test('celebrates a fully completed set', () => {
		expect(summarizeDailyProgress([{ completed: true }, { completed: true }])).toEqual({
			completedCount: 2,
			availableCount: 2,
			allCompleted: true,
		})
	})

	test('does not celebrate an empty set', () => {
		expect(summarizeDailyProgress([])).toEqual({
			completedCount: 0,
			availableCount: 0,
			allCompleted: false,
		})
	})
})
