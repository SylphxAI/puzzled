import { describe, expect, test } from 'bun:test'
import { parseWordBoxClientPayload } from './parse-client'

const SAFE = {
	box: {
		top: ['A', 'B', 'C'],
		right: ['D', 'E', 'F'],
		bottom: ['G', 'H', 'I'],
		left: ['J', 'K', 'L'],
	},
}

describe('parseWordBoxClientPayload', () => {
	test('accepts raw payload and rejects a leaked solution', () => {
		expect(parseWordBoxClientPayload(SAFE).box.top[0]).toBe('A')
		expect(() => parseWordBoxClientPayload({ ...SAFE, allLetters: ['A'] })).toThrow(
			'solution-bearing',
		)
	})
})
