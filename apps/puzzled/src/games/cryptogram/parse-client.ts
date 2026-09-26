/**
 * Client parser for GetDaily cryptogram payloads.
 *
 * The server serves `{ encryptedText, author, category, uniqueLetters,
 * maxHints }` with the solution stripped. The legacy wrapped
 * `{ puzzleData, solution }` shape is accepted and its solution dropped: the
 * server grades the decoding and the hints (`PuzzleService.CheckGuess`).
 */

import type { CryptogramPuzzleData } from './types'
import { MAX_HINTS } from './types'

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function parseCryptogramClientPayload(data: unknown): CryptogramPuzzleData {
	if (!isRecord(data)) throw new Error('[cryptogram] invalid puzzle payload')
	const inner = isRecord(data.puzzleData) ? data.puzzleData : data
	const encryptedText = inner.encryptedText
	if (typeof encryptedText !== 'string' || !/[A-Z]/.test(encryptedText)) {
		throw new Error('[cryptogram] encryptedText is required')
	}
	const text = (value: unknown) => (typeof value === 'string' ? value : '')
	const count = (value: unknown, fallback: number) =>
		typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : fallback
	return {
		encryptedText,
		author: text(inner.author),
		category: text(inner.category),
		uniqueLetters: count(inner.uniqueLetters, new Set(encryptedText.match(/[A-Z]/g)).size),
		maxHints: count(inner.maxHints, MAX_HINTS),
	}
}
