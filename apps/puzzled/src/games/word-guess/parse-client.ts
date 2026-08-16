/**
 * Client parser for the solution-safe word-guess payload served by Connect.
 *
 * GetDaily sends `{ wordLength, maxAttempts }`. The answer stays in Rust and
 * is checked by SubmitGuess (live coloring + terminal persist).
 */

import { MAX_GUESSES, WORD_LENGTH, type WordlePuzzleClientData } from './types'

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

/** Parse only the current raw Connect payload; legacy wrapped data is rejected. */
export function parseWordGuessClientPayload(data: unknown): WordlePuzzleClientData {
	if (!isRecord(data)) {
		throw new Error('[word-guess] invalid puzzle payload')
	}

	if ('puzzleData' in data || 'solution' in data || 'solutionJson' in data || 'word' in data) {
		throw new Error('[word-guess] solution-bearing puzzle payload is not client-safe')
	}

	const wordLength = data.wordLength
	const maxAttempts = data.maxAttempts
	if (wordLength !== WORD_LENGTH) {
		throw new Error(`[word-guess] wordLength must be ${WORD_LENGTH}`)
	}
	if (maxAttempts !== MAX_GUESSES) {
		throw new Error(`[word-guess] maxAttempts must be ${MAX_GUESSES}`)
	}

	return { wordLength, maxAttempts }
}
