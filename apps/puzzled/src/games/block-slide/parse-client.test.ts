import { describe, expect, test } from 'bun:test'
import cases from '../../../../../crates/puzzled-core/tests/fixtures/generate/block-slide.json'
import { parseBlockSlideClientPayload } from './parse-client'
import { isWin } from './types'

const served = (cases as Array<{ puzzleData: unknown; solution: unknown }>)[0]

describe('parseBlockSlideClientPayload', () => {
	test('accepts the GetDaily wire form (solution stripped)', () => {
		const parsed = parseBlockSlideClientPayload(served.puzzleData)
		expect(parsed).toEqual(served.puzzleData as never)
	})

	test('accepts the legacy wrapped form and drops the solution', () => {
		const parsed = parseBlockSlideClientPayload({
			puzzleData: served.puzzleData,
			solution: served.solution,
		})
		expect(parsed).toEqual(served.puzzleData as never)
		expect(JSON.stringify(parsed)).not.toContain('solution')
	})

	test('rejects a board without blocks or exit', () => {
		expect(() => parseBlockSlideClientPayload({ blocks: [] })).toThrow()
		expect(() => parseBlockSlideClientPayload(null)).toThrow()
	})
})

describe('the finish is judged by the rules', () => {
	test('the served start is not solved; the target on the exit is', () => {
		const puzzle = parseBlockSlideClientPayload(served.puzzleData)
		expect(isWin(puzzle.blocks, puzzle.exitX, puzzle.exitY)).toBe(false)
		const solved = puzzle.blocks.map((block) =>
			block.isTarget ? { ...block, x: puzzle.exitX, y: puzzle.exitY } : block,
		)
		expect(isWin(solved, puzzle.exitX, puzzle.exitY)).toBe(true)
	})
})
