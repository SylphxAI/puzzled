/**
 * Spelling Bee Puzzle Generator
 *
 * INFINITE ALGORITHM: Computes all valid letter sets from dictionary at runtime.
 * Any seed produces a valid puzzle through deterministic selection.
 *
 * ⚠️ FROZEN SINCE: v2.0
 * DO NOT MODIFY - changing this will break historical puzzles
 *
 * Algorithm:
 * 1. Scan dictionary for all pangrams (words using exactly 7 unique letters)
 * 2. For each pangram's letter set, validate as potential puzzle
 * 3. Use seed to deterministically select from valid configurations
 */

import { seededRandom, shuffleArray } from '@/games/shared/random'
import { SPELLING_BEE_DICTIONARY } from './dictionary'
import { calculateWordScore, type SpellingBeePuzzleData } from './types'

// ============================================================================
// LETTER SET COMPUTATION - FROZEN
// ============================================================================

/**
 * Computed letter set structure
 */
type ComputedLetterSet = {
	letters: string // 7 unique letters (sorted for consistency)
	centerIndex: number // Which letter is center (0-6)
	pangrams: string[]
	words: string[]
}

/**
 * ⚠️ FROZEN: Find all valid letter sets from dictionary
 * DO NOT MODIFY - changing this breaks historical puzzles
 *
 * Algorithm:
 * 1. Find all pangrams (words with exactly 7 unique letters)
 * 2. Group pangrams by their letter set (sorted)
 * 3. For each letter set, try each letter as center
 * 4. Keep configurations with ≥15 valid words
 */
function computeAllValidSets(): ComputedLetterSet[] {
	const dictionary = Array.from(SPELLING_BEE_DICTIONARY)
	const letterSetMap = new Map<string, Set<string>>() // letters -> pangrams

	// Step 1: Find all pangrams and group by letter set
	for (const word of dictionary) {
		const uniqueLetters = new Set(word.split(''))
		if (uniqueLetters.size === 7) {
			// This is a pangram - uses exactly 7 unique letters
			const sortedLetters = Array.from(uniqueLetters).sort().join('')
			if (!letterSetMap.has(sortedLetters)) {
				letterSetMap.set(sortedLetters, new Set())
			}
			letterSetMap.get(sortedLetters)!.add(word)
		}
	}

	// Step 2: For each letter set, find all valid words and try each center
	const validSets: ComputedLetterSet[] = []

	for (const [sortedLetters, pangrams] of letterSetMap) {
		const letters = sortedLetters.split('')
		const letterSet = new Set(letters)

		// Find ALL words that can be formed from these 7 letters
		const allValidWords = dictionary.filter((word) => {
			for (const char of word) {
				if (!letterSet.has(char)) return false
			}
			return true
		})

		// Try each of the 7 letters as center
		for (let centerIndex = 0; centerIndex < 7; centerIndex++) {
			const centerLetter = letters[centerIndex]

			// Filter words that contain the center letter
			const wordsWithCenter = allValidWords.filter((word) => word.includes(centerLetter))

			// Must have at least 15 valid words for a good puzzle
			if (wordsWithCenter.length >= 15) {
				// Filter pangrams that contain center (they all should, but verify)
				const validPangrams = Array.from(pangrams).filter((p) => p.includes(centerLetter))

				validSets.push({
					letters: sortedLetters,
					centerIndex,
					pangrams: validPangrams.sort(),
					words: wordsWithCenter.sort(),
				})
			}
		}
	}

	// Sort for deterministic ordering (by letters, then by centerIndex)
	validSets.sort((a, b) => {
		if (a.letters !== b.letters) return a.letters.localeCompare(b.letters)
		return a.centerIndex - b.centerIndex
	})

	return validSets
}

// ============================================================================
// CACHED COMPUTATION
// ============================================================================

let cachedSets: ComputedLetterSet[] | null = null

/**
 * Get all valid letter sets (cached)
 * This is computed once and reused
 */
function getAllValidSets(): ComputedLetterSet[] {
	if (!cachedSets) {
		cachedSets = computeAllValidSets()
	}
	return cachedSets
}

