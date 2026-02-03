/**
 * Block Slide Validation Tests
 *
 * Tests for the validateAndScore function which:
 * - Validates submission move count
 * - Verifies move count is at least minimum
 * - Calculates score based on moves and time
 *
 * Scoring: Move-based with time bonus
 * - Base: 500 points for optimal solution
 * - Move penalty: -5 points per extra move
 * - Time bonus: +50 points for solving under 60 seconds
 * - Minimum: 100 points for a win
 */

import { describe, expect, test } from 'bun:test'
import { blockSlideConfig } from './config'
import type { BlockSlideSolution } from './types'
import type { GameSubmission } from '../types'

// Generate a puzzle for testing
const { puzzleData, solution } = blockSlideConfig.generatePuzzle(12345)

// Helper to create submission
function createSubmission(
	status: 'won' | 'lost',
	moveCount: number | undefined,
	timeSpentMs: number,
): GameSubmission {
	return {
		status,
		attempts: moveCount ?? 0,
		timeSpentMs,
		data: moveCount !== undefined ? { moveCount } : {},
	}
}

describe('block-slide validateAndScore', () => {
	describe('valid solutions', () => {
		test('optimal solution under 60s scores 550 points', () => {
			const submission = createSubmission('won', solution.minMoves, 30000)
			const result = blockSlideConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(true)
			if (result.valid) {
				expect(result.status).toBe('won')
				expect(result.score).toBe(550) // 500 + 50 time bonus
			}
		})

		test('optimal solution over 60s scores 500 points', () => {
			const submission = createSubmission('won', solution.minMoves, 120000)
			const result = blockSlideConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(true)
			if (result.valid) {
				expect(result.status).toBe('won')
				expect(result.score).toBe(500)
			}
		})

		test('5 extra moves over 60s scores 475 points', () => {
			const submission = createSubmission('won', solution.minMoves + 5, 120000)
			const result = blockSlideConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(true)
			if (result.valid) {
				expect(result.status).toBe('won')
				expect(result.score).toBe(475) // 500 - 5*5
			}
		})

		test('5 extra moves under 60s scores 525 points', () => {
			const submission = createSubmission('won', solution.minMoves + 5, 30000)
			const result = blockSlideConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(true)
			if (result.valid) {
				expect(result.status).toBe('won')
				expect(result.score).toBe(525) // 500 - 25 + 50
			}
		})

		test('many extra moves scores minimum 100 points', () => {
			const submission = createSubmission('won', solution.minMoves + 100, 120000)
			const result = blockSlideConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(true)
			if (result.valid) {
				expect(result.status).toBe('won')
				expect(result.score).toBe(100)
			}
		})

		test('loss scores 0 points', () => {
			const submission = createSubmission('lost', undefined, 120000)
			const result = blockSlideConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(true)
			if (result.valid) {
				expect(result.status).toBe('lost')
				expect(result.score).toBe(0)
			}
		})
	})

	describe('invalid submissions', () => {
		test('rejects win claim with missing move count', () => {
			const submission = createSubmission('won', undefined, 60000)
			const result = blockSlideConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(false)
			if (!result.valid) {
				expect(result.error).toContain('Missing move count')
			}
		})

		test('rejects move count less than minimum', () => {
			const submission = createSubmission('won', solution.minMoves - 1, 60000)
			const result = blockSlideConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(false)
			if (!result.valid) {
				expect(result.error).toContain('Impossible')
			}
		})

		test('rejects move count of 0 when minimum is greater', () => {
			if (solution.minMoves > 0) {
				const submission = createSubmission('won', 0, 60000)
				const result = blockSlideConfig.validateAndScore(solution, puzzleData, submission)

				expect(result.valid).toBe(false)
				if (!result.valid) {
					expect(result.error).toContain('Impossible')
				}
			}
		})
	})

	describe('edge cases', () => {
		test('time bonus boundary - exactly 60 seconds gets no bonus', () => {
			const submission = createSubmission('won', solution.minMoves, 60000)
			const result = blockSlideConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(true)
			if (result.valid) {
				expect(result.score).toBe(500) // No time bonus at exactly 60s
			}
		})

		test('time bonus boundary - 59999ms gets bonus', () => {
			const submission = createSubmission('won', solution.minMoves, 59999)
			const result = blockSlideConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(true)
			if (result.valid) {
				expect(result.score).toBe(550) // Gets time bonus
			}
		})

		test('loss with missing move count is valid', () => {
			const submission: GameSubmission = {
				status: 'lost',
				attempts: 0,
				timeSpentMs: 120000,
				data: {},
			}
			const result = blockSlideConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(true)
			if (result.valid) {
				expect(result.status).toBe('lost')
				expect(result.score).toBe(0)
			}
		})

		test('exact minimum moves is valid', () => {
			const submission = createSubmission('won', solution.minMoves, 120000)
			const result = blockSlideConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(true)
		})
	})
})
