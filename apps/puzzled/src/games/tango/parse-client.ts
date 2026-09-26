/**
 * Client parser for GetDaily duo (tango) payloads.
 *
 * The server serves `{ size, initialGrid }` with the solution stripped. The
 * legacy wrapped `{ puzzleData, solution }` shape is accepted and its solution
 * dropped: the puzzle has exactly one solution, so the rules judge the finish
 * (`isSolved`), and the server still validates the submission.
 */

import type { CellValue, TangoPuzzleData } from './types'

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function cell(value: unknown): CellValue {
	return value === 'sun' || value === 'moon' ? value : null
}

export function parseTangoClientPayload(data: unknown): TangoPuzzleData {
	if (!isRecord(data)) throw new Error('[duo] invalid puzzle payload')
	const inner = isRecord(data.puzzleData) ? data.puzzleData : data
	const size = inner.size
	if (typeof size !== 'number' || !Number.isInteger(size) || size < 2 || size % 2 !== 0) {
		throw new Error('[duo] size must be an even number')
	}
	const rows = inner.initialGrid
	if (!Array.isArray(rows) || rows.length !== size) {
		throw new Error(`[duo] initialGrid must be ${size}×${size}`)
	}
	const initialGrid = rows.map((row) => {
		if (!Array.isArray(row) || row.length !== size) {
			throw new Error(`[duo] initialGrid must be ${size}×${size}`)
		}
		return row.map(cell)
	})
	return { size, initialGrid }
}
