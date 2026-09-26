/**
 * Client parser for GetDaily word-ladder payloads.
 *
 * The server serves `{ startWord, endWord, wordLength, minSteps }` with the
 * solution path stripped. The legacy wrapped `{ puzzleData, solution }` shape
 * is accepted and its path dropped: the browser judges each step by the rules
 * (a dictionary word one letter from the last), and the server validates the
 * finished path.
 */

import type { WordLadderPuzzleData } from './types'

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function parseWordLadderClientPayload(data: unknown): WordLadderPuzzleData {
	if (!isRecord(data)) throw new Error('[word-ladder] invalid puzzle payload')
	const inner = isRecord(data.puzzleData) ? data.puzzleData : data
	const startWord = typeof inner.startWord === 'string' ? inner.startWord.toLowerCase() : ''
	const endWord = typeof inner.endWord === 'string' ? inner.endWord.toLowerCase() : ''
	if (!startWord || startWord.length !== endWord.length) {
		throw new Error('[word-ladder] start and end words are required')
	}
	const wordLength =
		typeof inner.wordLength === 'number' && inner.wordLength > 0
			? inner.wordLength
			: startWord.length
	const minSteps = typeof inner.minSteps === 'number' && inner.minSteps > 0 ? inner.minSteps : 1
	return { startWord, endWord, wordLength, minSteps }
}
