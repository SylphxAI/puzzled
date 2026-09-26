/**
 * Client parser for GetDaily word-search payloads.
 *
 * The puzzle a player sees is the letter grid, the theme and the list of words
 * to find; only where each word sits is secret. A selection is judged in the
 * browser by reading the grid letters along it and matching a listed word;
 * the server still validates the submission.
 *
 * The legacy wrapped `{ puzzleData, solution }` shape is accepted: its word
 * list is kept and the placements are dropped.
 */

import type { WordSearchPuzzleData } from './types'

export type WordSearchClientData = WordSearchPuzzleData & {
	/** Words to find, upper case, in display order */
	words: string[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function words(value: unknown): string[] | null {
	if (!Array.isArray(value) || value.length === 0) return null
	if (!value.every((word) => typeof word === 'string' && word.trim())) return null
	return value.map((word) => (word as string).trim().toUpperCase())
}

export function parseWordSearchClientPayload(data: unknown): WordSearchClientData {
	if (!isRecord(data)) throw new Error('[word-search] invalid puzzle payload')
	const inner = isRecord(data.puzzleData) ? data.puzzleData : data
	const grid = inner.grid
	if (
		!Array.isArray(grid) ||
		grid.length === 0 ||
		!grid.every(
			(row) =>
				Array.isArray(row) &&
				row.length === grid.length &&
				row.every((cell) => typeof cell === 'string' && cell.length === 1),
		)
	) {
		throw new Error('[word-search] grid must be a square of single letters')
	}
	const list = words(inner.words) ?? (isRecord(data.solution) ? words(data.solution.words) : null)
	if (!list) throw new Error('[word-search] the served puzzle has no word list')
	return {
		grid: grid as string[][],
		theme: typeof inner.theme === 'string' ? inner.theme : '',
		wordCount: typeof inner.wordCount === 'number' ? inner.wordCount : list.length,
		words: list,
	}
}
