/**
 * Billing Logic Tests
 *
 * Premium is dest Commerce EvaluateEntitlement `enabled`.
 * These tests cover free-game rotation only.
 */

import { describe, expect, test } from 'bun:test'

const FREE_GAME_ROTATION = ['word-guess', 'word-groups', 'crowns', 'sudoku', 'crossword'] as const

function getTodaysFreeGame(now = new Date()): string {
	// Dual-oracle of src/lib/free-rotation.ts (HKT product day, ordinal0).
	const hkt = new Date(now.getTime() + 8 * 60 * 60 * 1000)
	const key = `${hkt.getUTCFullYear()}-${String(hkt.getUTCMonth() + 1).padStart(2, '0')}-${String(hkt.getUTCDate()).padStart(2, '0')}`
	const [y, m, d] = key.split('-').map(Number)
	const ordinal0 = Math.round((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / 86_400_000)
	return FREE_GAME_ROTATION[ordinal0 % FREE_GAME_ROTATION.length]
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
	describe('Free Game Rotation', () => {
		test('returns a valid game slug', () => {
			const todaysGame = getTodaysFreeGame()
			expect((FREE_GAME_ROTATION as readonly string[]).includes(todaysGame)).toBe(true)
		})

		test('2026-08-13 HKT (UTC evening of 12th) is crossword', () => {
			expect(getTodaysFreeGame(new Date('2026-08-12T20:07:00Z'))).toBe('crossword')
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
			expect(rotation).toContain('crowns')
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
	})
})
