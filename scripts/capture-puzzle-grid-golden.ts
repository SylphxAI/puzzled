/**
 * Capture frozen TS puzzle-grid baselines into fixtures/puzzle-grid/golden.json.
 *
 * Run: bun scripts/capture-puzzle-grid-golden.ts
 */
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { generateSudokuPuzzle } from '../apps/puzzled/src/games/sudoku/generator'
import { seededRandom, shuffleArray } from '../apps/puzzled/src/games/shared/random'

const repoRoot = join(import.meta.dir, '..')
const outPath = join(repoRoot, 'fixtures/puzzle-grid/golden.json')

function collectRandom(seed: number, count: number): number[] {
	const rng = seededRandom(seed)
	return Array.from({ length: count }, () => rng())
}

const golden = {
	schemaVersion: 1,
	source:
		'apps/puzzled/src/games/shared/random.ts + sudoku/generator.ts (ADR-168 S2 puzzle-grid)',
	capturedAt: new Date().toISOString().slice(0, 10),
	randomCases: [
		{
			id: 'lcg-seed-0-first-5',
			seed: 0,
			values: collectRandom(0, 5),
		},
		{
			id: 'lcg-seed-42-first-5',
			seed: 42,
			values: collectRandom(42, 5),
		},
		{
			id: 'lcg-seed-999-first-5',
			seed: 999,
			values: collectRandom(999, 5),
		},
		{
			id: 'shuffle-letters-seed-12345',
			seed: 12345,
			input: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''),
			output: shuffleArray('ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''), seededRandom(12345)),
		},
		{
			id: 'shuffle-words-seed-20240115',
			seed: 20240115,
			input: ['apple', 'banana', 'cherry', 'date', 'elderberry'],
			output: shuffleArray(
				['apple', 'banana', 'cherry', 'date', 'elderberry'],
				seededRandom(20240115),
			),
		},
	],
	sudokuCases: [
		{
			id: 'seed-42-medium',
			seed: 42,
			difficulty: 'medium',
			...generateSudokuPuzzle(42, 'medium'),
		},
		{
			id: 'seed-12345-medium',
			seed: 12345,
			difficulty: 'medium',
			...generateSudokuPuzzle(12345, 'medium'),
		},
		{
			id: 'seed-20240115-easy',
			seed: 20240115,
			difficulty: 'easy',
			...generateSudokuPuzzle(20240115, 'easy'),
		},
	],
	httpCases: [
		{
			id: 'sudoku-seed-42-medium',
			path: '/api/v1/puzzles/grid',
			query: 'gameSlug=sudoku&seed=42&difficulty=medium',
			httpStatus: 200,
			body: {
				gameSlug: 'sudoku',
				seed: 42,
				...generateSudokuPuzzle(42, 'medium'),
				slice: 'S2-puzzle-grid',
			},
		},
		{
			id: 'unsupported-game',
			path: '/api/v1/puzzles/grid',
			query: 'gameSlug=wordle&seed=1',
			httpStatus: 400,
			body: {
				error: 'unsupported gameSlug',
				supported: ['sudoku'],
				slice: 'S2-puzzle-grid',
			},
		},
	],
}

writeFileSync(outPath, `${JSON.stringify(golden, null, 2)}\n`)
console.log(`wrote ${outPath}`)