import { describe, expect, test } from 'bun:test'
import { gameSupportsDifficulty } from '@/games/registry'
import {
	completedViewLevel,
	deriveDifficultyCompletionStatus,
	finishedDailyLevel,
} from './difficulty-completion'

describe('difficulty completion status', () => {
	test('projects server-verified completion marks', () => {
		const derived = deriveDifficultyCompletionStatus({
			easy: { hasCompleted: true },
			medium: { hasCompleted: false },
			hard: { hasCompleted: false },
		})

		expect(derived.status).toEqual({ easy: true, medium: false, hard: false })
		expect(derived.verified).toBe(true)
	})

	test('an unverifiable read stays unknown instead of not-completed', () => {
		const derived = deriveDifficultyCompletionStatus({ easy: null, medium: null, hard: null })

		expect(derived.status).toEqual({ easy: null, medium: null, hard: null })
		expect(derived.verified).toBe(false)
	})

	test('one unknown level does not fake the other levels', () => {
		const derived = deriveDifficultyCompletionStatus({
			easy: { hasCompleted: true },
			medium: null,
			hard: { hasCompleted: false },
		})

		expect(derived.status).toEqual({ easy: true, medium: null, hard: false })
		expect(derived.verified).toBe(false)
		// The unverified level is presented as unknown, not as a verified "not completed".
		expect(derived.status.medium).toBeNull()
	})
})

describe('finished daily level', () => {
	const done = (difficulty: string | null, attempts = 1) => ({
		completedSession: { attempts, difficulty },
		puzzleDate: '2026-10-01',
	})
	const open = { completedSession: null, puzzleDate: '2026-10-01' }

	test('three reads carrying one medium finish show Medium, never Hard', () => {
		const shown = finishedDailyLevel({
			easy: done('medium'),
			medium: done('medium'),
			hard: done('medium'),
		})
		expect(shown).toEqual({
			difficulty: 'medium',
			session: { attempts: 1, difficulty: 'medium' },
			puzzleDate: '2026-10-01',
		})
	})
	test('one proving read is enough; open and unverified reads do not hide it', () => {
		expect(
			finishedDailyLevel({ easy: open, medium: null, hard: done('hard', 3) })?.difficulty,
		).toBe('hard')
	})
	test('no finish or an unknown level yields no finish or no level', () => {
		expect(finishedDailyLevel({ easy: open, medium: null, hard: open })).toBeNull()
		expect(
			finishedDailyLevel({ easy: done(null), medium: open, hard: open })?.difficulty,
		).toBeUndefined()
		expect(
			finishedDailyLevel({ easy: done('bogus'), medium: open, hard: open })?.difficulty,
		).toBeUndefined()
	})
})

describe('completed view level', () => {
	test('crossword (no levels) with a stored medium shows no level', () => {
		expect(completedViewLevel(gameSupportsDifficulty('crossword'), 'medium')).toBeUndefined()
	})
	test('sudoku with a stored medium shows Medium; its real level is kept', () => {
		expect(completedViewLevel(gameSupportsDifficulty('sudoku'), 'medium')).toBe('medium')
		expect(completedViewLevel(gameSupportsDifficulty('sudoku'), 'hard')).toBe('hard')
	})
	test('a level game with an absent or unknown level shows none', () => {
		expect(completedViewLevel(true, null)).toBeUndefined()
		expect(completedViewLevel(true, 'bogus')).toBeUndefined()
	})
})
