/**
 * Client parser for the solution-safe Rungs payload served by Connect.
 *
 * GetDaily sends start/end words and length. The official path stays in Rust.
 */

import type { WordLadderPuzzleData } from './types'

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function parseWordLadderClientPayload(data: unknown): WordLadderPuzzleData {
	if (!isRecord(data)) throw new Error('[word-ladder] invalid puzzle payload')
	if ('puzzleData' in data || 'solution' in data || 'solutionJson' in data || 'path' in data) {
		throw new Error('[word-ladder] solution-bearing puzzle payload is not client-safe')
	}
	if (typeof data.startWord !== 'string' || data.startWord.length === 0) {
		throw new Error('[word-ladder] startWord required')
	}
	if (typeof data.endWord !== 'string' || data.endWord.length === 0) {
		throw new Error('[word-ladder] endWord required')
	}
	if (typeof data.wordLength !== 'number' || data.wordLength !== data.startWord.length) {
		throw new Error('[word-ladder] wordLength must match startWord')
	}
	if (data.endWord.length !== data.wordLength) {
		throw new Error('[word-ladder] endWord must match wordLength')
	}
	if (typeof data.minSteps !== 'number' || !Number.isInteger(data.minSteps) || data.minSteps < 1) {
		throw new Error('[word-ladder] minSteps must be a positive integer')
	}
	return {
		startWord: data.startWord.toLowerCase(),
		endWord: data.endWord.toLowerCase(),
		wordLength: data.wordLength,
		minSteps: data.minSteps,
	}
}
