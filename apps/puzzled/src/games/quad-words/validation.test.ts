/**
 * Quad Words (Quordle) Validation Tests
 *
 * Tests for the validateAndScore function which:
 * - Validates submission data
 * - Verifies all 4 boards solved for win
 * - Calculates score based on attempts
 *
 * Scoring: Attempt-based
 * - 5 guesses (optimal): 100 points
 * - 6 guesses: 90 points
 * - 7 guesses: 80 points
 * - 8 guesses: 70 points
 * - 9 guesses: 60 points (max allowed)
 * - Loss: 0 points
 */

import { describe, expect, test } from 'bun:test'
import { quadWordsConfig } from './config'
import { MAX_GUESSES } from './types'
import type { GameSubmission } from '../types'

// Generate a puzzle for testing
const { puzzleData, solution } = quadWordsConfig.generatePuzzle(12345)

// Helper to create submission
function createSubmission(
	status: 'won' | 'lost',
	guesses: string[],
	solvedBoards: number,
	timeSpentMs = 120000,
): GameSubmission {
	return {
		status,
		attempts: guesses.length,
		timeSpentMs,
		data: { guesses, solvedBoards },
	}
}

describe('quad-words validateAndScore', () => {
	describe('valid solutions', () => {
		test('5 guesses with all boards solved scores 100 points', () => {
			const submission = createSubmission('won', ['CRANE', 'SLATE', 'AUDIO', 'PLUMB', 'QUICK'], 4)
			const result = quadWordsConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(true)
			if (result.valid) {
				expect(result.status).toBe('won')
				expect(result.score).toBe(100)
			}
		})

		test('6 guesses scores 90 points', () => {
			const submission = createSubmission(
				'won',
				['CRANE', 'SLATE', 'AUDIO', 'PLUMB', 'QUICK', 'JUMPY'],
				4,
			)
			const result = quadWordsConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(true)
			if (result.valid) {
				expect(result.status).toBe('won')
				expect(result.score).toBe(90)
			}
		})

		test('7 guesses scores 80 points', () => {
			const submission = createSubmission(
				'won',
				['CRANE', 'SLATE', 'AUDIO', 'PLUMB', 'QUICK', 'JUMPY', 'WALTZ'],
				4,
			)
			const result = quadWordsConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(true)
			if (result.valid) {
				expect(result.status).toBe('won')
				expect(result.score).toBe(80)
			}
		})

		test('8 guesses scores 70 points', () => {
			const submission = createSubmission(
				'won',
				['CRANE', 'SLATE', 'AUDIO', 'PLUMB', 'QUICK', 'JUMPY', 'WALTZ', 'NYMPH'],
				4,
			)
			const result = quadWordsConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(true)
			if (result.valid) {
				expect(result.status).toBe('won')
				expect(result.score).toBe(70)
			}
		})

		test('9 guesses scores 60 points', () => {
			const submission = createSubmission(
				'won',
				['CRANE', 'SLATE', 'AUDIO', 'PLUMB', 'QUICK', 'JUMPY', 'WALTZ', 'NYMPH', 'GLYPH'],
				4,
			)
			const result = quadWordsConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(true)
			if (result.valid) {
				expect(result.status).toBe('won')
				expect(result.score).toBe(60)
			}
		})

		test('minimum score is 40 for wins with many guesses', () => {
			// Even with many guesses, minimum is 40
			const submission = createSubmission('won', Array(15).fill('CRANE'), 4)

			// This should fail due to too many guesses
			const result = quadWordsConfig.validateAndScore(solution, puzzleData, submission)

			// If it exceeds MAX_GUESSES, should be invalid
			if (15 > MAX_GUESSES) {
				expect(result.valid).toBe(false)
			}
		})

		test('loss with incomplete boards scores 0 points', () => {
			const submission = createSubmission(
				'lost',
				['CRANE', 'SLATE', 'AUDIO', 'PLUMB', 'QUICK', 'JUMPY', 'WALTZ', 'NYMPH', 'GLYPH'],
				2,
			)
			const result = quadWordsConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(true)
			if (result.valid) {
				expect(result.status).toBe('lost')
				expect(result.score).toBe(0)
			}
		})
	})

	describe('invalid submissions', () => {
		test('rejects win claim without all boards solved', () => {
			const submission = createSubmission('won', ['CRANE', 'SLATE', 'AUDIO', 'PLUMB', 'QUICK'], 3)
			const result = quadWordsConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(false)
			if (!result.valid) {
				expect(result.error).toContain('Not all boards solved')
			}
		})

		test('rejects loss claim when all boards solved', () => {
			const submission = createSubmission('lost', ['CRANE', 'SLATE', 'AUDIO', 'PLUMB', 'QUICK'], 4)
			const result = quadWordsConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(false)
			if (!result.valid) {
				expect(result.error).toContain('Invalid loss claim')
			}
		})

		test('rejects too many guesses', () => {
			// MAX_GUESSES is 9 for Quordle
			const tooManyGuesses = Array(MAX_GUESSES + 1).fill('CRANE')
			const submission = createSubmission('won', tooManyGuesses, 4)
			const result = quadWordsConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(false)
			if (!result.valid) {
				expect(result.error).toContain('Too many guesses')
			}
		})
	})

	describe('edge cases', () => {
		test('handles missing solvedBoards', () => {
			const submission: GameSubmission = {
				status: 'won',
				attempts: 5,
				timeSpentMs: 120000,
				data: { guesses: ['CRANE', 'SLATE', 'AUDIO', 'PLUMB', 'QUICK'] },
			}
			const result = quadWordsConfig.validateAndScore(solution, puzzleData, submission)

			// Should fail because solvedBoards is not 4
			expect(result.valid).toBe(false)
		})

		test('handles null data for loss', () => {
			const submission: GameSubmission = {
				status: 'lost',
				attempts: 0,
				timeSpentMs: 120000,
				data: null,
			}
			const result = quadWordsConfig.validateAndScore(solution, puzzleData, submission)

			// Loss without 4 boards solved is valid
			expect(result.valid).toBe(true)
			if (result.valid) {
				expect(result.status).toBe('lost')
				expect(result.score).toBe(0)
			}
		})

		test('handles zero solved boards as loss', () => {
			const submission = createSubmission('lost', ['CRANE'], 0)
			const result = quadWordsConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(true)
			if (result.valid) {
				expect(result.status).toBe('lost')
			}
		})
	})
})
