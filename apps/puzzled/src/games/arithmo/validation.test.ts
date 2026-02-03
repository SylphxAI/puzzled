/**
 * Arithmo Validation Tests
 *
 * Tests for the validateAndScore function which:
 * - Validates submission guesses data
 * - Verifies win/loss claims
 * - Calculates score based on attempts (Wordle-style)
 *
 * Scoring: Attempt-based
 * - 1 attempt: 100 points
 * - 2 attempts: 85 points
 * - 3 attempts: 70 points
 * - 4 attempts: 55 points
 * - 5 attempts: 40 points
 * - 6 attempts: 25 points
 * - Loss: 0 points
 */

import { describe, expect, test } from 'bun:test'
import type { GameSubmission } from '../types'
import { arithmoConfig } from './config'

// Generate a puzzle for testing
const { puzzleData, solution } = arithmoConfig.generatePuzzle(12345)
const correctEquation = solution.equation

// Valid 8-character equations for testing (must evaluate correctly)
const validGuesses = [
	'12+34=46', // Valid guess 1
	'56-32=24', // Valid guess 2
	'10+20=30', // Valid guess 3
	'99-11=88', // Valid guess 4
	'15+25=40', // Valid guess 5
	'80-40=40', // Valid guess 6
]

// Helper to create submission
function createSubmission(
	status: 'won' | 'lost',
	guesses: string[],
	timeSpentMs = 60000,
): GameSubmission {
	return {
		status,
		attempts: guesses.length,
		timeSpentMs,
		data: { guesses },
	}
}

describe('arithmo validateAndScore', () => {
	describe('valid solutions', () => {
		test('win on first attempt scores 100 points', () => {
			const submission = createSubmission('won', [correctEquation])
			const result = arithmoConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(true)
			if (result.valid) {
				expect(result.status).toBe('won')
				expect(result.score).toBe(100)
			}
		})

		test('win on second attempt scores 85 points', () => {
			const submission = createSubmission('won', [validGuesses[0], correctEquation])
			const result = arithmoConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(true)
			if (result.valid) {
				expect(result.status).toBe('won')
				expect(result.score).toBe(85)
			}
		})

		test('win on third attempt scores 70 points', () => {
			const submission = createSubmission('won', [
				validGuesses[0],
				validGuesses[1],
				correctEquation,
			])
			const result = arithmoConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(true)
			if (result.valid) {
				expect(result.status).toBe('won')
				expect(result.score).toBe(70)
			}
		})

		test('win on fourth attempt scores 55 points', () => {
			const submission = createSubmission('won', [
				validGuesses[0],
				validGuesses[1],
				validGuesses[2],
				correctEquation,
			])
			const result = arithmoConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(true)
			if (result.valid) {
				expect(result.status).toBe('won')
				expect(result.score).toBe(55)
			}
		})

		test('win on fifth attempt scores 40 points', () => {
			const submission = createSubmission('won', [
				validGuesses[0],
				validGuesses[1],
				validGuesses[2],
				validGuesses[3],
				correctEquation,
			])
			const result = arithmoConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(true)
			if (result.valid) {
				expect(result.status).toBe('won')
				expect(result.score).toBe(40)
			}
		})

		test('win on sixth attempt scores 25 points', () => {
			const submission = createSubmission('won', [
				validGuesses[0],
				validGuesses[1],
				validGuesses[2],
				validGuesses[3],
				validGuesses[4],
				correctEquation,
			])
			const result = arithmoConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(true)
			if (result.valid) {
				expect(result.status).toBe('won')
				expect(result.score).toBe(25)
			}
		})

		test('loss scores 0 points', () => {
			const submission = createSubmission('lost', [
				validGuesses[0],
				validGuesses[1],
				validGuesses[2],
				validGuesses[3],
				validGuesses[4],
				validGuesses[5],
			])
			const result = arithmoConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(true)
			if (result.valid) {
				expect(result.status).toBe('lost')
				expect(result.score).toBe(0)
			}
		})
	})

	describe('invalid submissions', () => {
		test('rejects missing guesses data', () => {
			const submission: GameSubmission = {
				status: 'won',
				attempts: 1,
				timeSpentMs: 60000,
				data: {},
			}
			const result = arithmoConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(false)
			if (!result.valid) {
				expect(result.error).toContain('Missing guesses')
			}
		})

		test('rejects empty guesses array', () => {
			const submission = createSubmission('won', [])
			const result = arithmoConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(false)
		})

		test('rejects invalid equation in guesses', () => {
			const submission = createSubmission('won', ['notanequ', correctEquation])
			const result = arithmoConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(false)
			if (!result.valid) {
				expect(result.error).toContain('Invalid equation')
			}
		})

		test('rejects false win claim when final guess does not match', () => {
			const submission = createSubmission('won', [validGuesses[0], validGuesses[1]])
			const result = arithmoConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(false)
			if (!result.valid) {
				expect(result.error).toContain('Invalid win claim')
			}
		})

		test('rejects false loss claim when final guess matches', () => {
			const submission = createSubmission('lost', [validGuesses[0], correctEquation])
			const result = arithmoConfig.validateAndScore(solution, puzzleData, submission)

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
			const result = arithmoConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(false)
		})

		test('validates all intermediate guesses are valid equations', () => {
			const submission = createSubmission('won', ['abc=xyzz', correctEquation])
			const result = arithmoConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(false)
		})
	})
})
