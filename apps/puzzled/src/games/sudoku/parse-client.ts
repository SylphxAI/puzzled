/**
 * Client parser for the solution-safe Sudoku payload served by Connect.
 *
 * GetDaily sends the raw `{ grid, difficulty }` puzzle structure. The
 * solution stays in Rust and is checked only by SubmitGuess.
 */

import type { SudokuPuzzleClientData } from './types'
import { GRID_SIZE } from './types'

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function parseGrid(raw: unknown): SudokuPuzzleClientData['grid'] {
	if (!Array.isArray(raw) || raw.length !== GRID_SIZE) {
		throw new Error('[sudoku] grid must be 9×9')
	}

	return raw.map((row) => {
		if (!Array.isArray(row) || row.length !== GRID_SIZE) {
			throw new Error('[sudoku] grid must be 9×9')
		}

		return row.map((cell) => {
			if (cell === null) return null
			if (typeof cell !== 'number' || !Number.isInteger(cell) || cell < 1 || cell > GRID_SIZE) {
				throw new Error('[sudoku] grid cells must be null or integers from 1 to 9')
			}
			return cell
		})
	})
}

function isDifficulty(value: unknown): value is SudokuPuzzleClientData['difficulty'] {
	return value === 'easy' || value === 'medium' || value === 'hard'
}

/** Parse only the current raw Connect payload; legacy wrapped data is rejected. */
export function parseSudokuClientPayload(data: unknown): SudokuPuzzleClientData {
	if (!isRecord(data)) {
		throw new Error('[sudoku] invalid puzzle payload')
	}

	if ('puzzleData' in data || 'solution' in data || 'solutionJson' in data) {
		throw new Error('[sudoku] solution-bearing puzzle payload is not client-safe')
	}

	if (!isDifficulty(data.difficulty)) {
		throw new Error('[sudoku] missing or invalid difficulty')
	}

	return {
		grid: parseGrid(data.grid),
		difficulty: data.difficulty,
	}
}
