import { describe, expect, test } from 'bun:test'
import cases from '../../../../../crates/puzzled-core/tests/fixtures/generate/number-path.json'
import { parseNumberPathClientPayload } from './parse-client'
import { type Cell, isSolved } from './types'

const served = (cases as Array<{ puzzleData: unknown; solution: { path: Cell[] } }>)[0]

describe('parseNumberPathClientPayload', () => {
	test('accepts the GetDaily wire form (solution stripped)', () => {
		expect(parseNumberPathClientPayload(served.puzzleData)).toEqual(served.puzzleData as never)
	})

	test('accepts the legacy wrapped form and drops the solution', () => {
		const parsed = parseNumberPathClientPayload({
			puzzleData: served.puzzleData,
			solution: served.solution,
		})
		expect(parsed).toEqual(served.puzzleData as never)
		expect(JSON.stringify(parsed)).not.toContain('path')
	})

	test('rejects a malformed board', () => {
		expect(() => parseNumberPathClientPayload({ size: 3, clues: [[1]] })).toThrow()
		expect(() => parseNumberPathClientPayload('x')).toThrow()
	})
})

describe('the finish is judged by the rules', () => {
	test('the fixture path solves the served clues; a partial path does not', () => {
		const { clues } = parseNumberPathClientPayload(served.puzzleData)
		expect(isSolved(served.solution.path, clues)).toBe(true)
		expect(isSolved(served.solution.path.slice(0, 5), clues)).toBe(false)
	})
})
