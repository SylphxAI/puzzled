/**
 * Format Utilities Tests
 *
 * Tests for shared formatting functions used across games.
 */

import { describe, expect, test } from 'bun:test'
import {
	formatTimer,
	isPerfectGame,
	formatTimeScore,
	compareByTime,
	calculateWordleScore,
} from './format'
import type { GameCompletionStats, GameShareStats } from '../types'

// ============================================================================
// formatTimer Tests
// ============================================================================

describe('formatTimer', () => {
	describe('seconds only', () => {
		test('formats 0 seconds', () => {
			expect(formatTimer(0)).toBe('0:00')
		})

		test('formats single digit seconds', () => {
			expect(formatTimer(5000)).toBe('0:05')
		})

		test('formats double digit seconds', () => {
			expect(formatTimer(45000)).toBe('0:45')
		})

		test('formats 59 seconds', () => {
			expect(formatTimer(59000)).toBe('0:59')
		})
	})

	describe('minutes and seconds', () => {
		test('formats 1 minute exactly', () => {
			expect(formatTimer(60000)).toBe('1:00')
		})

		test('formats 1 minute 30 seconds', () => {
			expect(formatTimer(90000)).toBe('1:30')
		})

		test('formats 5 minutes', () => {
			expect(formatTimer(300000)).toBe('5:00')
		})

		test('formats 10 minutes 15 seconds', () => {
			expect(formatTimer(615000)).toBe('10:15')
		})

		test('formats 59 minutes 59 seconds', () => {
			expect(formatTimer(3599000)).toBe('59:59')
		})
	})

	describe('hours, minutes, and seconds', () => {
		test('formats 1 hour exactly', () => {
			expect(formatTimer(3600000)).toBe('1:00:00')
		})

		test('formats 1 hour 15 minutes', () => {
			expect(formatTimer(4500000)).toBe('1:15:00')
		})

		test('formats 1 hour 30 minutes 45 seconds', () => {
			expect(formatTimer(5445000)).toBe('1:30:45')
		})

		test('formats 2 hours 5 minutes 3 seconds', () => {
			expect(formatTimer(7503000)).toBe('2:05:03')
		})
	})

	describe('edge cases', () => {
		test('handles fractional milliseconds (floors)', () => {
			expect(formatTimer(1500)).toBe('0:01')
		})

		test('handles 999 milliseconds (floors to 0)', () => {
			expect(formatTimer(999)).toBe('0:00')
		})
	})
})

// ============================================================================
// isPerfectGame Tests
// ============================================================================

describe('isPerfectGame', () => {
	test('returns true for won game with 0 mistakes', () => {
		const stats: GameCompletionStats = {
			status: 'won',
			mistakes: 0,
		}
		expect(isPerfectGame(stats)).toBe(true)
	})

	test('returns true for won game with undefined mistakes', () => {
		const stats: GameCompletionStats = {
			status: 'won',
		}
		expect(isPerfectGame(stats)).toBe(true)
	})

	test('returns false for won game with mistakes', () => {
		const stats: GameCompletionStats = {
			status: 'won',
			mistakes: 1,
		}
		expect(isPerfectGame(stats)).toBe(false)
	})

	test('returns false for lost game with 0 mistakes', () => {
		const stats: GameCompletionStats = {
			status: 'lost',
			mistakes: 0,
		}
		expect(isPerfectGame(stats)).toBe(false)
	})

	test('returns false for lost game with mistakes', () => {
		const stats: GameCompletionStats = {
			status: 'lost',
			mistakes: 5,
		}
		expect(isPerfectGame(stats)).toBe(false)
	})
})

// ============================================================================
// formatTimeScore Tests
// ============================================================================

describe('formatTimeScore', () => {
	test('returns "Lost" for lost game', () => {
		const stats: GameShareStats = {
			status: 'lost',
		}
		expect(formatTimeScore(stats)).toBe('Lost')
	})

	test('returns formatted time for won game with time', () => {
		const stats: GameShareStats = {
			status: 'won',
			timeSpentMs: 90000, // 1:30
		}
		expect(formatTimeScore(stats)).toBe('1:30')
	})

	test('returns score points for won game without time but with score', () => {
		const stats: GameShareStats = {
			status: 'won',
			score: 85,
		}
		expect(formatTimeScore(stats)).toBe('85 pts')
	})

	test('returns "Won" for won game without time or score', () => {
		const stats: GameShareStats = {
			status: 'won',
		}
		expect(formatTimeScore(stats)).toBe('Won')
	})

	test('prioritizes time over score', () => {
		const stats: GameShareStats = {
			status: 'won',
			timeSpentMs: 60000,
			score: 100,
		}
		expect(formatTimeScore(stats)).toBe('1:00')
	})
})

// ============================================================================
// compareByTime Tests
// ============================================================================

