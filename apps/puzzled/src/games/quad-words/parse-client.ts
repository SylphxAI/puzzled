/**
 * Client parser for the solution-safe Quad Words payload served by Connect.
 */

import { MAX_GUESSES, type QuordlePuzzleClientData } from './types'

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function parseQuadWordsClientPayload(data: unknown): QuordlePuzzleClientData {
	if (!isRecord(data)) throw new Error('[quad-words] invalid puzzle payload')
	if ('puzzleData' in data || 'solution' in data || 'solutionJson' in data || 'words' in data) {
		throw new Error('[quad-words] solution-bearing puzzle payload is not client-safe')
	}
	const wordLength = data.wordLength === undefined ? 5 : data.wordLength
	const maxGuesses = data.maxGuesses === undefined ? MAX_GUESSES : data.maxGuesses
	if (wordLength !== 5) throw new Error('[quad-words] wordLength must be 5')
	if (maxGuesses !== MAX_GUESSES) throw new Error('[quad-words] maxGuesses must be 9')
	return { wordLength, maxGuesses }
}
