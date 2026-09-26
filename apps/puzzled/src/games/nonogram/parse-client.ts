/**
 * Client parser for GetDaily nonogram payloads.
 *
 * The server serves `{ width, height, rowClues, colClues, theme }` with the
 * solution stripped. The legacy wrapped `{ puzzleData, solution }` shape is
 * accepted and its solution dropped: the clues judge each line and the finish,
 * and the server still validates the submission.
 */

import type { NonogramPuzzleData } from './types'

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function clues(value: unknown, count: number, what: string): number[][] {
	if (!Array.isArray(value) || value.length !== count) {
		throw new Error(`[nonogram] ${what} must have ${count} entries`)
	}
	return value.map((line) => {
		if (
			!Array.isArray(line) ||
			line.length === 0 ||
			!line.every((n) => typeof n === 'number' && Number.isInteger(n) && n >= 0)
		) {
			throw new Error(`[nonogram] invalid ${what}`)
		}
		return line as number[]
	})
}

export function parseNonogramClientPayload(data: unknown): NonogramPuzzleData {
	if (!isRecord(data)) throw new Error('[nonogram] invalid puzzle payload')
	const inner = isRecord(data.puzzleData) ? data.puzzleData : data
	const { width, height } = inner
	if (
		typeof width !== 'number' ||
		typeof height !== 'number' ||
		!Number.isInteger(width) ||
		!Number.isInteger(height) ||
		width < 1 ||
		height < 1
	) {
		throw new Error('[nonogram] width and height must be positive integers')
	}
	return {
		width,
		height,
		rowClues: clues(inner.rowClues, height, 'rowClues'),
		colClues: clues(inner.colClues, width, 'colClues'),
		...(typeof inner.theme === 'string' ? { theme: inner.theme } : {}),
	}
}
