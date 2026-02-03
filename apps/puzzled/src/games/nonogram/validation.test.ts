/**
 * Nonogram Validation Tests
 *
 * Tests for the validateAndScore function which:
 * - Validates submission grid data
 * - Verifies win/loss claims
 * - Calculates score based on time and errors
 *
 * Scoring: Time-based with error penalty
 * - Base: 500 points
 * - Time penalty: -1 point per 2 seconds
 * - Error penalty: -25 points per error
 * - Minimum: 100 points for a win
 */

import { describe, expect, test } from 'bun:test'
import { nonogramConfig } from './config'
import type { GameSubmission } from '../types'

// Generate a puzzle for testing
const { puzzleData, solution } = nonogramConfig.generatePuzzle(12345)

// Create a correct final grid from solution
const correctGrid = solution.grid.map((row) => row.map((cell) => cell === true))

// Create an incorrect grid (toggle one cell)
const incorrectGrid = solution.grid.map((row, r) =>
	row.map((cell, c) => (r === 0 && c === 0 ? !cell : cell === true)),
)

// Helper to create submission
function createSubmission(
	status: 'won' | 'lost',
	finalGrid: boolean[][] | undefined,
	errors: number,
	timeSpentMs: number,
): GameSubmission {
	return {
		status,
		attempts: 1,
		timeSpentMs,
		data: finalGrid !== undefined ? { finalGrid, errors } : { errors },
	}
}

describe('nonogram validateAndScore', () => {
	const gridSize = solution.grid.length

	describe('valid solutions', () => {
		test('fast solve with no errors scores 500 points', () => {
			const submission = createSubmission('won', correctGrid, 0, 0)
			const result = nonogramConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(true)
			if (result.valid) {
				expect(result.status).toBe('won')
				expect(result.score).toBe(500)
			}
		})

		test('100 second solve with no errors scores 450 points', () => {
			const submission = createSubmission('won', correctGrid, 0, 100000)
			const result = nonogramConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(true)
			if (result.valid) {
				expect(result.status).toBe('won')
				expect(result.score).toBe(450) // 500 - 50 (100/2)
			}
		})

		test('fast solve with 4 errors scores 400 points', () => {
			const submission = createSubmission('won', correctGrid, 4, 0)
			const result = nonogramConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(true)
			if (result.valid) {
				expect(result.status).toBe('won')
				expect(result.score).toBe(400) // 500 - 4*25
			}
		})

		test('120 second solve with 2 errors scores 390 points', () => {
			const submission = createSubmission('won', correctGrid, 2, 120000)
			const result = nonogramConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(true)
			if (result.valid) {
				expect(result.status).toBe('won')
				expect(result.score).toBe(390) // 500 - 60 - 50
			}
		})

		test('minimum score is 100 for wins', () => {
			const submission = createSubmission('won', correctGrid, 20, 2000000)
			const result = nonogramConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(true)
			if (result.valid) {
				expect(result.status).toBe('won')
				expect(result.score).toBe(100)
			}
		})

		test('loss scores 0 points', () => {
			const submission = createSubmission('lost', incorrectGrid, 0, 60000)
			const result = nonogramConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(true)
			if (result.valid) {
				expect(result.status).toBe('lost')
				expect(result.score).toBe(0)
			}
		})
	})

	describe('invalid submissions', () => {
		test('rejects missing final grid', () => {
			const submission = createSubmission('won', undefined, 0, 60000)
			const result = nonogramConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(false)
			if (!result.valid) {
				expect(result.error).toContain('Missing final grid')
			}
		})

		test('rejects invalid grid dimensions (wrong row count)', () => {
			const shortGrid = correctGrid.slice(0, 5)
			const submission = createSubmission('won', shortGrid, 0, 60000)
			const result = nonogramConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(false)
			if (!result.valid) {
				expect(result.error).toContain('Invalid grid dimensions')
			}
		})

		test('rejects invalid grid dimensions (wrong column count)', () => {
			const badGrid = correctGrid.map((row) => row.slice(0, 5))
			const submission = createSubmission('won', badGrid, 0, 60000)
			const result = nonogramConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(false)
			if (!result.valid) {
				expect(result.error).toContain('Invalid row')
			}
		})

		test('rejects false win claim with incorrect grid', () => {
			const submission = createSubmission('won', incorrectGrid, 0, 60000)
			const result = nonogramConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(false)
			if (!result.valid) {
				expect(result.error).toContain('Invalid win claim')
			}
		})

		test('rejects false loss claim with correct grid', () => {
			const submission = createSubmission('lost', correctGrid, 0, 60000)
			const result = nonogramConfig.validateAndScore(solution, puzzleData, submission)

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
			const result = nonogramConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(false)
		})

		test('handles missing errors field (defaults to 0)', () => {
			const submission: GameSubmission = {
				status: 'won',
				attempts: 1,
				timeSpentMs: 0,
				data: { finalGrid: correctGrid },
			}
			const result = nonogramConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(true)
			if (result.valid) {
				expect(result.score).toBe(500)
			}
		})

		test('all empty grid is incorrect (unless solution is all empty)', () => {
			const emptyGrid = Array.from({ length: gridSize }, () => Array(gridSize).fill(false))
			const submission = createSubmission('won', emptyGrid, 0, 60000)
			const result = nonogramConfig.validateAndScore(solution, puzzleData, submission)

			// Should fail unless solution happens to be all empty
			const solutionHasFilled = solution.grid.some((row) => row.some((cell) => cell === true))
			if (solutionHasFilled) {
				expect(result.valid).toBe(false)
			}
		})
	})
})