/**
 * Get count of available letter sets
 * Returns actual computed count (typically 500-2000+)
 */
export function getLetterSetCount(): number {
	return getAllValidSets().length
}

// ============================================================================
// PUZZLE GENERATION - FROZEN
// ============================================================================

/**
 * ⚠️ FROZEN: Generate a Spelling Bee puzzle from seed
 * DO NOT MODIFY - changing this breaks historical puzzles
 *
 * Algorithm:
 * 1. Use seed to select a letter set configuration
 * 2. Shuffle outer letters for visual variety
 * 3. Return deterministic puzzle
 */
export function generateSpellingBeePuzzle(seed: number): SpellingBeePuzzleData {
	const validSets = getAllValidSets()
	const random = seededRandom(seed)

	// Select configuration deterministically
	const setIndex = Math.abs(seed) % validSets.length
	const config = validSets[setIndex]

	// Extract letters
	const allLetters = config.letters.split('')
	const centerLetter = allLetters[config.centerIndex]

	// Get outer letters (excluding center)
	const outerLetters = allLetters.filter((_, i) => i !== config.centerIndex)

	// Shuffle outer letters for visual variety
	const shuffledOuter = shuffleArray(outerLetters, random)

	return {
		centerLetter,
		outerLetters: shuffledOuter,
		pangrams: config.pangrams,
		validWords: config.words,
	}
}

/**
 * Calculate max score for a puzzle
 */
export function calculateMaxScore(puzzle: SpellingBeePuzzleData): number {
	let total = 0
	for (const word of puzzle.validWords) {
		const isPangram = puzzle.pangrams.includes(word)
		total += calculateWordScore(word, isPangram)
	}
	return total
}

/**
 * Validate that a letter set produces a valid puzzle
 * Used for testing and verification
 */
export function validateLetterSet(config: ComputedLetterSet): {
	valid: boolean
	wordCount: number
	pangramCount: number
	errors: string[]
} {
	const errors: string[] = []

	// Check letter count
	if (config.letters.length !== 7) {
		errors.push(`Invalid letter count: ${config.letters.length}, expected 7`)
	}

	// Check unique letters
	const uniqueLetters = new Set(config.letters.split(''))
	if (uniqueLetters.size !== 7) {
		errors.push(`Duplicate letters found in: ${config.letters}`)
	}

	// Check center index
	if (config.centerIndex < 0 || config.centerIndex >= 7) {
		errors.push(`Invalid center index: ${config.centerIndex}`)
	}

	// Check word count
	if (config.words.length < 15) {
		errors.push(`Too few words: ${config.words.length}, need at least 15`)
	}

	// Check pangram count
	if (config.pangrams.length < 1) {
		errors.push('No pangrams found')
	}

	// Validate all words use only the letters
	const letterSetUpper = new Set(config.letters.toUpperCase().split(''))
	const centerLetter = config.letters[config.centerIndex].toUpperCase()

	for (const word of config.words) {
		const wordUpper = word.toUpperCase()

		// Check word contains center letter
		if (!wordUpper.includes(centerLetter)) {
			errors.push(`Word "${word}" missing center letter "${centerLetter}"`)
		}

		// Check all letters are valid
		for (const char of wordUpper) {
			if (!letterSetUpper.has(char)) {
				errors.push(`Word "${word}" contains invalid letter "${char}"`)
			}
		}
	}

	// Validate pangrams use all letters
	for (const pangram of config.pangrams) {
		const pangramLetters = new Set(pangram.toUpperCase().split(''))
		for (const letter of letterSetUpper) {
			if (!pangramLetters.has(letter)) {
				errors.push(`Pangram "${pangram}" missing letter "${letter}"`)
			}
		}
	}

	return {
		valid: errors.length === 0,
		wordCount: config.words.length,
		pangramCount: config.pangrams.length,
		errors,
	}
}

/**
 * Get count of available puzzles
 * Returns the count of computed valid configurations
 */
export function getPuzzleCount(): number {
	return getLetterSetCount()
}
