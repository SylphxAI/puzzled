/**
 * Client parser for the solution-safe Crowns payload served by Connect.
 *
 * GetDaily sends the raw `{ size, regions }` puzzle structure. Crown
 * positions stay in Rust and are checked only by SubmitGuess.
 */

import type { QueensPuzzleClientData } from './types'

const MIN_SIZE = 5
const MAX_SIZE = 9

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function parseSize(raw: unknown): number {
	if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < MIN_SIZE || raw > MAX_SIZE) {
		throw new Error('[crowns] size must be an integer from 5 to 9')
	}
	return raw
}

function parseRegions(raw: unknown, size: number): number[][] {
	if (!Array.isArray(raw) || raw.length !== size) {
		throw new Error(`[crowns] regions must be ${size}×${size}`)
	}

	return raw.map((row) => {
		if (!Array.isArray(row) || row.length !== size) {
			throw new Error(`[crowns] regions must be ${size}×${size}`)
		}
		return row.map((cell) => {
			if (typeof cell !== 'number' || !Number.isInteger(cell) || cell < 0) {
				throw new Error('[crowns] region cells must be non-negative integers')
			}
			return cell
		})
	})
}

/** Parse only the current raw Connect payload; legacy wrapped data is rejected. */
export function parseCrownsClientPayload(data: unknown): QueensPuzzleClientData {
	if (!isRecord(data)) {
		throw new Error('[crowns] invalid puzzle payload')
	}

	if ('puzzleData' in data || 'solution' in data || 'solutionJson' in data || 'queens' in data) {
		throw new Error('[crowns] solution-bearing puzzle payload is not client-safe')
	}

	const size = parseSize(data.size)
	return {
		size,
		regions: parseRegions(data.regions, size),
	}
}
