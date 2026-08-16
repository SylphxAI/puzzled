/**
 * Client parser for the solution-safe Nonogram payload served by Connect.
 *
 * GetDaily sends `{ width, height, rowClues, colClues }`. The picture stays
 * in Rust and is checked only by SubmitGuess.
 */

import type { NonogramPuzzleClientData } from './types'

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function parseClueLine(raw: unknown): number[] {
	if (!Array.isArray(raw)) {
		throw new Error('[nonogram] clues must be arrays')
	}
	return raw.map((item) => {
		if (typeof item !== 'number' || !Number.isInteger(item) || item < 0) {
			throw new Error('[nonogram] clues must be non-negative integers')
		}
		return item
	})
}

/** Parse only the current raw Connect payload; legacy wrapped data is rejected. */
export function parseNonogramClientPayload(data: unknown): NonogramPuzzleClientData {
	if (!isRecord(data)) {
		throw new Error('[nonogram] invalid puzzle payload')
	}
	if ('puzzleData' in data || 'solution' in data || 'solutionJson' in data) {
		throw new Error('[nonogram] solution-bearing puzzle payload is not client-safe')
	}
	if (
		typeof data.width !== 'number' ||
		typeof data.height !== 'number' ||
		!Number.isInteger(data.width) ||
		!Number.isInteger(data.height) ||
		data.width < 1 ||
		data.height < 1
	) {
		throw new Error('[nonogram] width and height must be positive integers')
	}
	if (!Array.isArray(data.rowClues) || data.rowClues.length !== data.height) {
		throw new Error('[nonogram] rowClues must match height')
	}
	if (!Array.isArray(data.colClues) || data.colClues.length !== data.width) {
		throw new Error('[nonogram] colClues must match width')
	}
	return {
		width: data.width,
		height: data.height,
		rowClues: data.rowClues.map(parseClueLine),
		colClues: data.colClues.map(parseClueLine),
		theme: typeof data.theme === 'string' ? data.theme : undefined,
	}
}
