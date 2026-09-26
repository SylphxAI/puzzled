import { describe, expect, test } from 'bun:test'
import fixtures from '../../../../../crates/puzzled-core/tests/fixtures/generate/nonogram.json'
import { parseNonogramClientPayload } from './parse-client'
import {
	type CellState,
	isGridClueComplete,
	isRowClueMet,
	lineRuns,
	type NonogramPuzzleData,
} from './types'

type Case = { puzzleData: NonogramPuzzleData; solution: { grid: boolean[][] } }
const cases = fixtures as unknown as Case[]
const served = cases[0] as Case

const toCells = (grid: boolean[][]): CellState[][] =>
	grid.map((row) => row.map((filled) => (filled ? 'filled' : 'empty')))

describe('parseNonogramClientPayload', () => {
	test('accepts the GetDaily wire form (solution stripped)', () => {
		expect(parseNonogramClientPayload(served.puzzleData)).toEqual(served.puzzleData)
	})

	test('accepts the legacy wrapped form and drops the solution', () => {
		const parsed = parseNonogramClientPayload({
			puzzleData: served.puzzleData,
			solution: served.solution,
		})
		expect(JSON.stringify(parsed)).not.toContain('grid')
		expect(parsed.rowClues).toEqual(served.puzzleData.rowClues)
	})

	test('rejects clues that do not fit the size', () => {
		expect(() => parseNonogramClientPayload({ ...served.puzzleData, rowClues: [[1]] })).toThrow(
			'rowClues',
		)
	})
})

describe('the clues judge the finish', () => {
	test('every stored solution meets all its clues', () => {
		for (const c of cases) {
			expect(isGridClueComplete(toCells(c.solution.grid), c.puzzleData)).toBe(true)
		}
	})

	test('an empty grid, or one cell short, is not finished', () => {
		const empty = toCells(served.solution.grid.map((row) => row.map(() => false)))
		expect(isGridClueComplete(empty, served.puzzleData)).toBe(false)
		const short = served.solution.grid.map((row) => [...row])
		const row = short.findIndex((r) => r.some(Boolean))
		const col = (short[row] as boolean[]).indexOf(true)
		;(short[row] as boolean[])[col] = false
		const cells = toCells(short)
		expect(isGridClueComplete(cells, served.puzzleData)).toBe(false)
		expect(isRowClueMet(cells, served.puzzleData, row)).toBe(false)
	})

	test('line runs read like clues', () => {
		expect(lineRuns([true, true, false, true])).toEqual([2, 1])
		expect(lineRuns([false, false])).toEqual([0])
	})
})
