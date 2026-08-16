/**
 * Client parser for the solution-safe Hunt payload served by Connect.
 *
 * The word list is player-facing. Placements stay in Rust.
 */

import { GRID_SIZE, type WordSearchPuzzleClientData } from './types'

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function parseWordSearchClientPayload(data: unknown): WordSearchPuzzleClientData {
	if (!isRecord(data)) throw new Error('[word-search] invalid puzzle payload')
	if (
		'puzzleData' in data ||
		'solution' in data ||
		'solutionJson' in data ||
		'placements' in data
	) {
		throw new Error('[word-search] solution-bearing puzzle payload is not client-safe')
	}
	if (!Array.isArray(data.grid) || data.grid.length !== GRID_SIZE) {
		throw new Error('[word-search] grid must be 10×10')
	}
	const grid = data.grid.map((row) => {
		if (!Array.isArray(row) || row.length !== GRID_SIZE) {
			throw new Error('[word-search] grid must be 10×10')
		}
		return row.map((cell) => {
			if (typeof cell !== 'string' || cell.length !== 1) {
				throw new Error('[word-search] grid cells must be letters')
			}
			return cell.toUpperCase()
		})
	})
	if (typeof data.theme !== 'string' || data.theme.length === 0) {
		throw new Error('[word-search] theme required')
	}
	if (!Array.isArray(data.words) || data.words.length === 0) {
		throw new Error('[word-search] words required')
	}
	const words = data.words.map((word) => {
		if (typeof word !== 'string' || word.length === 0) {
			throw new Error('[word-search] words must be non-empty')
		}
		return word.toUpperCase()
	})
	if (typeof data.wordCount !== 'number' || data.wordCount !== words.length) {
		throw new Error('[word-search] wordCount must match words')
	}
	return { grid, theme: data.theme, wordCount: data.wordCount, words }
}
