/**
 * Cryptogram Validation Tests
 *
 * Tests for the validateAndScore function which:
 * - Validates submission guesses data
 * - Verifies win/loss claims
 * - Calculates score based on time and hints
 *
 * Scoring: Time-based with hint penalty
 * - Base: 500 points
 * - Time penalty: -1 point per 2 seconds
 * - Hint penalty: -50 points per hint used
 * - Minimum: 100 points for a win
 */

import { describe, expect, test } from 'bun:test'
import { cryptogramConfig } from './config'
import type { PlayerGuesses } from './types'
import type { GameSubmission } from '../types'

// Generate a puzzle for testing
const { puzzleData, solution } = cryptogramConfig.generatePuzzle(12345)

// Create correct guesses (reverse cipher provides encrypted -> original mapping)
const correctGuesses: PlayerGuesses = { ...solution.reverseCipher }

// Create incorrect guesses (swap two letters)
const incorrectGuesses: PlayerGuesses = { ...solution.reverseCipher }
const keys = Object.keys(incorrectGuesses)
if (keys.length >= 2) {
	// Swap first two mappings
	const temp = incorrectGuesses[keys[0]]
	incorrectGuesses[keys[0]] = incorrectGuesses[keys[1]]
	incorrectGuesses[keys[1]] = temp
}

// Helper to create submission
function createSubmission(
	status: 'won' | 'lost',
	guesses: PlayerGuesses | undefined,
	hintsUsed: number,
	timeSpentMs: number,
): GameSubmission {
	return {
		status,
		attempts: 1,
		timeSpentMs,
		data: guesses !== undefined ? { guesses, hintsUsed } : { hintsUsed },
	}
}

describe('cryptogram validateAndScore', () => {
	describe('valid solutions', () => {
		test('fast solve with no hints scores 500 points', () => {
			const submission = createSubmission('won', correctGuesses, 0, 0)
			const result = cryptogramConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(true)
			if (result.valid) {
				expect(result.status).toBe('won')
				expect(result.score).toBe(500)
			}
		})

		test('100 second solve with no hints scores 450 points', () => {
			const submission = createSubmission('won', correctGuesses, 0, 100000)
			const result = cryptogramConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(true)
			if (result.valid) {
				expect(result.status).toBe('won')
				expect(result.score).toBe(450) // 500 - 50
			}
		})

		test('fast solve with 2 hints scores 400 points', () => {
			const submission = createSubmission('won', correctGuesses, 2, 0)
			const result = cryptogramConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(true)
			if (result.valid) {
				expect(result.status).toBe('won')
				expect(result.score).toBe(400) // 500 - 100
			}
		})

		test('100 second solve with 3 hints scores 300 points', () => {
			const submission = createSubmission('won', correctGuesses, 3, 100000)
			const result = cryptogramConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(true)
			if (result.valid) {
				expect(result.status).toBe('won')
				expect(result.score).toBe(300) // 500 - 50 - 150
			}
		})

		test('minimum score is 100 for wins', () => {
			const submission = createSubmission('won', correctGuesses, 10, 2000000)
			const result = cryptogramConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(true)
			if (result.valid) {
				expect(result.status).toBe('won')
				expect(result.score).toBe(100)
			}
		})

		test('loss scores 0 points', () => {
			const submission = createSubmission('lost', incorrectGuesses, 0, 60000)
			const result = cryptogramConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(true)
			if (result.valid) {
				expect(result.status).toBe('lost')
				expect(result.score).toBe(0)
			}
		})
	})

	describe('invalid submissions', () => {
		test('rejects missing guesses data', () => {
			const submission = createSubmission('won', undefined, 0, 60000)
			const result = cryptogramConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(false)
			if (!result.valid) {
				expect(result.error).toContain('Missing guesses')
			}
		})

		test('rejects false win claim with incorrect guesses', () => {
			const submission = createSubmission('won', incorrectGuesses, 0, 60000)
			const result = cryptogramConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(false)
			if (!result.valid) {
				expect(result.error).toContain('Invalid win claim')
			}
		})

		test('rejects false loss claim with correct guesses', () => {
			const submission = createSubmission('lost', correctGuesses, 0, 60000)
			const result = cryptogramConfig.validateAndScore(solution, puzzleData, submission)

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
				attempts: 1,
				timeSpentMs: 60000,
				data: null,
			}
			const result = cryptogramConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(false)
		})

		test('handles missing hintsUsed field (defaults to 0)', () => {
			const submission: GameSubmission = {
				status: 'won',
				attempts: 1,
				timeSpentMs: 0,
				data: { guesses: correctGuesses },
			}
			const result = cryptogramConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(true)
			if (result.valid) {
				expect(result.score).toBe(500)
			}
		})

		test('partial guesses with missing letters is incorrect', () => {
			const partialGuesses: PlayerGuesses = { ...correctGuesses }
			// Remove one mapping
			const firstKey = Object.keys(partialGuesses)[0]
			delete partialGuesses[firstKey]

			const submission = createSubmission('won', partialGuesses, 0, 60000)
			const result = cryptogramConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(false)
		})

		test('empty guesses object is incorrect', () => {
			const submission = createSubmission('won', {}, 0, 60000)
			const result = cryptogramConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(false)
		})
	})
})
