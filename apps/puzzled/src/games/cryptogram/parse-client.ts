/**
 * Client parser for the solution-safe Cryptogram payload served by Connect.
 *
 * Encrypted text is playable. The cipher stays in Rust.
 */

import type { CryptogramPuzzleData } from './types'
import { MAX_HINTS } from './types'

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function parseCryptogramClientPayload(data: unknown): CryptogramPuzzleData {
	if (!isRecord(data)) throw new Error('[cryptogram] invalid puzzle payload')
	if (
		'puzzleData' in data ||
		'solution' in data ||
		'solutionJson' in data ||
		'cipher' in data ||
		'reverseCipher' in data ||
		'originalText' in data
	) {
		throw new Error('[cryptogram] solution-bearing puzzle payload is not client-safe')
	}
	if (typeof data.encryptedText !== 'string' || data.encryptedText.length === 0) {
		throw new Error('[cryptogram] encryptedText required')
	}
	if (typeof data.author !== 'string') throw new Error('[cryptogram] author required')
	if (typeof data.category !== 'string') throw new Error('[cryptogram] category required')
	if (typeof data.uniqueLetters !== 'number' || data.uniqueLetters < 1) {
		throw new Error('[cryptogram] uniqueLetters required')
	}
	return {
		encryptedText: data.encryptedText.toUpperCase(),
		author: data.author,
		category: data.category,
		uniqueLetters: data.uniqueLetters,
		maxHints: typeof data.maxHints === 'number' ? data.maxHints : MAX_HINTS,
	}
}
