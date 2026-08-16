import { describe, expect, test } from 'bun:test'
import { prioritizeDailyGames, summarizeDailyProgress } from './daily-progress'

describe('daily hero priority', () => {
	test('features the free ritual exactly once and prioritizes the next playable module', () => {
		const games = [
			{ slug: 'completed', completed: true },
			{ slug: 'locked', completed: false, locked: true },
			{ slug: 'free', completed: false, isFreeToday: true },
			{ slug: 'next', completed: false },
		] as const

		const result = prioritizeDailyGames(games)

		expect(result.featuredGame?.slug).toBe('free')
		expect(result.otherGames.map((game) => game.slug)).toEqual(['next', 'completed', 'locked'])
		expect(result.otherGames.some((game) => game.slug === 'free')).toBe(false)
	})

	test('preserves the full catalog when no free-rotation entry is present', () => {
		const result = prioritizeDailyGames([
			{ slug: 'locked', completed: false, locked: true },
			{ slug: 'playable', completed: false },
		])

		expect(result.featuredGame).toBeUndefined()
		expect(result.otherGames.map((game) => game.slug)).toEqual(['playable', 'locked'])
	})
})

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
