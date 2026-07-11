/**
 * Golden fixture parity: TS puzzle grid generators vs frozen corpus.
 */
import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { seededRandom } from '../src/games/shared/random'
import { generateSudokuPuzzle } from '../src/games/sudoku/generator'

type RandomCase = {
	id: string
	seed: number
	values?: number[]
	input?: unknown
	output?: unknown
}

type SudokuCase = {
	id: string
	seed: number
	difficulty: 'easy' | 'medium' | 'hard'
	puzzleData?: unknown
	solution?: unknown
}

type GoldenFile = {
	schemaVersion: number
	randomCases: RandomCase[]
	sudokuCases: SudokuCase[]
}

const goldenPath = join(import.meta.dir, '../../../fixtures/puzzle-grid/golden.json')

function loadGolden(): GoldenFile {
	const raw = readFileSync(goldenPath, 'utf8')
	return JSON.parse(raw) as GoldenFile
}

describe('puzzle-grid golden parity baseline', () => {
	const golden = loadGolden()

	test('schema is version 1', () => {
		expect(golden.schemaVersion).toBe(1)
	})

	for (const randomCase of golden.randomCases) {
		test(`random ${randomCase.id}`, () => {
			if (!randomCase.values) return
			const rng = seededRandom(randomCase.seed)
			for (const expected of randomCase.values) {
				expect(rng()).toBe(expected)
			}
		})
	}

	for (const sudokuCase of golden.sudokuCases) {
		test(`sudoku ${sudokuCase.id}`, () => {
			const actual = generateSudokuPuzzle(sudokuCase.seed, sudokuCase.difficulty)
			const replay = generateSudokuPuzzle(sudokuCase.seed, sudokuCase.difficulty)
			expect(actual).toEqual(replay)

			if (sudokuCase.puzzleData != null && sudokuCase.solution != null) {
				expect(actual.puzzleData).toEqual(sudokuCase.puzzleData as typeof actual.puzzleData)
				expect(actual.solution).toEqual(sudokuCase.solution as typeof actual.solution)
			}
		})
	}
})
