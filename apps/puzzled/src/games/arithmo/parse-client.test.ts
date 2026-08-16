import { describe, expect, test } from 'bun:test'
import { parseArithmoClientPayload } from './parse-client'
import type { ArithmoPuzzleClientData } from './types'

const SAFE_PAYLOAD: ArithmoPuzzleClientData = {
	length: 8,
}

describe('parseArithmoClientPayload', () => {
	test('accepts the raw solution-safe GetDaily payload', () => {
		expect(parseArithmoClientPayload(SAFE_PAYLOAD)).toEqual(SAFE_PAYLOAD)
	})

	test('rejects wrapped or solution-bearing payloads', () => {
		expect(() =>
			parseArithmoClientPayload({
				puzzleData: SAFE_PAYLOAD,
				solution: { equation: '12+34=46' },
			}),
		).toThrow('solution-bearing')
		expect(() => parseArithmoClientPayload({ ...SAFE_PAYLOAD, equation: '12+34=46' })).toThrow(
			'solution-bearing',
		)
	})

	test('rejects malformed length', () => {
		expect(() => parseArithmoClientPayload({ length: 7 })).toThrow('length')
	})
})
