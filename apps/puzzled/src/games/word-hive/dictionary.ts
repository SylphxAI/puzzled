/**
 * Spelling Bee Word Dictionary
 *
 * Uses the word-list package (~274k English words) for comprehensive coverage.
 * Filtered to 4+ letter common words suitable for Spelling Bee.
 *
 * Source: https://github.com/sindresorhus/word-list
 * - One-letter words excluded
 * - Common bad words filtered out
 * - From Letterpress game word list
 *
 * Server-only module - dictionary is loaded on first access.
 */

import { readFileSync } from 'node:fs'
import wordListPath from 'word-list'

// Filter criteria for Spelling Bee:
// - 4+ letters (Spelling Bee minimum)
// - Only letters A-Z (no hyphens, apostrophes, etc.)
// - Uppercase for consistency
const VALID_WORD_REGEX = /^[a-z]{4,}$/i

// Lazy-loaded dictionary (only loaded when accessed on server)
let _dictionary: Set<string> | null = null
let _wordCounts: { raw: number; filtered: number } | null = null

/**
 * Load dictionary from file (server-only operation)
 */
function loadDictionary(): Set<string> {
	if (_dictionary) return _dictionary

	const rawWords = readFileSync(wordListPath, 'utf8').split('\n')
	const filteredWords = rawWords
		.filter((word: string) => VALID_WORD_REGEX.test(word))
		.map((word: string) => word.toUpperCase())

	_dictionary = new Set(filteredWords)
	_wordCounts = {
		raw: rawWords.length,
		filtered: _dictionary.size,
	}

	return _dictionary
}

/**
 * Get the Spelling Bee dictionary (lazy-loaded)
 * Only call this in server-side code
 */
export const SPELLING_BEE_DICTIONARY = {
	[Symbol.iterator]: function* () {
		yield* loadDictionary()
	},
	has: (word: string) => loadDictionary().has(word),
	get size() {
		return loadDictionary().size
	},
	values: () => loadDictionary().values(),
	keys: () => loadDictionary().keys(),
	entries: () => loadDictionary().entries(),
	forEach: (callback: (value: string, key: string, set: Set<string>) => void) =>
		loadDictionary().forEach(callback),
}

/**
 * Check if a word is in the dictionary
 */
function _isValidWord(word: string): boolean {
	return SPELLING_BEE_DICTIONARY.has(word.toUpperCase())
}
