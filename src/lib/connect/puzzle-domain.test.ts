import { describe, expect, test } from 'bun:test'
import {
	encodeSubmissionJson,
	validateGetDailyInput,
	validateGetPuzzleInput,
	validateSubmitGuessInput,
} from './puzzle-domain'

describe('puzzle domain pure (puzzled.v1.PuzzleService)', () => {
	test('GetPuzzle requires slug + seed', () => {
		expect(validateGetPuzzleInput({ gameSlug: '', seed: 1 })).toBe('game_slug_required')
		expect(validateGetPuzzleInput({ gameSlug: 'sudoku', seed: Number.NaN })).toBe('seed_required')
		expect(validateGetPuzzleInput({ gameSlug: 'sudoku', seed: 42 })).toBeNull()
	})

	test('GetDaily requires slug', () => {
		expect(validateGetDailyInput({ gameSlug: '  ' })).toBe('game_slug_required')
		expect(validateGetDailyInput({ gameSlug: 'wordle' })).toBeNull()
	})

	test('SubmitGuess validates status', () => {
		expect(
			validateSubmitGuessInput({
				gameSlug: 'sudoku',
				seed: 1,
				status: 'won',
				attempts: 1,
				timeSpentMs: 10,
			}),
		).toBeNull()
		expect(
			// @ts-expect-error intentional bad status
			validateSubmitGuessInput({
				gameSlug: 'sudoku',
				seed: 1,
				status: 'abandoned',
				attempts: 1,
				timeSpentMs: 10,
			}),
		).toBe('status_required_won_or_lost')
	})

	test('encodeSubmissionJson', () => {
		expect(
			encodeSubmissionJson({
				gameSlug: 'sudoku',
				seed: 1,
				status: 'won',
				attempts: 1,
				timeSpentMs: 1,
				submission: { finalGrid: [[1]] },
			}),
		).toContain('finalGrid')
		expect(
			encodeSubmissionJson({
				gameSlug: 'sudoku',
				seed: 1,
				status: 'won',
				attempts: 1,
				timeSpentMs: 1,
				submissionJson: '{"a":1}',
			}),
		).toBe('{"a":1}')
	})
})
