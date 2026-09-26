import { describe, expect, test } from 'bun:test'
import { parseWordBoxClientPayload } from './parse-client'
import type { LetterBox } from './types'

const box: LetterBox = {
	top: ['N', 'R', 'F'],
	right: ['B', 'O', 'G'],
	bottom: ['C', 'U', 'M'],
	left: ['A', 'L', 'H'],
}

describe('parseWordBoxClientPayload', () => {
	test('accepts the GetDaily wire form (solution stripped)', () => {
		expect(parseWordBoxClientPayload({ box })).toEqual({ box })
	})

	test('accepts the legacy wrapped form and drops the example solution', () => {
		const parsed = parseWordBoxClientPayload({
			puzzleData: { box },
			solution: { words: ['MACROFAUNA'], allLetters: [] },
		})
		expect(JSON.stringify(parsed)).not.toContain('MACROFAUNA')
		expect(parsed).toEqual({ box })
	})

	test('rejects a malformed box', () => {
		expect(() =>
			parseWordBoxClientPayload({
				box: { ...box, top: ['N', 'R'] as unknown as LetterBox['top'] },
			}),
		).toThrow('three letters')
		expect(() => parseWordBoxClientPayload({})).toThrow('box is required')
	})
})
