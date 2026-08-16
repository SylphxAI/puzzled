/**
 * Client parser for the solution-safe Duo payload served by Connect.
 *
 * GetDaily sends `{ size, initialGrid }`. The completed grid stays in Rust
 * and is checked only by SubmitGuess.
 */

import type { CellValue, TangoPuzzleClientData } from './types'

const MIN_SIZE = 4
const MAX_SIZE = 10

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function parseCell(value: unknown): CellValue {
	if (value === null) return null
	if (value === 'sun' || value === 'moon') return value
	throw new Error('[duo] grid cells must be sun, moon, or null')
}

/** Parse only the current raw Connect payload; legacy wrapped data is rejected. */
export function parseDuoClientPayload(data: unknown): TangoPuzzleClientData {
	if (!isRecord(data)) {
		throw new Error('[duo] invalid puzzle payload')
	}
	if ('puzzleData' in data || 'solution' in data || 'solutionJson' in data) {
		throw new Error('[duo] solution-bearing puzzle payload is not client-safe')
	}
	if (
		typeof data.size !== 'number' ||
		!Number.isInteger(data.size) ||
		data.size < MIN_SIZE ||
		data.size > MAX_SIZE ||
		data.size % 2 !== 0
	) {
		throw new Error('[duo] size must be an even integer from 4 to 10')
	}
	const size = data.size
	if (!Array.isArray(data.initialGrid) || data.initialGrid.length !== size) {
		throw new Error(`[duo] initialGrid must be ${size}×${size}`)
	}
	const initialGrid = data.initialGrid.map((row) => {
		if (!Array.isArray(row) || row.length !== size) {
			throw new Error(`[duo] initialGrid must be ${size}×${size}`)
		}
		return row.map(parseCell)
	})
	return { size, initialGrid }
}