describe('compareByTime', () => {
	describe('status comparison', () => {
		test('winner ranks higher than loser', () => {
			const winner: GameCompletionStats = { status: 'won', timeSpentMs: 100000 }
			const loser: GameCompletionStats = { status: 'lost', timeSpentMs: 50000 }

			expect(compareByTime(winner, loser)).toBeGreaterThan(0)
		})

		test('loser ranks lower than winner', () => {
			const winner: GameCompletionStats = { status: 'won', timeSpentMs: 100000 }
			const loser: GameCompletionStats = { status: 'lost', timeSpentMs: 50000 }

			expect(compareByTime(loser, winner)).toBeLessThan(0)
		})

		test('two losers compare equally by time', () => {
			const loser1: GameCompletionStats = { status: 'lost', timeSpentMs: 50000 }
			const loser2: GameCompletionStats = { status: 'lost', timeSpentMs: 100000 }

			// loser1 has faster time, so should rank higher (positive result)
			expect(compareByTime(loser1, loser2)).toBeGreaterThan(0)
		})
	})

	describe('time comparison among winners', () => {
		test('faster time ranks higher', () => {
			const fast: GameCompletionStats = { status: 'won', timeSpentMs: 30000 }
			const slow: GameCompletionStats = { status: 'won', timeSpentMs: 60000 }

			expect(compareByTime(fast, slow)).toBeGreaterThan(0)
		})

		test('slower time ranks lower', () => {
			const fast: GameCompletionStats = { status: 'won', timeSpentMs: 30000 }
			const slow: GameCompletionStats = { status: 'won', timeSpentMs: 60000 }

			expect(compareByTime(slow, fast)).toBeLessThan(0)
		})

		test('equal times rank equally', () => {
			const a: GameCompletionStats = { status: 'won', timeSpentMs: 45000 }
			const b: GameCompletionStats = { status: 'won', timeSpentMs: 45000 }

			expect(compareByTime(a, b)).toBe(0)
		})
	})

	describe('undefined time handling', () => {
		test('defined time ranks higher than undefined', () => {
			const withTime: GameCompletionStats = { status: 'won', timeSpentMs: 100000 }
			const withoutTime: GameCompletionStats = { status: 'won' }

			expect(compareByTime(withTime, withoutTime)).toBeGreaterThan(0)
		})

		test('two undefined times return NaN (Infinity - Infinity)', () => {
			const a: GameCompletionStats = { status: 'won' }
			const b: GameCompletionStats = { status: 'won' }

			// Infinity - Infinity = NaN
			expect(Number.isNaN(compareByTime(a, b))).toBe(true)
		})
	})
})

// ============================================================================
// calculateWordleScore Tests
// ============================================================================

describe('calculateWordleScore', () => {
	describe('winning scores', () => {
		test('1 attempt = 100 points', () => {
			expect(calculateWordleScore(true, 1)).toBe(100)
		})

		test('2 attempts = 85 points', () => {
			expect(calculateWordleScore(true, 2)).toBe(85)
		})

		test('3 attempts = 70 points', () => {
			expect(calculateWordleScore(true, 3)).toBe(70)
		})

		test('4 attempts = 55 points', () => {
			expect(calculateWordleScore(true, 4)).toBe(55)
		})

		test('5 attempts = 40 points', () => {
			expect(calculateWordleScore(true, 5)).toBe(40)
		})

		test('6 attempts = 25 points (minimum)', () => {
			expect(calculateWordleScore(true, 6)).toBe(25)
		})

		test('more than 6 attempts still gets minimum 25 points', () => {
			expect(calculateWordleScore(true, 7)).toBe(25)
			expect(calculateWordleScore(true, 10)).toBe(25)
		})
	})

	describe('losing scores', () => {
		test('loss always returns 0 points', () => {
			expect(calculateWordleScore(false, 1)).toBe(0)
			expect(calculateWordleScore(false, 3)).toBe(0)
			expect(calculateWordleScore(false, 6)).toBe(0)
		})
	})

	describe('score formula', () => {
		test('each additional attempt costs 15 points', () => {
			const score1 = calculateWordleScore(true, 1)
			const score2 = calculateWordleScore(true, 2)
			const score3 = calculateWordleScore(true, 3)

			expect(score1 - score2).toBe(15)
			expect(score2 - score3).toBe(15)
		})
	})
})

// ============================================================================
// Integration Tests
// ============================================================================

describe('format utilities integration', () => {
	test('leaderboard sorting scenario', () => {
		const results: GameCompletionStats[] = [
			{ status: 'won', timeSpentMs: 45000, mistakes: 0 }, // Fast perfect
			{ status: 'won', timeSpentMs: 60000, mistakes: 2 }, // Slower with mistakes
			{ status: 'lost', timeSpentMs: 30000, mistakes: 3 }, // Fast but lost
			{ status: 'won', timeSpentMs: 30000, mistakes: 1 }, // Fastest winner
		]

		const sorted = [...results].sort((a, b) => -compareByTime(a, b))

		// Winners first, sorted by time (fastest first)
		expect(sorted[0].timeSpentMs).toBe(30000) // Fastest winner
		expect(sorted[1].timeSpentMs).toBe(45000) // Second fastest winner
		expect(sorted[2].timeSpentMs).toBe(60000) // Slowest winner
		expect(sorted[3].status).toBe('lost') // Loser last
	})

	test('game result display scenario', () => {
		const wonResult: GameShareStats = {
			status: 'won',
			timeSpentMs: 90000,
		}

		const lostResult: GameShareStats = {
			status: 'lost',
		}

		expect(formatTimeScore(wonResult)).toBe('1:30')
		expect(formatTimeScore(lostResult)).toBe('Lost')
	})

	test('perfect game achievement check', () => {
		const results: GameCompletionStats[] = [
			{ status: 'won', mistakes: 0 },
			{ status: 'won', mistakes: 1 },
			{ status: 'lost', mistakes: 0 },
		]

		const perfectGames = results.filter(isPerfectGame)
		expect(perfectGames.length).toBe(1)
		expect(perfectGames[0].status).toBe('won')
		expect(perfectGames[0].mistakes).toBe(0)
	})
})
