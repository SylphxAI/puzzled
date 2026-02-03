/**
 * Pattern Match Validation Tests
 *
 * Tests for the validateAndScore function which:
 * - Validates submission found sets data
 * - Verifies found sets match solution
 * - Calculates score based on time and mistakes
 *
 * Scoring: Time-based with mistake penalty
 * - Base: 500 points
 * - Time penalty: -1 point per 2 seconds
 * - Mistake penalty: -10 points per wrong guess
 * - Minimum: 100 points for a win
 */

import { describe, expect, test } from 'bun:test'
import type { GameSubmission } from '../types'
import { patternMatchConfig } from './config'

// Generate a puzzle for testing
const { puzzleData, solution } = patternMatchConfig.generatePuzzle(12345)

// Valid sets from solution
const validSets = solution.validSets

// Helper to create submission
function createSubmission(
	status: 'won' | 'lost',
	foundSets: number[][] | undefined,
	mistakes: number,
	timeSpentMs: number,
): GameSubmission {
	return {
		status,
		attempts: (foundSets?.length ?? 0) + mistakes,
		timeSpentMs,
		data: foundSets !== undefined ? { foundSets, mistakes } : { mistakes },
	}
}

describe('pattern-match validateAndScore', () => {
	describe('valid solutions', () => {
		test('fast solve with no mistakes scores 500 points', () => {
			const submission = createSubmission('won', validSets, 0, 0)
			const result = patternMatchConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(true)
			if (result.valid) {
				expect(result.status).toBe('won')
				expect(result.score).toBe(500)
			}
		})

		test('100 second solve with no mistakes scores 450 points', () => {
			const submission = createSubmission('won', validSets, 0, 100000)
			const result = patternMatchConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(true)
			if (result.valid) {
				expect(result.status).toBe('won')
				expect(result.score).toBe(450) // 500 - 50
			}
		})

		test('fast solve with 3 mistakes scores 470 points', () => {
			const submission = createSubmission('won', validSets, 3, 0)
			const result = patternMatchConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(true)
			if (result.valid) {
				expect(result.status).toBe('won')
				expect(result.score).toBe(470) // 500 - 30
			}
		})

		test('100 second solve with 3 mistakes scores 420 points', () => {
			const submission = createSubmission('won', validSets, 3, 100000)
			const result = patternMatchConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(true)
			if (result.valid) {
				expect(result.status).toBe('won')
				expect(result.score).toBe(420) // 500 - 50 - 30
			}
		})

		test('minimum score is 100 for wins', () => {
			const submission = createSubmission('won', validSets, 50, 2000000)
			const result = patternMatchConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(true)
			if (result.valid) {
				expect(result.status).toBe('won')
				expect(result.score).toBe(100)
			}
		})

		test('loss scores 0 points', () => {
			// Only find some sets
			const partialSets = validSets.slice(0, Math.floor(validSets.length / 2))
			const submission = createSubmission('lost', partialSets, 0, 60000)
			const result = patternMatchConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(true)
			if (result.valid) {
				expect(result.status).toBe('lost')
				expect(result.score).toBe(0)
			}
		})
	})

	describe('invalid submissions', () => {
		test('rejects missing foundSets data', () => {
			const submission = createSubmission('won', undefined, 0, 60000)
			const result = patternMatchConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(false)
			if (!result.valid) {
				expect(result.error).toContain('Missing found sets')
			}
		})

		test('rejects win claim with incomplete sets', () => {
			const partialSets = validSets.slice(0, -1)
			const submission = createSubmission('won', partialSets, 0, 60000)
			const result = patternMatchConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(false)
			if (!result.valid) {
				expect(result.error).toContain('Invalid win claim')
			}
		})

		test('rejects false loss claim when all sets found', () => {
			const submission = createSubmission('lost', validSets, 0, 60000)
			const result = patternMatchConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(false)
			if (!result.valid) {
				expect(result.error).toContain('Invalid loss claim')
			}
		})
	})

	describe('edge cases', () => {
		test('handles null data', () => {
			const submission: GameSubmission = {
				status: 'won',
				attempts: 0,
				timeSpentMs: 60000,
				data: null,
			}
			const result = patternMatchConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(false)
		})

		test('handles missing mistakes field (defaults to 0)', () => {
			const submission: GameSubmission = {
				status: 'won',
				attempts: validSets.length,
				timeSpentMs: 0,
				data: { foundSets: validSets },
			}
			const result = patternMatchConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(true)
			if (result.valid) {
				expect(result.score).toBe(500)
			}
		})

		test('sets can be found in any order', () => {
			const reversedSets = [...validSets].reverse()
			const submission = createSubmission('won', reversedSets, 0, 0)
			const result = patternMatchConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(true)
			if (result.valid) {
				expect(result.status).toBe('won')
			}
		})

		test('card IDs within set can be in any order', () => {
			// Reverse card order within each set
			const reorderedSets = validSets.map((set) => [...set].reverse())
			const submission = createSubmission('won', reorderedSets, 0, 0)
			const result = patternMatchConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(true)
			if (result.valid) {
				expect(result.status).toBe('won')
			}
		})

		test('empty found sets is a loss', () => {
			const submission = createSubmission('lost', [], 5, 60000)
			const result = patternMatchConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(true)
			if (result.valid) {
				expect(result.status).toBe('lost')
			}
		})

		test('invalid set format (wrong length) is ignored', () => {
			// Include sets with wrong number of cards
			const setsWithInvalid = [...validSets, [1, 2]] // Only 2 cards
			const submission = createSubmission('won', setsWithInvalid, 0, 0)
			const result = patternMatchConfig.validateAndScore(solution, puzzleData, submission)

			// Should still be valid if all valid sets are present
			expect(result.valid).toBe(true)
		})
	})
})
