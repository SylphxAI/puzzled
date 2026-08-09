import { describe, expect, test } from 'bun:test'
import {
	encodeSubmissionJson,
	resolveSubmitGuessSeed,
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
			validateSubmitGuessInput({
				gameSlug: 'sudoku',
				seed: 1,
				status: 'abandoned' as 'won' | 'lost',
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

	test('resolveSubmitGuessSeed prefers explicit seed then puzzleNumber then numeric id', () => {
		expect(resolveSubmitGuessSeed({ seed: 42, puzzleId: '99', puzzleNumber: 7 })).toBe(42)
		expect(resolveSubmitGuessSeed({ puzzleNumber: 11, puzzleId: 'abc' })).toBe(11)
		expect(resolveSubmitGuessSeed({ puzzleId: '12345' })).toBe(12345)
		expect(resolveSubmitGuessSeed({ puzzleId: '' })).toBeNull()
		const hashed = resolveSubmitGuessSeed({ puzzleId: 'opaque-uuid-v4' })
		expect(hashed).not.toBeNull()
		expect(Number.isFinite(hashed!)).toBe(true)
		expect(resolveSubmitGuessSeed({ puzzleId: 'opaque-uuid-v4' })).toBe(hashed)
	})
})
