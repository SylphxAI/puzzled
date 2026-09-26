import { describe, expect, test } from 'bun:test'
import cases from '../../../../../crates/puzzled-core/tests/fixtures/generate/killer-sudoku.json'
import { parseKillerSudokuClientPayload } from './parse-client'
import { isSolved, type KillerCell } from './types'

type Case = { puzzleData?: unknown; solution?: { grid: number[][] }; error?: string }
const served = (cases as Case[]).find((c) => !c.error) as Required<Omit<Case, 'error'>>

const cells = (grid: (number | null)[][]): KillerCell[][] =>
	grid.map((row) =>
		row.map((value) => ({ value, isGiven: value !== null, notes: new Set<number>() })),
	) as KillerCell[][]

describe('parseKillerSudokuClientPayload', () => {
	test('accepts the GetDaily wire form (solution stripped)', () => {
		expect(parseKillerSudokuClientPayload(served.puzzleData)).toEqual(served.puzzleData as never)
	})

	test('accepts the legacy wrapped form and drops the solution', () => {
		const parsed = parseKillerSudokuClientPayload({
			puzzleData: served.puzzleData,
			solution: served.solution,
		})
		expect(parsed).toEqual(served.puzzleData as never)
		expect(JSON.stringify(parsed)).not.toContain('solution')
	})

	test('rejects a malformed board', () => {
		expect(() => parseKillerSudokuClientPayload({ grid: [[1]], cages: [] })).toThrow()
		expect(() => parseKillerSudokuClientPayload(undefined)).toThrow()
	})
})

describe('the finish is judged by the rules', () => {
	test('the fixture solution solves the cages; the served givens do not', () => {
		const { grid, cages } = parseKillerSudokuClientPayload(served.puzzleData)
		expect(isSolved(cells(served.solution.grid), cages)).toBe(true)
		expect(isSolved(cells(grid), cages)).toBe(false)
	})
})
