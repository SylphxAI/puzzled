import { describe, expect, test } from 'bun:test'
import { deriveDifficultyCompletionStatus } from './difficulty-completion'

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
