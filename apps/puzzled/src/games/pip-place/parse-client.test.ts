import { describe, expect, test } from 'bun:test'
import { parsePuzzleDataClient } from '@/games/types'
import { FIXTURE_2X3_PUZZLE, FIXTURE_2X3_SOLUTION_A, FIXTURE_2X3_TILES_A } from './fixtures'
import { parsePipPlaceClientPayload } from './parse-client'

/** Live GetDaily inner JSON (solution already stripped). */
const LIVE_GETDAILY = FIXTURE_2X3_PUZZLE

describe('parsePipPlaceClientPayload', () => {
	test('accepts leak-stripped GetDaily JSON', () => {
		const parsed = parsePipPlaceClientPayload(LIVE_GETDAILY)
		expect(parsed).toEqual(FIXTURE_2X3_PUZZLE)
		expect('tiles' in parsed).toBe(false)
		expect('solution' in parsed).toBe(false)
		expect('puzzleData' in parsed).toBe(false)
		expect(JSON.stringify(parsed).includes('"tiles"')).toBe(false)
		expect(JSON.stringify(parsed).includes('"solution"')).toBe(false)
	})

	test('drops leaked solution and tiles from a stored row', () => {
		const leaked = {
			...LIVE_GETDAILY,
			tiles: FIXTURE_2X3_TILES_A,
			solution: FIXTURE_2X3_SOLUTION_A,
		}
		const parsed = parsePipPlaceClientPayload(leaked)
		expect(parsed).toEqual(FIXTURE_2X3_PUZZLE)
		expect(JSON.stringify(parsed)).not.toContain('tiles')
		expect(JSON.stringify(parsed)).not.toContain('solution')
		expect(JSON.stringify(parsed)).not.toContain('"pa"')
	})

	test('accepts legacy wrapped {puzzleData, solution} without exposing solution', () => {
		const parsed = parsePipPlaceClientPayload({
			puzzleData: LIVE_GETDAILY,
			solution: FIXTURE_2X3_SOLUTION_A,
			tiles: FIXTURE_2X3_TILES_A,
		})
		expect(parsed).toEqual(FIXTURE_2X3_PUZZLE)
		expect(JSON.stringify(parsed)).not.toContain('tiles')
		expect(JSON.stringify(parsed)).not.toContain('solution')
		expect(JSON.stringify(parsed)).not.toContain('"pa"')
	})

	test('legacy global parser still throws on GetDaily wire form', () => {
		expect(() => parsePuzzleDataClient(LIVE_GETDAILY)).toThrow('Invalid puzzle data format')
	})
})
