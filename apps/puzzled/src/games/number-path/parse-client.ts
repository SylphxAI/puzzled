/**
 * Client parser for GetDaily number-path payloads.
 *
 * The server serves `{ size, clues }` with the solution stripped. The legacy
 * wrapped `{ puzzleData, solution }` shape is accepted and its solution
 * dropped: the browser judges the finish by the rules (`isSolved`), and the
 * server validates the submitted path.
 */

import type { NumberPathPuzzleData } from './types'

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function parseNumberPathClientPayload(data: unknown): NumberPathPuzzleData {
	if (!isRecord(data)) throw new Error('[number-path] invalid puzzle payload')
	const inner = isRecord(data.puzzleData) ? data.puzzleData : data
	const { size, clues } = inner
	if (typeof size !== 'number' || !Number.isInteger(size) || size < 2) {
		throw new Error('[number-path] invalid size')
	}
	if (!Array.isArray(clues) || clues.length !== size) {
		throw new Error('[number-path] clues must be size × size')
	}
	const grid = clues.map((row) => {
		if (!Array.isArray(row) || row.length !== size) {
			throw new Error('[number-path] clues must be size × size')
		}
		return row.map((cell) =>
			typeof cell === 'number' && Number.isInteger(cell) && cell >= 1 ? cell : null,
		)
	})
	return { size, clues: grid }
}
