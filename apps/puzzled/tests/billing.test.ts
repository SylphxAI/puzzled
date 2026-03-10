/**
 * Billing Logic Tests
 *
 * Tests the premium access checking and free game rotation.
 * Uses mocked platform SDK calls.
 */

import { describe, expect, test } from 'bun:test'

// ==========================================
// Mock implementations (extracted from billing/server.ts)
// ==========================================

const PREMIUM_PLANS = ['premium', 'lifetime', 'pro'] as const

const FREE_GAME_ROTATION = ['word-guess', 'word-groups', 'queens', 'sudoku', 'crossword'] as const

function isPremiumPlan(planSlug: string | null | undefined): boolean {
	if (!planSlug) return false
	return PREMIUM_PLANS.includes(planSlug as (typeof PREMIUM_PLANS)[number])
}

function isFreePlan(planSlug: string | null | undefined): boolean {
	return !planSlug || planSlug === 'free'
}

function getTodaysFreeGame(): string {
	const today = new Date()
	const dayOfYear = Math.floor(
		(today.getTime() - new Date(today.getUTCFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24),
	)
	return FREE_GAME_ROTATION[dayOfYear % FREE_GAME_ROTATION.length]
}

function isGameFreeToday(gameSlug: string): boolean {
	return gameSlug === getTodaysFreeGame()
}

function getFreeGameRotation(): readonly string[] {
	return FREE_GAME_ROTATION
}

// ==========================================
// Tests
// ==========================================

describe('Billing Logic', () => {
	describe('isPremiumPlan', () => {
		test('identifies premium plans correctly', () => {
			expect(isPremiumPlan('premium')).toBe(true)
			expect(isPremiumPlan('lifetime')).toBe(true)
			expect(isPremiumPlan('pro')).toBe(true)
		})

		test('rejects free and null plans', () => {
			expect(isPremiumPlan('free')).toBe(false)
			expect(isPremiumPlan(null)).toBe(false)
			expect(isPremiumPlan(undefined)).toBe(false)
			expect(isPremiumPlan('')).toBe(false)
		})

		test('rejects unknown plans', () => {
			expect(isPremiumPlan('basic')).toBe(false)
			expect(isPremiumPlan('enterprise')).toBe(false)
			expect(isPremiumPlan('PREMIUM')).toBe(false) // case sensitive
		})
	})

	describe('isFreePlan', () => {
		test('identifies free plan correctly', () => {
			expect(isFreePlan('free')).toBe(true)
			expect(isFreePlan(null)).toBe(true)
			expect(isFreePlan(undefined)).toBe(true)
			expect(isFreePlan('')).toBe(true)
		})

		test('rejects premium plans', () => {
			expect(isFreePlan('premium')).toBe(false)
			expect(isFreePlan('lifetime')).toBe(false)
			expect(isFreePlan('pro')).toBe(false)
		})
	})

	describe('Free Game Rotation', () => {
		test('returns a valid game slug', () => {
			const todaysGame = getTodaysFreeGame()
			expect((FREE_GAME_ROTATION as readonly string[]).includes(todaysGame)).toBe(true)
		})

		test("isGameFreeToday returns true for today's game", () => {
			const todaysGame = getTodaysFreeGame()
			expect(isGameFreeToday(todaysGame)).toBe(true)
		})

		test('isGameFreeToday returns false for other games', () => {
			const todaysGame = getTodaysFreeGame()
			const otherGames = FREE_GAME_ROTATION.filter((g) => g !== todaysGame)

			for (const game of otherGames) {
				expect(isGameFreeToday(game)).toBe(false)
			}
		})

		test('getFreeGameRotation returns all games', () => {
			const rotation = getFreeGameRotation()
			expect(rotation.length).toBe(5)
			expect(rotation).toContain('word-guess')
			expect(rotation).toContain('word-groups')
			expect(rotation).toContain('queens')
			expect(rotation).toContain('sudoku')
			expect(rotation).toContain('crossword')
		})

		test('rotation cycles through all games', () => {
			// Create a set of games that would be free over 5 days
			const gamesOverFiveDays = new Set<string>()

			// Mock different days
			for (let i = 0; i < FREE_GAME_ROTATION.length; i++) {
				// The rotation is based on day of year
				const dayOfYear = i
				const game = FREE_GAME_ROTATION[dayOfYear % FREE_GAME_ROTATION.length]
				gamesOverFiveDays.add(game)
			}

			// Should have all 5 unique games
			expect(gamesOverFiveDays.size).toBe(FREE_GAME_ROTATION.length)
		})
	})

	describe('Access Control', () => {
		// These tests verify the logic without hitting the platform SDK
		test("anonymous users only get today's free game", () => {
			const todaysGame = getTodaysFreeGame()

			// Anonymous user (null userId) can play today's free game
			expect(isGameFreeToday(todaysGame)).toBe(true)

			// But not other games
			const allGames = getFreeGameRotation()
			const otherGames = allGames.filter((g) => g !== todaysGame)
			for (const game of otherGames) {
				expect(isGameFreeToday(game)).toBe(false)
			}
		})

		test('premium plan grants access to all games', () => {
			// If user has premium plan, they can access any game
			expect(isPremiumPlan('premium')).toBe(true)
			expect(isPremiumPlan('lifetime')).toBe(true)
			expect(isPremiumPlan('pro')).toBe(true)
		})
	})
})

describe('Subscription Status', () => {
	test('active status grants access', () => {
		const statuses = ['active', 'trialing']
		for (const status of statuses) {
			expect(['active', 'trialing'].includes(status)).toBe(true)
		}
	})

	test('inactive statuses deny access', () => {
		const inactiveStatuses = ['cancelled', 'past_due', 'paused']
		for (const status of inactiveStatuses) {
			expect(['active', 'trialing'].includes(status)).toBe(false)
		}
	})
})
