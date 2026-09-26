import { describe, expect, test } from 'bun:test'
import fixtures from '../../../../../crates/puzzled-core/tests/fixtures/generate/duo.json'
import { parseTangoClientPayload } from './parse-client'
import { isSolved, type TangoCell } from './types'

type Case = {
	puzzleData: { size: number; initialGrid: ('sun' | 'moon' | null)[][] }
	solution: { grid: ('sun' | 'moon')[][] }
}
const served = (fixtures as unknown as Case[])[0] as Case

const cells = (grid: ('sun' | 'moon' | null)[][]): TangoCell[][] =>
	grid.map((row) => row.map((value) => ({ value, isGiven: false })))

describe('parseTangoClientPayload', () => {
	test('accepts the GetDaily wire form (solution stripped)', () => {
		const parsed = parseTangoClientPayload(served.puzzleData)
		expect(parsed).toEqual(served.puzzleData)
	})

	test('accepts the legacy wrapped form and drops the solution', () => {
		const parsed = parseTangoClientPayload({
			puzzleData: served.puzzleData,
			solution: served.solution,
		})
		expect(JSON.stringify(parsed)).not.toContain('solution')
		expect(parsed.initialGrid).toEqual(served.puzzleData.initialGrid)
	})

	test('rejects a grid of the wrong size', () => {
		expect(() => parseTangoClientPayload({ size: 6, initialGrid: [[null]] })).toThrow('6×6')
		expect(() => parseTangoClientPayload({ size: 5, initialGrid: [] })).toThrow('even')
	})
})

describe('the rules judge the finish', () => {
	test('the stored solution is solved', () => {
		expect(isSolved(cells(served.solution.grid))).toBe(true)
	})

	test('the served starting grid is not', () => {
		expect(isSolved(cells(served.puzzleData.initialGrid))).toBe(false)
	})
})
