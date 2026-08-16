import { describe, expect, test } from 'bun:test'
import { parseCryptogramClientPayload } from './parse-client'

const SAFE = {
	encryptedText: 'XLMW MW E XIWX',
	author: 'Anon',
	category: 'quotes',
	uniqueLetters: 8,
	maxHints: 3,
}

describe('parseCryptogramClientPayload', () => {
	test('accepts raw payload and rejects a cipher', () => {
		expect(parseCryptogramClientPayload(SAFE).author).toBe('Anon')
		expect(() => parseCryptogramClientPayload({ ...SAFE, cipher: { A: 'B' } })).toThrow(
			'solution-bearing',
		)
	})
})
