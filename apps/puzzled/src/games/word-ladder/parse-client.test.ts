import { describe, expect, test } from 'bun:test'
import { parseWordLadderClientPayload } from './parse-client'

const SAFE = { startWord: 'cold', endWord: 'warm', wordLength: 4, minSteps: 4 }

describe('parseWordLadderClientPayload', () => {
	test('accepts raw payload and rejects a leaked path', () => {
		expect(parseWordLadderClientPayload(SAFE).endWord).toBe('warm')
		expect(() => parseWordLadderClientPayload({ ...SAFE, path: ['cold', 'cord'] })).toThrow(
			'solution-bearing',
		)
	})
})
