/**
 * Client parser for GetDaily sudoku payloads.
 *
 * The server serves `{ grid, difficulty }` with the solution stripped. The
 * legacy wrapped `{ puzzleData, solution }` shape is accepted, and its
 * solution is dropped: the browser judges the finish by the rules.
 */

import type { SudokuPuzzleClientData } from './types'
import { GRID_SIZE } from './types'

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

const DIFFICULTIES = ['easy', 'medium', 'hard'] as const

export function parseSudokuClientPayload(data: unknown): SudokuPuzzleClientData {
	if (!isRecord(data)) throw new Error('[sudoku] invalid puzzle payload')
	const inner = isRecord(data.puzzleData) ? data.puzzleData : data
	const rawGrid = inner.grid
	if (!Array.isArray(rawGrid) || rawGrid.length !== GRID_SIZE) {
		throw new Error('[sudoku] grid must be 9×9')
	}
	const grid = rawGrid.map((row) => {
		if (!Array.isArray(row) || row.length !== GRID_SIZE)
			throw new Error('[sudoku] grid must be 9×9')
		return row.map((cell) =>
			typeof cell === 'number' && Number.isInteger(cell) && cell >= 1 && cell <= 9 ? cell : null,
		)
	})
	const difficulty = DIFFICULTIES.find((level) => level === inner.difficulty) ?? 'medium'
	return { grid, difficulty }
}
