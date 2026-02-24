/**
 * Word Ladder Validation Tests
 *
 * Tests for the validateAndScore function which:
 * - Validates submission path data
 * - Verifies each step is a valid one-letter change
 * - Calculates score based on path length vs optimal
 *
 * Scoring: Step-based
 * - Base: 100 points for optimal solution
 * - Penalty: -10 points per extra step
 * - Minimum: 25 points for a win
 */

import { describe, expect, test } from 'bun:test'
import type { GameSubmission } from '../types'
import { wordLadderConfig } from './config'

// Generate a puzzle for testing
const { puzzleData, solution } = wordLadderConfig.generatePuzzle(12345)

// Get start and end words from solution
const startWord = solution.path[0]
const endWord = solution.path[solution.path.length - 1]
const optimalPath = solution.path

// Helper to create submission
function createSubmission(
	status: 'won' | 'lost',
	path: string[] | undefined,
	timeSpentMs = 60000,
): GameSubmission {
	return {
		status,
		attempts: path?.length ?? 0,
		timeSpentMs,
		data: path !== undefined ? { path } : {},
	}
}

describe('word-ladder validateAndScore', () => {
	describe('valid solutions', () => {
		test('optimal path scores 100 points', () => {
			const submission = createSubmission('won', optimalPath)
			const result = wordLadderConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(true)
			if (result.valid) {
				expect(result.status).toBe('won')
				expect(result.score).toBe(100)
			}
		})

		test('loss scores 0 points', () => {
			const submission = createSubmission('lost', undefined)
			const result = wordLadderConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(true)
			if (result.valid) {
				expect(result.status).toBe('lost')
				expect(result.score).toBe(0)
			}
		})
	})

	describe('invalid submissions', () => {
		test('rejects win claim with missing path', () => {
			const submission: GameSubmission = {
				status: 'won',
				attempts: 0,
				timeSpentMs: 60000,
				data: {},
			}
			const result = wordLadderConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(false)
			if (!result.valid) {
				expect(result.error).toContain('No valid path')
			}
		})

		test('rejects win claim with empty path', () => {
			const submission = createSubmission('won', [])
			const result = wordLadderConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(false)
		})

		test('rejects win claim with single word path', () => {
			const submission = createSubmission('won', [startWord])
			const result = wordLadderConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(false)
		})

		test('rejects path not starting with start word', () => {
			const badPath = ['WRONG', ...optimalPath.slice(1)]
			const submission = createSubmission('won', badPath)
			const result = wordLadderConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(false)
			if (!result.valid) {
				expect(result.error).toContain('must start with')
			}
		})

		test('rejects path not ending with end word', () => {
			const badPath = [...optimalPath.slice(0, -1), 'WRONG']
			const submission = createSubmission('won', badPath)
			const result = wordLadderConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(false)
			if (!result.valid) {
				expect(result.error).toContain('must end with')
			}
		})

		test('rejects invalid word in path', () => {
			// Replace middle word with non-word
			if (optimalPath.length > 2) {
				const badPath = [optimalPath[0], 'ZZZZZ', ...optimalPath.slice(2)]
				const submission = createSubmission('won', badPath)
				const result = wordLadderConfig.validateAndScore(solution, puzzleData, submission)

				expect(result.valid).toBe(false)
				if (!result.valid) {
					expect(result.error).toContain('Invalid word')
				}
			}
		})

		test('rejects invalid step (more than one letter change)', () => {
			// Jump directly from start to end if they differ by more than one letter
			if (optimalPath.length > 2) {
				const badPath = [startWord, endWord]
				const submission = createSubmission('won', badPath)
				const result = wordLadderConfig.validateAndScore(solution, puzzleData, submission)

				expect(result.valid).toBe(false)
				if (!result.valid) {
					expect(result.error).toContain('Invalid step')
				}
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
			const result = wordLadderConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(false)
		})

		test('handles case insensitivity', () => {
			const lowercasePath = optimalPath.map((w) => w.toLowerCase())
			const submission = createSubmission('won', lowercasePath)
			const result = wordLadderConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(true)
			if (result.valid) {
				expect(result.status).toBe('won')
			}
		})

		test('handles mixed case path', () => {
			const mixedCasePath = optimalPath.map((w, i) =>
				i % 2 === 0 ? w.toLowerCase() : w.toUpperCase(),
			)
			const submission = createSubmission('won', mixedCasePath)
			const result = wordLadderConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(true)
		})

		test('loss with undefined path is valid', () => {
			const submission = createSubmission('lost', undefined)
			const result = wordLadderConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(true)
			if (result.valid) {
				expect(result.status).toBe('lost')
				expect(result.score).toBe(0)
			}
		})
	})
})
