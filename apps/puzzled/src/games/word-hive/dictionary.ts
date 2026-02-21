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

import { readFileSync } from "node:fs";
import wordListPath from "word-list";

// Filter criteria for Spelling Bee:
// - 4+ letters (Spelling Bee minimum)
// - Only letters A-Z (no hyphens, apostrophes, etc.)
// - Uppercase for consistency
const VALID_WORD_REGEX = /^[a-z]{4,}$/i;

// Lazy-loaded dictionary (only loaded when accessed on server)
let _dictionary: Set<string> | null = null;
let _wordCounts: { raw: number; filtered: number } | null = null;

/**
 * Load dictionary from file (server-only operation)
 */
function loadDictionary(): Set<string> {
	if (_dictionary) return _dictionary;

	const rawWords = readFileSync(wordListPath, "utf8").split("\n");
	const filteredWords = rawWords
		.filter((word: string) => VALID_WORD_REGEX.test(word))
		.map((word: string) => word.toUpperCase());

	_dictionary = new Set(filteredWords);
	_wordCounts = {
		raw: rawWords.length,
		filtered: _dictionary.size,
	};

	return _dictionary;
}

/**
 * Get the Spelling Bee dictionary (lazy-loaded)
 * Only call this in server-side code
 */
export const SPELLING_BEE_DICTIONARY = {
	[Symbol.iterator]: function* () {
		yield* loadDictionary();
	},
	has: (word: string) => loadDictionary().has(word),
	get size() {
		return loadDictionary().size;
	},
	values: () => loadDictionary().values(),
	keys: () => loadDictionary().keys(),
	entries: () => loadDictionary().entries(),
	forEach: (callback: (value: string, key: string, set: Set<string>) => void) =>
		loadDictionary().forEach(callback),
};

// Export word counts for debugging (lazy)
const _WORD_COUNTS = {
	get raw() {
		loadDictionary();
		return _wordCounts?.raw ?? 0;
	},
	get filtered() {
		loadDictionary();
		return _wordCounts?.filtered ?? 0;
	},
};

/**
 * Check if a word is in the dictionary
 */
function _isValidWord(word: string): boolean {
	return SPELLING_BEE_DICTIONARY.has(word.toUpperCase());
}

/**
 * Get all words that can be formed from a set of letters
 * @param letters - Array of 7 letters (first is center)
 * @returns Array of valid words
 */
function _getWordsForLetters(letters: string[]): string[] {
	const letterSet = new Set(letters.map((l) => l.toUpperCase()));
	const centerLetter = letters[0].toUpperCase();

	return Array.from(SPELLING_BEE_DICTIONARY).filter((word) => {
		// Word must contain center letter
		if (!word.includes(centerLetter)) return false;

		// All letters in word must be in letter set
		for (const char of word) {
			if (!letterSet.has(char)) return false;
		}

		return true;
	});
}

/**
 * Find pangrams (words using all 7 letters)
 */
function _findPangrams(letters: string[], words: string[]): string[] {
	return words.filter((word) => {
		const wordLetters = new Set(word.split(""));
		return letters.every((l) => wordLetters.has(l.toUpperCase()));
	});
}
