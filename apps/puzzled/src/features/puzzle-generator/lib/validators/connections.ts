import 'server-only'

import { readFileSync } from 'node:fs'
import wordListPath from 'word-list'
import type { Category, CategoryLevel, ConnectionsPuzzle } from '@/games/word-groups/types'
import { parseLlmJsonResponse } from '../parse-utils'

/**
 * Validation result for Connections puzzles
 */
export type ConnectionsValidationResult = {
	valid: boolean
	errors: string[]
	warnings: string[] // Non-critical issues (e.g., words not in dictionary)
	puzzle?: ConnectionsPuzzle
}

/**
 * Raw puzzle data from LLM (before validation)
 */
export type RawConnectionsPuzzle = {
	categories?: Array<{
		name?: string
		words?: string[]
		level?: number
	}>
}

// ==========================================
// Dictionary Validation
// ==========================================

/**
 * Lazy-loaded English dictionary from word-list package (~274k words)
 */
let dictionarySet: Set<string> | null = null

function getDictionary(): Set<string> {
	if (!dictionarySet) {
		const words = readFileSync(wordListPath, 'utf8').split('\n')
		dictionarySet = new Set(words.map((w) => w.toLowerCase().trim()).filter((w) => w.length > 0))
	}
	return dictionarySet
}

/**
 * Check if word exists in English dictionary
 * Returns true if word is found (lowercase comparison)
 */
function isInDictionary(word: string): boolean {
	return getDictionary().has(word.toLowerCase())
}

// ==========================================
// Content Filters
// ==========================================

/**
 * Profanity and inappropriate word filter
 * Common slurs and profanity that should never appear in puzzles
 */
const BLOCKED_WORDS = new Set([
	'fuck',
	'shit',
	'damn',
	'ass',
	'bitch',
	'cunt',
	'dick',
	'cock',
	'nigger',
	'faggot',
	'retard',
	'spic',
	'kike',
	'chink',
	'wetback',
	// Add more as needed
])

/**
 * Check if a word is appropriate for the game
 */
function isAppropriateWord(word: string): boolean {
	const lower = word.toLowerCase()
	return !BLOCKED_WORDS.has(lower)
}

/**
 * Check if word format is valid (basic validation)
 * Allows uppercase letters and numbers (for compound words like "24K")
 */
function isValidWordFormat(word: string): boolean {
	// Length check: 2-15 characters
	if (word.length < 2 || word.length > 15) return false
	// Must be uppercase letters (primary) with optional digits
	if (!/^[A-Z0-9]+$/.test(word)) return false
	// Must start with a letter
	if (!/^[A-Z]/.test(word)) return false
	return true
}

/**
 * Validate a Connections puzzle from LLM output
 *
 * Validation levels:
 * - HARD FAIL (errors): Invalid structure, inappropriate words, duplicates
 * - SOFT WARN (warnings): Words not in dictionary (might be valid proper nouns)
 */
export function validateConnectionsPuzzle(
	raw: RawConnectionsPuzzle,
	puzzleId: string,
	puzzleDate: string,
): ConnectionsValidationResult {
	const errors: string[] = []
	const warnings: string[] = []

	// Check categories exist
	if (!raw.categories || !Array.isArray(raw.categories)) {
		return {
			valid: false,
			errors: ['Missing or invalid categories array'],
			warnings: [],
		}
	}

	// Check exactly 4 categories
	if (raw.categories.length !== 4) {
		errors.push(`Expected 4 categories, got ${raw.categories.length}`)
	}

	const allWords: string[] = []
	const levels = new Set<number>()
	const validatedCategories: Category[] = []

	for (let i = 0; i < raw.categories.length; i++) {
		const cat = raw.categories[i]

		// Check category name
		if (!cat.name || typeof cat.name !== 'string') {
			errors.push(`Category ${i}: missing or invalid name`)
			continue
		}

		// Check words array
		if (!cat.words || !Array.isArray(cat.words)) {
			errors.push(`Category ${i}: missing or invalid words array`)
			continue
		}

		// Check exactly 4 words
		if (cat.words.length !== 4) {
			errors.push(`Category "${cat.name}": expected 4 words, got ${cat.words.length}`)
		}

		// Check level
		if (cat.level === undefined || cat.level < 0 || cat.level > 3) {
			errors.push(`Category "${cat.name}": invalid level ${cat.level}`)
		} else {
			levels.add(cat.level)
		}

		// Validate each word
		const validatedWords: string[] = []
		for (const word of cat.words) {
			const upperWord = String(word).toUpperCase().trim()

			// HARD FAIL: Invalid format
			if (!isValidWordFormat(upperWord)) {
				errors.push(`Category "${cat.name}": invalid word format "${word}"`)
				continue
			}

			// HARD FAIL: Inappropriate content
			if (!isAppropriateWord(upperWord)) {
				errors.push(`Category "${cat.name}": inappropriate word "${word}"`)
				continue
			}

			// HARD FAIL: Duplicate
			if (allWords.includes(upperWord)) {
				errors.push(`Duplicate word: "${upperWord}"`)
				continue
			}

			// SOFT WARN: Not in dictionary (might be valid proper noun/brand)
			if (!isInDictionary(upperWord)) {
				warnings.push(`Word "${upperWord}" not in dictionary (may be valid proper noun)`)
			}

			allWords.push(upperWord)
			validatedWords.push(upperWord)
		}

		if (validatedWords.length === 4) {
			validatedCategories.push({
				name: cat.name.toUpperCase(),
				words: validatedWords,
				level: cat.level as CategoryLevel,
			})
		}
	}

	// Check all 4 difficulty levels are present
	if (levels.size !== 4) {
		errors.push(
			`Expected all 4 difficulty levels (0-3), got levels: ${Array.from(levels).sort().join(', ')}`,
		)
	}

	// Check total unique words
	if (allWords.length !== 16) {
		errors.push(`Expected 16 unique words, got ${allWords.length}`)
	}

	// If no critical errors, construct the puzzle
	if (validatedCategories.length === 4 && allWords.length === 16) {
		// Sort categories by level
		validatedCategories.sort((a, b) => a.level - b.level)

		const puzzle: ConnectionsPuzzle = {
			id: puzzleId,
			date: puzzleDate,
			categories: validatedCategories as [Category, Category, Category, Category],
		}

		// Log warnings if any (for monitoring, but puzzle is still valid)
		if (warnings.length > 0) {
			console.warn(
				`[Connections Validator] ${puzzleId} has ${warnings.length} warning(s):`,
				warnings,
			)
		}

		return { valid: true, errors, warnings, puzzle }
	}

	return { valid: false, errors, warnings }
}

/**
 * Parse JSON from LLM response (handles markdown code blocks)
 */
export const parseConnectionsResponse = (response: string) =>
	parseLlmJsonResponse<RawConnectionsPuzzle>(response)
