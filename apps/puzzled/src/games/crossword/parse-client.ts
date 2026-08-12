/**
 * Client parser for GetDaily crossword payloads.
 *
 * After leak-strip, the wire form is `{ grid, clues }` — not
 * `{ puzzleData, solution }`. Solution comparison is forbidden here.
 */

import type { CrosswordClue, CrosswordPuzzleClientData } from './types'
import { GRID_SIZE } from './types'

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function stripClue(raw: unknown): CrosswordClue | null {
	if (!isRecord(raw)) return null
	const number = Number(raw.number)
	const row = Number(raw.row)
	const col = Number(raw.col)
	const length = Number(raw.length)
	const clue = typeof raw.clue === 'string' ? raw.clue : ''
	if (!Number.isFinite(number) || !Number.isFinite(row) || !Number.isFinite(col)) {
		return null
	}
	if (!Number.isFinite(length) || length <= 0 || !clue) {
		return null
	}
	return { number, clue, row, col, length }
}

function parseClueList(raw: unknown): CrosswordClue[] {
	if (!Array.isArray(raw)) return []
	const out: CrosswordClue[] = []
	for (const item of raw) {
		const clue = stripClue(item)
		if (clue) out.push(clue)
	}
	return out
}

function parseGrid(raw: unknown): (string | null)[][] {
	if (!Array.isArray(raw)) {
		throw new Error('[crossword] missing grid')
	}
	const grid: (string | null)[][] = []
	for (const row of raw) {
		if (!Array.isArray(row)) {
			throw new Error('[crossword] invalid grid row')
		}
		grid.push(row.map((cell) => (cell === null ? null : '')))
	}
	if (grid.length !== GRID_SIZE || grid.some((row) => row.length !== GRID_SIZE)) {
		throw new Error('[crossword] grid must be 5×5')
	}
	return grid
}

/**
 * Accept live GetDaily `{grid,clues}` or the legacy wrapped shape.
 * Never returns or requires a solution. Clue `answer` keys are dropped.
 */
export function parseCrosswordClientPayload(data: unknown): CrosswordPuzzleClientData {
	if (!isRecord(data)) {
		throw new Error('[crossword] invalid puzzle payload')
	}
	const inner = isRecord(data.puzzleData) ? data.puzzleData : data
	if (!isRecord(inner)) {
		throw new Error('[crossword] invalid puzzle payload')
	}
	const cluesRaw = isRecord(inner.clues) ? inner.clues : null
	if (!cluesRaw) {
		throw new Error('[crossword] missing clues')
	}
	return {
		grid: parseGrid(inner.grid),
		clues: {
			across: parseClueList(cluesRaw.across),
			down: parseClueList(cluesRaw.down),
		},
	}
}
