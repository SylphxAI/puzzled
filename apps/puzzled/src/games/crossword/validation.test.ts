/**
 * Crossword Mini Validation Tests
 *
 * Tests for the validateAndScore function which:
 * - Validates submission grid data
 * - Verifies win/loss claims
 * - Calculates score based on time
 *
 * Scoring: Time-based
 * - Base: 500 points
 * - Time penalty: -1 point per 2 seconds
 * - Minimum: 100 points for a win
 */

import { describe, expect, test } from 'bun:test'
import { crosswordConfig, type CrosswordPuzzleClientData, type CrosswordSolution } from './config'
import type { GameSubmission } from '../types'
import { GRID_SIZE } from './types'

// Generate a puzzle for testing
const { puzzleData, solution } = crosswordConfig.generatePuzzle(12345)

// Create correct grid from solution
const correctGrid = solution.grid

// Create incorrect grid (change one letter)
const incorrectGrid = solution.grid.map((row, r) =>
	row.map((cell, c) => {
		if (r === 0 && c === 0 && cell !== '') {
			// Change to a different letter
			return cell === 'A' ? 'B' : 'A'
		}
		return cell
	}),
)

// Helper to create submission
function createSubmission(
	status: 'won' | 'lost',
	finalGrid: (string | null)[][] | undefined,
	timeSpentMs: number,
): GameSubmission {
	return {
		status,
		attempts: 1,
		timeSpentMs,
		data: finalGrid !== undefined ? { finalGrid } : {},
	}
}

describe('crossword validateAndScore', () => {
	describe('valid solutions', () => {
		test('fast solve scores 500 points', () => {
			const submission = createSubmission('won', correctGrid, 0)
			const result = crosswordConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(true)
			if (result.valid) {
				expect(result.status).toBe('won')
				expect(result.score).toBe(500)
			}
		})

		test('100 second solve scores 450 points', () => {
			const submission = createSubmission('won', correctGrid, 100000)
			const result = crosswordConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(true)
			if (result.valid) {
				expect(result.status).toBe('won')
				expect(result.score).toBe(450) // 500 - 50
			}
		})

		test('200 second solve scores 400 points', () => {
			const submission = createSubmission('won', correctGrid, 200000)
			const result = crosswordConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(true)
			if (result.valid) {
				expect(result.status).toBe('won')
				expect(result.score).toBe(400)
			}
		})

		test('minimum score is 100 for wins', () => {
			const submission = createSubmission('won', correctGrid, 2000000)
			const result = crosswordConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(true)
			if (result.valid) {
				expect(result.status).toBe('won')
				expect(result.score).toBe(100)
			}
		})

		test('loss scores 0 points', () => {
			const submission = createSubmission('lost', incorrectGrid, 60000)
			const result = crosswordConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(true)
			if (result.valid) {
				expect(result.status).toBe('lost')
				expect(result.score).toBe(0)
			}
		})
	})

	describe('invalid submissions', () => {
		test('rejects missing finalGrid data', () => {
			const submission = createSubmission('won', undefined, 60000)
			const result = crosswordConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(false)
			if (!result.valid) {
				expect(result.error).toContain('Missing final grid')
			}
		})

		test('rejects non-array finalGrid', () => {
			const submission: GameSubmission = {
				status: 'won',
				attempts: 1,
				timeSpentMs: 60000,
				data: { finalGrid: 'not an array' },
			}
			const result = crosswordConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(false)
		})

		test('rejects false win claim with incorrect grid', () => {
			const submission = createSubmission('won', incorrectGrid, 60000)
			const result = crosswordConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(false)
			if (!result.valid) {
				expect(result.error).toContain('Invalid win claim')
			}
		})

		test('rejects false loss claim with correct grid', () => {
			const submission = createSubmission('lost', correctGrid, 60000)
			const result = crosswordConfig.validateAndScore(solution, puzzleData, submission)

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
			const result = crosswordConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(false)
		})

		test('time penalty calculation - odd seconds', () => {
			// 99 seconds = floor(99/2) = 49 penalty
			const submission = createSubmission('won', correctGrid, 99000)
			const result = crosswordConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(true)
			if (result.valid) {
				expect(result.score).toBe(451) // 500 - 49
			}
		})

		test('grid with empty cells where letters should be is incorrect', () => {
			const gridWithEmpty = solution.grid.map((row, r) =>
				row.map((cell, c) => {
					// Make first non-empty cell empty
					if (r === 0 && c === 0 && cell !== '') {
						return ''
					}
					return cell
				}),
			)
			const submission = createSubmission('won', gridWithEmpty, 60000)
			const result = crosswordConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(false)
		})
	})
})
