/**
 * Client parser for the solution-safe word-groups payload served by Connect.
 *
 * GetDaily sends `{ words, maxMistakes, wordsPerCategory, totalCategories }`.
 * Category groupings stay in Rust and are checked by SubmitGuess.
 */

import {
	type ConnectionsPuzzleClientData,
	MAX_MISTAKES,
	TOTAL_CATEGORIES,
	WORDS_PER_CATEGORY,
} from './types'

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

/** Parse only the current raw Connect payload; legacy wrapped data is rejected. */
export function parseWordGroupsClientPayload(data: unknown): ConnectionsPuzzleClientData {
	if (!isRecord(data)) {
		throw new Error('[word-groups] invalid puzzle payload')
	}
	if (
		'puzzleData' in data ||
		'solution' in data ||
		'solutionJson' in data ||
		'categories' in data
	) {
		throw new Error('[word-groups] solution-bearing puzzle payload is not client-safe')
	}
	if (!Array.isArray(data.words) || data.words.length !== TOTAL_CATEGORIES * WORDS_PER_CATEGORY) {
		throw new Error('[word-groups] words must include 16 strings')
	}
	const words = data.words.map((word) => {
		if (typeof word !== 'string' || word.length === 0) {
			throw new Error('[word-groups] words must be non-empty strings')
		}
		return word
	})
	if (data.maxMistakes !== MAX_MISTAKES) {
		throw new Error('[word-groups] maxMistakes must be 4')
	}
	if (data.wordsPerCategory !== WORDS_PER_CATEGORY) {
		throw new Error('[word-groups] wordsPerCategory must be 4')
	}
	if (data.totalCategories !== TOTAL_CATEGORIES) {
		throw new Error('[word-groups] totalCategories must be 4')
	}
	return {
		words,
		maxMistakes: MAX_MISTAKES,
		wordsPerCategory: WORDS_PER_CATEGORY,
		totalCategories: TOTAL_CATEGORIES,
	}
}
