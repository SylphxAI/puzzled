/**
 * Client parser for the solution-safe Cage Sudoku payload served by Connect.
 *
 * GetDaily sends `{ grid, cages }`. The completed grid stays in Rust and is
 * checked only by SubmitGuess.
 */

import type { Cage, KillerSudokuPuzzleClientData } from './types'

const GRID_SIZE = 9

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function parseGrid(raw: unknown): (number | null)[][] {
	if (!Array.isArray(raw) || raw.length !== GRID_SIZE) {
		throw new Error('[killer-sudoku] grid must be 9×9')
	}
	return raw.map((row) => {
		if (!Array.isArray(row) || row.length !== GRID_SIZE) {
			throw new Error('[killer-sudoku] grid must be 9×9')
		}
		return row.map((cell) => {
			if (cell === null) return null
			if (typeof cell !== 'number' || !Number.isInteger(cell) || cell < 1 || cell > 9) {
				throw new Error('[killer-sudoku] grid cells must be null or integers from 1 to 9')
			}
			return cell
		})
	})
}

function parseCage(raw: unknown): Cage {
	if (!isRecord(raw) || typeof raw.sum !== 'number' || !Number.isInteger(raw.sum) || raw.sum <= 0) {
		throw new Error('[killer-sudoku] invalid cage')
	}
	if (!Array.isArray(raw.cells) || raw.cells.length === 0) {
		throw new Error('[killer-sudoku] cage cells required')
	}
	const cells = raw.cells.map((cell) => {
		if (!Array.isArray(cell) || cell.length !== 2) {
			throw new Error('[killer-sudoku] cage cells must be [row, col]')
		}
		const [row, col] = cell
		if (
			typeof row !== 'number' ||
			typeof col !== 'number' ||
			!Number.isInteger(row) ||
			!Number.isInteger(col) ||
			row < 0 ||
			col < 0 ||
			row >= GRID_SIZE ||
			col >= GRID_SIZE
		) {
			throw new Error('[killer-sudoku] cage cell out of range')
		}
		return [row, col] as [number, number]
	})
	return { cells, sum: raw.sum }
}

/** Parse only the current raw Connect payload; legacy wrapped data is rejected. */
export function parseKillerSudokuClientPayload(data: unknown): KillerSudokuPuzzleClientData {
	if (!isRecord(data)) {
		throw new Error('[killer-sudoku] invalid puzzle payload')
	}
	if ('puzzleData' in data || 'solution' in data || 'solutionJson' in data) {
		throw new Error('[killer-sudoku] solution-bearing puzzle payload is not client-safe')
	}
	if (!Array.isArray(data.cages) || data.cages.length === 0) {
		throw new Error('[killer-sudoku] cages required')
	}
	return {
		grid: parseGrid(data.grid),
		cages: data.cages.map(parseCage),
	}
}
