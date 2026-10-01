import { describe, expect, test } from 'bun:test'
import { deriveDifficultyCompletionStatus, finishedLevelToShow } from './difficulty-completion'

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

describe('finished level to show', () => {
	const done = (attempts: number) => ({
		completedSession: { attempts },
		puzzleDate: '2026-10-01',
	})
	const open = { completedSession: null, puzzleDate: '2026-10-01' }

	test('shows the hardest finish once all three levels are done', () => {
		const shown = finishedLevelToShow({ easy: done(1), medium: done(2), hard: done(3) })
		expect(shown).toEqual({
			difficulty: 'hard',
			session: { attempts: 3 },
			puzzleDate: '2026-10-01',
		})
	})
	test('keeps the checklist while a level is open or unverified', () => {
		expect(finishedLevelToShow({ easy: done(1), medium: open, hard: done(3) })).toBeNull()
		expect(finishedLevelToShow({ easy: done(1), medium: null, hard: done(3) })).toBeNull()
	})
})
