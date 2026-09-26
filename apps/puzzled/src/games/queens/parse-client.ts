/**
 * Client parser for GetDaily crowns (queens) payloads.
 *
 * The server serves `{ size, regions }` with the solution stripped; the
 * legacy wrapped shape is accepted and its solution dropped. The board is
 * judged by its rules, and the server checks the finish on submit.
 */

import type { QueensPuzzleData } from './types'

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function parseQueensClientPayload(data: unknown): QueensPuzzleData {
	if (!isRecord(data)) throw new Error('[crowns] invalid puzzle payload')
	const inner = isRecord(data.puzzleData) ? data.puzzleData : data
	const size = Number(inner.size)
	const regions = inner.regions
	if (!Number.isInteger(size) || size < 4 || size > 12) throw new Error('[crowns] invalid size')
	if (
		!Array.isArray(regions) ||
		regions.length !== size ||
		regions.some(
			(row) =>
				!Array.isArray(row) ||
				row.length !== size ||
				row.some((cell) => !Number.isInteger(cell) || cell < 0 || cell >= size),
		)
	) {
		throw new Error('[crowns] regions must be size×size region indices')
	}
	return { size, regions: regions as number[][] }
}
