import { describe, expect, test } from 'bun:test'
import { parseWordSearchClientPayload } from './parse-client'

const grid = Array.from({ length: 10 }, () => Array.from({ length: 10 }, () => 'A'))
const SAFE = { grid, theme: 'nature', wordCount: 1, words: ['TREE'] }

describe('parseWordSearchClientPayload', () => {
	test('accepts a raw word list and rejects placements', () => {
		expect(parseWordSearchClientPayload(SAFE).words).toEqual(['TREE'])
		expect(() => parseWordSearchClientPayload({ ...SAFE, placements: [] })).toThrow(
			'solution-bearing',
		)
	})
})
