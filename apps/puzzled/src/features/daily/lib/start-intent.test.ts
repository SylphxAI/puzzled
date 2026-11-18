import { describe, expect, test } from 'bun:test'
import { intentMatches, START_INTENT_TTL_MS } from './start-intent'

const now = 1_800_000_000_000
const record = (slug: string, at: number) => JSON.stringify({ slug, at })

describe('start intent', () => {
	test('a fresh press for the same game starts the board', () => {
		expect(intentMatches(record('word-groups', now - 2_000), 'word-groups', now)).toBe(true)
	})

	test('no record, another game, a stale or future press, or junk never starts it', () => {
		expect(intentMatches(null, 'word-groups', now)).toBe(false)
		expect(intentMatches(record('sudoku', now), 'word-groups', now)).toBe(false)
		expect(
			intentMatches(record('word-groups', now - START_INTENT_TTL_MS - 1), 'word-groups', now),
		).toBe(false)
		expect(intentMatches(record('word-groups', now + 1_000), 'word-groups', now)).toBe(false)
		expect(intentMatches('{"slug":"word-groups"}', 'word-groups', now)).toBe(false)
		expect(intentMatches('nope', 'word-groups', now)).toBe(false)
	})
})
