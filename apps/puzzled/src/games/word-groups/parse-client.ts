/**
 * Client parser for GetDaily word-groups payloads.
 *
 * The server serves the sixteen words only (`{ words, maxMistakes,
 * wordsPerCategory, totalCategories }`); the groups stay on the server, which
 * grades each guess (`PuzzleService.CheckGuess`). The legacy wrapped
 * `{ puzzleData, solution }` shape is accepted and its solution dropped.
 */

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

/** The sixteen words to group. */
export function parseWordGroupsClientPayload(data: unknown): string[] {
	if (!isRecord(data)) throw new Error('[word-groups] invalid puzzle payload')
	const inner = isRecord(data.puzzleData) ? data.puzzleData : data
	const { words } = inner
	if (!Array.isArray(words) || words.length !== 16 || !words.every((w) => typeof w === 'string')) {
		throw new Error('[word-groups] the served puzzle needs sixteen words')
	}
	return words
}
