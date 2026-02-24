/**
 * Sudoku Validation Tests
 *
 * Tests for the validateAndScore function which:
 * - Validates submission grid data
 * - Verifies win/loss claims
 * - Calculates score based on time and mistakes
 *
 * Scoring: Time-based with mistake penalty
 * - Base: 1000 points
 * - Time penalty: -1 point per second (up to 500)
 * - Mistake penalty: -50 points per mistake
 * - Minimum: 100 points for a win
 */

import { describe, expect, test } from 'bun:test'
import type { GameSubmission } from '../types'
import { sudokuConfig } from './config'

// Generate a puzzle for testing
const { puzzleData, solution } = sudokuConfig.generatePuzzle(12345, 'medium')

// Create a correct final grid from solution
const correctGrid = solution.grid

// Create an incorrect grid (one wrong cell)
const incorrectGrid = solution.grid.map((row, r) =>
	row.map((cell, c) => (r === 0 && c === 0 ? (cell % 9) + 1 : cell)),
)

// Helper to create submission
function createSubmission(
	status: 'won' | 'lost',
	finalGrid: (number | null)[][],
	mistakes: number,
	timeSpentMs: number,
): GameSubmission {
	return {
		status,
		attempts: 1,
		timeSpentMs,
		data: { finalGrid, mistakes },
	}
}

describe('sudoku validateAndScore', () => {
	describe('valid solutions', () => {
		test('fast solve (0 seconds) with no mistakes scores 1000 points', () => {
			const submission = createSubmission('won', correctGrid, 0, 0)
			const result = sudokuConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(true)
			if (result.valid) {
				expect(result.status).toBe('won')
				expect(result.score).toBe(1000)
			}
		})

		test('100 second solve with no mistakes scores 900 points', () => {
			const submission = createSubmission('won', correctGrid, 0, 100000)
			const result = sudokuConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(true)
			if (result.valid) {
				expect(result.status).toBe('won')
				expect(result.score).toBe(900) // 1000 - 100
			}
		})

		test('500+ second solve with no mistakes scores 500 points', () => {
			const submission = createSubmission('won', correctGrid, 0, 600000)
			const result = sudokuConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(true)
			if (result.valid) {
				expect(result.status).toBe('won')
				expect(result.score).toBe(500) // 1000 - 500 (capped)
			}
		})

		test('fast solve with 5 mistakes scores 750 points', () => {
			const submission = createSubmission('won', correctGrid, 5, 0)
			const result = sudokuConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(true)
			if (result.valid) {
				expect(result.status).toBe('won')
				expect(result.score).toBe(750) // 1000 - 5*50
			}
		})

		test('200 second solve with 3 mistakes scores 650 points', () => {
			const submission = createSubmission('won', correctGrid, 3, 200000)
			const result = sudokuConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(true)
			if (result.valid) {
				expect(result.status).toBe('won')
				expect(result.score).toBe(650) // 1000 - 200 - 150
			}
		})

		test('minimum score is 100 for wins', () => {
			// Long time + many mistakes should still score at least 100
			const submission = createSubmission('won', correctGrid, 20, 700000)
			const result = sudokuConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(true)
			if (result.valid) {
				expect(result.status).toBe('won')
				expect(result.score).toBe(100)
			}
		})

		test('loss scores 0 points', () => {
			const submission = createSubmission('lost', incorrectGrid, 0, 60000)
			const result = sudokuConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(true)
			if (result.valid) {
				expect(result.status).toBe('lost')
				expect(result.score).toBe(0)
			}
		})
	})

	describe('invalid submissions', () => {
		test('rejects missing final grid', () => {
			const submission: GameSubmission = {
				status: 'won',
				attempts: 1,
				timeSpentMs: 60000,
				data: { mistakes: 0 },
			}
			const result = sudokuConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(false)
			if (!result.valid) {
				expect(result.error).toContain('Missing final grid')
			}
		})

		test('rejects invalid grid dimensions (wrong row count)', () => {
			const shortGrid = correctGrid.slice(0, 5)
			const submission = createSubmission('won', shortGrid, 0, 60000)
			const result = sudokuConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(false)
			if (!result.valid) {
				expect(result.error).toContain('Invalid grid dimensions')
			}
		})

		test('rejects invalid grid dimensions (wrong column count)', () => {
			const badGrid = correctGrid.map((row) => row.slice(0, 5))
			const submission = createSubmission('won', badGrid, 0, 60000)
			const result = sudokuConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(false)
			if (!result.valid) {
				expect(result.error).toContain('Invalid row')
			}
		})

		test('rejects false win claim with incorrect grid', () => {
			const submission = createSubmission('won', incorrectGrid, 0, 60000)
			const result = sudokuConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(false)
			if (!result.valid) {
				expect(result.error).toContain('Invalid win claim')
			}
		})

		test('rejects false loss claim with correct grid', () => {
			const submission = createSubmission('lost', correctGrid, 0, 60000)
			const result = sudokuConfig.validateAndScore(solution, puzzleData, submission)

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
			const result = sudokuConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(false)
		})

		test('handles missing mistakes field (defaults to 0)', () => {
			const submission: GameSubmission = {
				status: 'won',
				attempts: 1,
				timeSpentMs: 0,
				data: { finalGrid: correctGrid },
			}
			const result = sudokuConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(true)
			if (result.valid) {
				expect(result.score).toBe(1000) // No mistake penalty
			}
		})

		test('validates each cell against solution', () => {
			// Create a grid with only one wrong cell
			const almostCorrect = correctGrid.map((row, r) =>
				row.map((cell, c) => (r === 4 && c === 4 ? (cell % 9) + 1 : cell)),
			)
			const submission = createSubmission('won', almostCorrect, 0, 60000)
			const result = sudokuConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(false)
		})
	})
})
