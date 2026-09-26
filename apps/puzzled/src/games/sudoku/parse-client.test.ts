import { describe, expect, test } from 'bun:test'
import { sudokuConfig } from './config'
import { parseSudokuClientPayload } from './parse-client'
import { isGridSolved, type SudokuCell } from './types'

const { puzzleData, solution } = sudokuConfig.generatePuzzle(4242, 'easy') as {
	puzzleData: { grid: (number | null)[][]; difficulty: 'easy' }
	solution: { grid: number[][] }
}

const cells = (grid: (number | null)[][]): SudokuCell[][] =>
	grid.map((row) => row.map((value) => ({ value, isGiven: false, notes: new Set<number>() })))

describe('parseSudokuClientPayload', () => {
	test('accepts the GetDaily wire form (solution stripped)', () => {
		const parsed = parseSudokuClientPayload({ difficulty: 'easy', grid: puzzleData.grid })
		expect(parsed.difficulty).toBe('easy')
		expect(parsed.grid).toEqual(puzzleData.grid)
	})

	test('accepts the legacy wrapped form and drops the solution', () => {
		const parsed = parseSudokuClientPayload({ puzzleData, solution })
		expect(JSON.stringify(parsed)).not.toContain('solution')
		expect(parsed.grid).toEqual(puzzleData.grid)
	})

	test('rejects a grid that is not 9×9', () => {
		expect(() => parseSudokuClientPayload({ grid: [[1, 2]] })).toThrow('9×9')
	})
})

describe('isGridSolved', () => {
	test('the generated solution is solved', () => {
		expect(isGridSolved(cells(solution.grid))).toBe(true)
	})

	test('an unfinished grid is not solved', () => {
		expect(isGridSolved(cells(puzzleData.grid))).toBe(false)
	})

	test('a full grid that breaks a rule is not solved', () => {
		const broken = solution.grid.map((row) => [...row])
		const [a, b] = [broken[0][0], broken[0][1]]
		broken[0][0] = b
		broken[0][1] = a
		expect(isGridSolved(cells(broken))).toBe(false)
	})
})
