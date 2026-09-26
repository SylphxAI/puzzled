/**
 * Client parser for GetDaily word-hive payloads.
 *
 * Keeps only what play needs: the letters, the maximum score and the word
 * and pangram counts. Any word list in the payload (the served puzzle still
 * carries one, and the legacy wrapped `{ puzzleData, solution }` shape does
 * too) is reduced to its counts and dropped: each word is graded on the
 * server (`PuzzleService.CheckGuess`).
 */

import type { WordHivePlayData } from './types'

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function count(value: unknown, list: unknown): number {
	if (typeof value === 'number' && Number.isInteger(value) && value >= 0) return value
	return Array.isArray(list) ? list.length : 0
}

export function parseWordHiveClientPayload(data: unknown): WordHivePlayData {
	if (!isRecord(data)) throw new Error('[word-hive] invalid puzzle payload')
	const inner = isRecord(data.puzzleData) ? data.puzzleData : data
	const letter = (value: unknown) =>
		typeof value === 'string' && /^[a-z]$/i.test(value) ? value.toUpperCase() : ''
	const centerLetter = letter(inner.centerLetter)
	const outerLetters = Array.isArray(inner.outerLetters) ? inner.outerLetters.map(letter) : []
	if (!centerLetter || outerLetters.length !== 6 || outerLetters.some((l) => !l)) {
		throw new Error('[word-hive] a centre letter and six outer letters are required')
	}
	const maxScore =
		typeof inner.maxScore === 'number' && inner.maxScore > 0 ? Math.trunc(inner.maxScore) : 0
	return {
		centerLetter,
		outerLetters,
		maxScore,
		totalWords: count(inner.totalWords, inner.validWords),
		totalPangrams: count(inner.totalPangrams, inner.pangrams),
	}
}
