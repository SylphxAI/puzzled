/**
 * Client parser for GetDaily killer-sudoku payloads.
 *
 * The server serves `{ grid, cages }` with the solution stripped. The legacy
 * wrapped `{ puzzleData, solution }` shape is accepted and its solution
 * dropped: the browser judges the finish by the rules (`isSolved`). The daily
 * pipeline proves every puzzle has exactly one solution, so the rules and
 * the server's stored grid agree, and the server validates the submission.
 */

import type { Cage, KillerSudokuPuzzleData } from './types'

const SIZE = 9

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

const inGrid = (n: unknown): n is number =>
	typeof n === 'number' && Number.isInteger(n) && n >= 0 && n < SIZE

function parseCage(value: unknown): Cage {
	if (!isRecord(value) || !Array.isArray(value.cells) || typeof value.sum !== 'number') {
		throw new Error('[killer-sudoku] invalid cage')
	}
	const cells = value.cells.map((cell): [number, number] => {
		if (!Array.isArray(cell) || !inGrid(cell[0]) || !inGrid(cell[1])) {
			throw new Error('[killer-sudoku] invalid cage cell')
		}
		return [cell[0], cell[1]]
	})
	if (cells.length === 0) throw new Error('[killer-sudoku] empty cage')
	return { cells, sum: value.sum }
}

export function parseKillerSudokuClientPayload(data: unknown): KillerSudokuPuzzleData {
	if (!isRecord(data)) throw new Error('[killer-sudoku] invalid puzzle payload')
	const inner = isRecord(data.puzzleData) ? data.puzzleData : data
	const { grid, cages } = inner
	if (!Array.isArray(grid) || grid.length !== SIZE) {
		throw new Error('[killer-sudoku] grid must be 9×9')
	}
	const givens = grid.map((row) => {
		if (!Array.isArray(row) || row.length !== SIZE) {
			throw new Error('[killer-sudoku] grid must be 9×9')
		}
		return row.map((cell) =>
			typeof cell === 'number' && Number.isInteger(cell) && cell >= 1 && cell <= 9 ? cell : null,
		)
	})
	if (!Array.isArray(cages) || cages.length === 0) {
		throw new Error('[killer-sudoku] cages missing')
	}
	return { grid: givens, cages: cages.map(parseCage) }
}
