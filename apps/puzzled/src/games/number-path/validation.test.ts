/**
 * Path validation tests
 *
 * Scoring: Time-based
 * - Base: 500 points
 * - Time penalty: -1 point per 2 seconds
 * - Minimum: 100 points for a win
 */

import { describe, expect, test } from 'bun:test'
import type { GameSubmission } from '../types'
import { numberPathConfig } from './config'
import { FIXTURE_3X3_CLUES, FIXTURE_3X3_PATH_A, FIXTURE_3X3_PATH_B } from './fixtures'
import type { Cell, NumberPathPuzzleData, NumberPathSolution } from './types'

const { puzzleData, solution } = numberPathConfig.generatePuzzle(12345)

function createSubmission(
	status: 'won' | 'lost',
	path: Cell[] | undefined,
	timeSpentMs: number,
): GameSubmission {
	return {
		status,
		attempts: 1,
		timeSpentMs,
		data: path !== undefined ? { path } : {},
	}
}

const fixturePuzzle: NumberPathPuzzleData = { size: 3, clues: FIXTURE_3X3_CLUES }
const fixtureSolutionA: NumberPathSolution = { path: FIXTURE_3X3_PATH_A }

describe('number-path validateAndScore', () => {
	describe('valid solutions', () => {
		test('fast solve scores 500 points', () => {
			const submission = createSubmission('won', solution.path, 0)
			const result = numberPathConfig.validateAndScore(solution, puzzleData, submission)
			expect(result.valid).toBe(true)
			if (result.valid) {
				expect(result.status).toBe('won')
				expect(result.score).toBe(500)
			}
		})

		test('100 second solve scores 450 points', () => {
			const submission = createSubmission('won', solution.path, 100000)
			const result = numberPathConfig.validateAndScore(solution, puzzleData, submission)
			expect(result.valid).toBe(true)
			if (result.valid) {
				expect(result.status).toBe('won')
				expect(result.score).toBe(450)
			}
		})

		test('200 second solve scores 400 points', () => {
			const submission = createSubmission('won', solution.path, 200000)
			const result = numberPathConfig.validateAndScore(solution, puzzleData, submission)
			expect(result.valid).toBe(true)
			if (result.valid) {
				expect(result.status).toBe('won')
				expect(result.score).toBe(400)
			}
		})

		test('minimum score is 100 for wins', () => {
			const submission = createSubmission('won', solution.path, 2000000)
			const result = numberPathConfig.validateAndScore(solution, puzzleData, submission)
			expect(result.valid).toBe(true)
			if (result.valid) {
				expect(result.status).toBe('won')
				expect(result.score).toBe(100)
			}
		})

		test('loss scores 0 points', () => {
			const submission = createSubmission('lost', solution.path.slice(0, 4), 60000)
			const result = numberPathConfig.validateAndScore(solution, puzzleData, submission)
			expect(result.valid).toBe(true)
			if (result.valid) {
				expect(result.status).toBe('lost')
				expect(result.score).toBe(0)
			}
		})

		test('accepts an alternate Hamiltonian path that respects clues', () => {
			const submission = createSubmission('won', FIXTURE_3X3_PATH_B, 0)
			const result = numberPathConfig.validateAndScore(fixtureSolutionA, fixturePuzzle, submission)
			expect(result.valid).toBe(true)
			if (result.valid) {
				expect(result.status).toBe('won')
				expect(result.score).toBe(500)
			}
		})
	})

	describe('invalid submissions', () => {
		test('rejects missing path data', () => {
			const submission = createSubmission('won', undefined, 60000)
			const result = numberPathConfig.validateAndScore(solution, puzzleData, submission)
			expect(result.valid).toBe(false)
			if (!result.valid) {
				expect(result.error).toContain('Missing path')
			}
		})

		test('rejects false win claim with incomplete path', () => {
			const submission = createSubmission('won', solution.path.slice(0, 8), 60000)
			const result = numberPathConfig.validateAndScore(solution, puzzleData, submission)
			expect(result.valid).toBe(false)
			if (!result.valid) {
				expect(result.error).toContain('not correctly solved')
			}
		})

		test('rejects false win that only matches stored seed path pinning', () => {
			const wrongOrder = [...solution.path]
			if (wrongOrder.length >= 3) {
				const tmp = wrongOrder[1]
				wrongOrder[1] = wrongOrder[2]
				wrongOrder[2] = tmp
			}
			const submission = createSubmission('won', wrongOrder, 0)
			const result = numberPathConfig.validateAndScore(solution, puzzleData, submission)
			expect(result.valid).toBe(false)
		})

		test('rejects false loss claim with a solved path', () => {
			const submission = createSubmission('lost', FIXTURE_3X3_PATH_B, 60000)
			const result = numberPathConfig.validateAndScore(fixtureSolutionA, fixturePuzzle, submission)
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
			const result = numberPathConfig.validateAndScore(solution, puzzleData, submission)
			expect(result.valid).toBe(false)
			if (!result.valid) {
				expect(result.error).toContain('Missing path')
			}
		})

		test('time penalty calculation - odd seconds', () => {
			const submission = createSubmission('won', solution.path, 99000)
			const result = numberPathConfig.validateAndScore(solution, puzzleData, submission)
			expect(result.valid).toBe(true)
			if (result.valid) {
				expect(result.score).toBe(451)
			}
		})
	})
})
