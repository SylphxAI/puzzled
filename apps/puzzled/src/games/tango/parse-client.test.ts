import { describe, expect, test } from 'bun:test'
import { parseDuoClientPayload } from './parse-client'
import type { TangoPuzzleClientData } from './types'

const SAFE_PAYLOAD: TangoPuzzleClientData = {
	size: 6,
	initialGrid: [
		['sun', null, null, 'moon', null, null],
		[null, null, 'sun', null, null, 'moon'],
		[null, 'moon', null, null, 'sun', null],
		['moon', null, null, 'sun', null, null],
		[null, null, 'moon', null, null, 'sun'],
		[null, 'sun', null, null, 'moon', null],
	],
}

describe('parseDuoClientPayload', () => {
	test('accepts the raw solution-safe GetDaily payload', () => {
		expect(parseDuoClientPayload(SAFE_PAYLOAD)).toEqual(SAFE_PAYLOAD)
	})

	test('rejects wrapped or solution-bearing payloads', () => {
		expect(() =>
			parseDuoClientPayload({
				puzzleData: SAFE_PAYLOAD,
				solution: { grid: [] },
			}),
		).toThrow('solution-bearing')
	})

	test('rejects malformed size and cells', () => {
		expect(() => parseDuoClientPayload({ ...SAFE_PAYLOAD, size: 5 })).toThrow('even integer')
		expect(() => parseDuoClientPayload({ ...SAFE_PAYLOAD, initialGrid: [] })).toThrow('6×6')
	})
})
