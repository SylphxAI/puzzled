/**
 * Letter Boxed Puzzle Generator
 *
 * ⚠️ FROZEN ALGORITHM - DO NOT MODIFY
 * Changes will break historical puzzles
 *
 * Generates puzzles algorithmically:
 * 1. Generate 12 unique letters arranged on 4 sides
 * 2. Find words that can be formed (no consecutive letters on same side)
 * 3. Find a valid word chain that uses all letters
 *
 * Server-only module - dictionary is loaded on first access.
 */

import { readFileSync } from 'node:fs'
import wordListPath from 'word-list'
import { seededRandom, shuffleArray } from '@/games/shared/random'
import type { LetterBox, LetterBoxedPuzzleData, LetterBoxedSolution } from './types'

// Lazy-loaded dictionary (only loaded when accessed on server)
let _dictionary: Set<string> | null = null

/**
 * Load dictionary from file (server-only operation)
 */
function getDictionary(): Set<string> {
	if (_dictionary) return _dictionary

	const rawWords = readFileSync(wordListPath, 'utf8').split('\n')
	_dictionary = new Set(
		rawWords
			.filter((word: string) => /^[a-z]{3,}$/i.test(word))
			.map((word: string) => word.toUpperCase()),
	)

	return _dictionary
}

/**
 * Get the side index (0-3) for a letter in the box
 */
function getLetterSide(letter: string, box: LetterBox): number {
	if (box.top.includes(letter)) return 0
	if (box.right.includes(letter)) return 1
	if (box.bottom.includes(letter)) return 2
	if (box.left.includes(letter)) return 3
	return -1
}

/**
 * Check if a word is valid for the given box
 * (no consecutive letters on same side)
 */
function isValidWordForBox(word: string, box: LetterBox): boolean {
	const allLetters = [...box.top, ...box.right, ...box.bottom, ...box.left]
	const letterSet = new Set(allLetters)

	// All letters must be in the box
	for (const char of word) {
		if (!letterSet.has(char)) return false
	}

	// No consecutive letters on same side
	for (let i = 0; i < word.length - 1; i++) {
		const side1 = getLetterSide(word[i], box)
		const side2 = getLetterSide(word[i + 1], box)
		if (side1 === side2) return false
	}

	return true
}

/**
 * Find all valid words for a given box
 */
function findValidWords(box: LetterBox): string[] {
	const validWords: string[] = []
	const dictionary = getDictionary()

	for (const word of dictionary) {
		if (word.length >= 3 && isValidWordForBox(word, box)) {
			validWords.push(word)
		}
	}

	return validWords
}

/**
 * Find a word chain that uses all letters
 * DFS with memoization for efficiency
 */
function findWordChain(words: string[], allLetters: Set<string>, maxWords = 5): string[] | null {
	// Group words by first letter for efficient lookup
	const wordsByFirstLetter = new Map<string, string[]>()
	for (const word of words) {
		const first = word[0]
		if (!wordsByFirstLetter.has(first)) {
			wordsByFirstLetter.set(first, [])
		}
		wordsByFirstLetter.get(first)!.push(word)
	}

	// Sort words by length (longer words more likely to cover letters)
	const sortedWords = [...words].sort((a, b) => b.length - a.length)

	function dfs(
		chain: string[],
		usedLetters: Set<string>,
		lastLetter: string | null,
	): string[] | null {
		// Check if all letters used
		if (usedLetters.size === allLetters.size) {
			return chain
		}

		// Max chain length exceeded
		if (chain.length >= maxWords) {
			return null
		}

		// Get candidate words
		const candidates = lastLetter
			? wordsByFirstLetter.get(lastLetter) || []
			: sortedWords.slice(0, 50) // Start with longest words

		for (const word of candidates) {
			// Skip if word doesn't add new letters
			let addsNew = false
			for (const char of word) {
				if (!usedLetters.has(char)) {
					addsNew = true
					break
				}
			}
			if (!addsNew && chain.length > 0) continue

			// Add word to chain
			const newUsed = new Set(usedLetters)
			for (const char of word) {
				newUsed.add(char)
			}

			const result = dfs([...chain, word], newUsed, word[word.length - 1])
			if (result) return result
		}

		return null
	}

	return dfs([], new Set(), null)
}

/**
 * Generate a Letter Boxed puzzle from seed
 */
export function generateLetterBoxedPuzzle(seed: number): {
	puzzleData: LetterBoxedPuzzleData
	solution: LetterBoxedSolution
} {
	const random = seededRandom(seed)

	// Letter frequency for English - prefer common letters
	const commonLetters = 'ETAOINSHRDLCUMWFGYPBVKJXQZ'.split('')

	// Try multiple times to find a solvable puzzle
	for (let attempt = 0; attempt < 50; attempt++) {
		// Generate 12 unique letters with bias toward common letters
		const shuffled = shuffleArray(commonLetters, random)

		// Mix of vowels and consonants
		const vowels = shuffled.filter((l) => 'AEIOU'.includes(l)).slice(0, 3)
		const consonants = shuffled.filter((l) => !'AEIOU'.includes(l)).slice(0, 9)

		if (vowels.length < 2 || consonants.length < 8) {
			continue // Not enough letters, retry
		}

		const letters = shuffleArray([...vowels, ...consonants.slice(0, 12 - vowels.length)], random)

		if (letters.length !== 12) continue

		// Arrange on 4 sides
		const box: LetterBox = {
			top: letters.slice(0, 3) as [string, string, string],
			right: letters.slice(3, 6) as [string, string, string],
			bottom: letters.slice(6, 9) as [string, string, string],
			left: letters.slice(9, 12) as [string, string, string],
		}

		// Find valid words for this box
		const validWords = findValidWords(box)

		if (validWords.length < 10) continue // Not enough words

		// Find a word chain that uses all letters
		const allLetters = new Set(letters)
		const chain = findWordChain(validWords, allLetters, 5)

		if (chain) {
			return {
				puzzleData: { box },
				solution: {
					words: chain,
					allLetters: letters,
				},
			}
		}
	}

	// ⚠️ ARCHITECTURE PRINCIPLE: No silent fallbacks
	throw new Error(
		`LetterBoxed: Failed to generate solvable puzzle for seed ${seed}. ` +
			`This indicates the algorithm needs tuning or the seed produces difficult letter combinations.`,
	)
}
