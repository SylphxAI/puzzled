/**
 * Spots validation tests
 *
 * Scoring: Time-based
 * - Base: 500 points
 * - Time penalty: -1 point per 2 seconds
 * - Minimum: 100 points for a win
 */

import { describe, expect, test } from 'bun:test'
import type { GameSubmission } from '../types'
import { pipPlaceConfig } from './config'
import { FIXTURE_2X3_PUZZLE, FIXTURE_2X3_SOLUTION_A, FIXTURE_2X3_TILES_B } from './fixtures'
import type { PipPlaceTile } from './types'

const { puzzleData, solution } = pipPlaceConfig.generatePuzzle(12345)

function createSubmission(
	status: 'won' | 'lost',
	tiles: PipPlaceTile[] | undefined,
	timeSpentMs: number,
): GameSubmission {
	return {
		status,
		attempts: 1,
		timeSpentMs,
		data: tiles !== undefined ? { tiles } : {},
	}
}

describe('pip-place validateAndScore', () => {
	describe('valid solutions', () => {
		test('fast solve scores 500 points', () => {
			const submission = createSubmission('won', solution.tiles, 0)
			const result = pipPlaceConfig.validateAndScore(solution, puzzleData, submission)
			expect(result.valid).toBe(true)
			if (result.valid) {
				expect(result.status).toBe('won')
				expect(result.score).toBe(500)
			}
		})

		test('100 second solve scores 450 points', () => {
			const submission = createSubmission('won', solution.tiles, 100000)
			const result = pipPlaceConfig.validateAndScore(solution, puzzleData, submission)
			expect(result.valid).toBe(true)
			if (result.valid) {
				expect(result.status).toBe('won')
				expect(result.score).toBe(450)
			}
		})

		test('200 second solve scores 400 points', () => {
			const submission = createSubmission('won', solution.tiles, 200000)
			const result = pipPlaceConfig.validateAndScore(solution, puzzleData, submission)
			expect(result.valid).toBe(true)
			if (result.valid) {
				expect(result.status).toBe('won')
				expect(result.score).toBe(400)
			}
		})

		test('minimum score is 100 for wins', () => {
			const submission = createSubmission('won', solution.tiles, 2000000)
			const result = pipPlaceConfig.validateAndScore(solution, puzzleData, submission)
			expect(result.valid).toBe(true)
			if (result.valid) {
				expect(result.status).toBe('won')
				expect(result.score).toBe(100)
			}
		})

		test('loss scores 0 points', () => {
			const submission = createSubmission('lost', solution.tiles.slice(0, 2), 60000)
			const result = pipPlaceConfig.validateAndScore(solution, puzzleData, submission)
			expect(result.valid).toBe(true)
			if (result.valid) {
				expect(result.status).toBe('lost')
				expect(result.score).toBe(0)
			}
		})

		test('accepts an alternate tiling that satisfies the same regions', () => {
			const submission = createSubmission('won', FIXTURE_2X3_TILES_B, 0)
			const result = pipPlaceConfig.validateAndScore(
				FIXTURE_2X3_SOLUTION_A,
				FIXTURE_2X3_PUZZLE,
				submission,
			)
			expect(result.valid).toBe(true)
			if (result.valid) {
				expect(result.status).toBe('won')
				expect(result.score).toBe(500)
			}
		})
	})

	describe('invalid submissions', () => {
		test('rejects missing tiles data', () => {
			const submission = createSubmission('won', undefined, 60000)
			const result = pipPlaceConfig.validateAndScore(solution, puzzleData, submission)
			expect(result.valid).toBe(false)
			if (!result.valid) {
				expect(result.error).toBe('Missing tiles')
			}
		})

		test('rejects false win claim with incomplete tiles', () => {
			const submission = createSubmission('won', solution.tiles.slice(0, 3), 60000)
			const result = pipPlaceConfig.validateAndScore(solution, puzzleData, submission)
			expect(result.valid).toBe(false)
			if (!result.valid) {
				expect(result.error).toContain('not correctly solved')
			}
		})

		test('rejects false loss claim with a solved tiling', () => {
			const submission = createSubmission('lost', FIXTURE_2X3_TILES_B, 60000)
			const result = pipPlaceConfig.validateAndScore(
				FIXTURE_2X3_SOLUTION_A,
				FIXTURE_2X3_PUZZLE,
				submission,
			)
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
			const result = pipPlaceConfig.validateAndScore(solution, puzzleData, submission)
			expect(result.valid).toBe(false)
			if (!result.valid) {
				expect(result.error).toBe('Missing tiles')
			}
		})

		test('time penalty calculation - odd seconds', () => {
			const submission = createSubmission('won', solution.tiles, 99000)
			const result = pipPlaceConfig.validateAndScore(solution, puzzleData, submission)
			expect(result.valid).toBe(true)
			if (result.valid) {
				expect(result.score).toBe(451)
			}
		})
	})
})
