/**
 * Crossword Mini (Word Square) Puzzle Validator
 *
 * Validates LLM-generated 5×5 word squares where every row AND column
 * forms a valid English word.
 */

import 'server-only'

import { readFileSync } from 'node:fs'
import wordListPath from 'word-list'
import { parseLlmJsonResponse } from '../parse-utils'

// Load English dictionary once
let wordSet: Set<string> | null = null

function getWordSet(): Set<string> {
	if (!wordSet) {
		const words = readFileSync(wordListPath, 'utf8').split('\n')
		wordSet = new Set(words.map((w) => w.toLowerCase().trim()).filter((w) => w.length > 0))
	}
	return wordSet
}

/**
 * Check if a word is valid English
 */
function isValidWord(word: string): boolean {
	return getWordSet().has(word.toLowerCase())
}

/**
 * Raw LLM response structure
 */
export type RawCrosswordPuzzle = {
	grid: string[][]
	clues: {
		across: { number: number; clue: string }[]
		down: { number: number; clue: string }[]
	}
}

/**
 * Validation result with puzzle data if valid
 */
export type CrosswordValidationResult = {
	valid: boolean
	errors: string[]
	puzzleData?: {
		grid: (string | null)[][] // For client, nulls for structure
		clues: {
			across: {
				number: number
				clue: string
				answer: string
				row: number
				col: number
				length: number
			}[]
			down: {
				number: number
				clue: string
				answer: string
				row: number
				col: number
				length: number
			}[]
		}
	}
	solution?: {
		grid: string[][]
	}
}

/**
 * Parse LLM response into raw puzzle structure
 */
export function parseCrosswordResponse(response: string): RawCrosswordPuzzle | null {
	const parsed = parseLlmJsonResponse<RawCrosswordPuzzle>(response)
	if (!parsed) return null

	// Basic structure validation
	if (!parsed.grid || !Array.isArray(parsed.grid)) return null
	if (!parsed.clues || !parsed.clues.across || !parsed.clues.down) return null

	return parsed
}

/**
 * Validate a parsed crossword puzzle
 */
export function validateCrosswordPuzzle(raw: RawCrosswordPuzzle): CrosswordValidationResult {
	const errors: string[] = []

	// 1. Validate grid dimensions (5×5)
	if (raw.grid.length !== 5) {
		errors.push(`Grid must have exactly 5 rows, got ${raw.grid.length}`)
	}

	for (let row = 0; row < raw.grid.length; row++) {
		if (!Array.isArray(raw.grid[row]) || raw.grid[row].length !== 5) {
			errors.push(`Row ${row + 1} must have exactly 5 columns`)
		}
	}

	if (errors.length > 0) {
		return { valid: false, errors }
	}

	// 2. Validate all cells are uppercase letters
	for (let row = 0; row < 5; row++) {
		for (let col = 0; col < 5; col++) {
			const cell = raw.grid[row][col]
			if (typeof cell !== 'string' || !/^[A-Z]$/.test(cell)) {
				errors.push(`Cell (${row + 1},${col + 1}) must be uppercase letter, got "${cell}"`)
			}
		}
	}

	if (errors.length > 0) {
		return { valid: false, errors }
	}

	// 3. Extract and validate all words
	const acrossWords: string[] = []
	const downWords: string[] = []

	// Get across words (rows)
	for (let row = 0; row < 5; row++) {
		acrossWords.push(raw.grid[row].join(''))
	}

	// Get down words (columns)
	for (let col = 0; col < 5; col++) {
		let word = ''
		for (let row = 0; row < 5; row++) {
			word += raw.grid[row][col]
		}
		downWords.push(word)
	}

	// Validate all across words
	const invalidAcross: string[] = []
	for (const word of acrossWords) {
		if (!isValidWord(word)) {
			invalidAcross.push(word)
		}
	}

	// Validate all down words
	const invalidDown: string[] = []
	for (const word of downWords) {
		if (!isValidWord(word)) {
			invalidDown.push(word)
		}
	}

	if (invalidAcross.length > 0) {
		errors.push(`Invalid across words: ${invalidAcross.join(', ')}`)
	}
	if (invalidDown.length > 0) {
		errors.push(`Invalid down words: ${invalidDown.join(', ')}`)
	}

	// 4. Validate clue structure
	if (!Array.isArray(raw.clues.across) || raw.clues.across.length !== 5) {
		errors.push(`Must have exactly 5 across clues, got ${raw.clues.across?.length || 0}`)
	}
	if (!Array.isArray(raw.clues.down) || raw.clues.down.length !== 5) {
		errors.push(`Must have exactly 5 down clues, got ${raw.clues.down?.length || 0}`)
	}

	// Validate each clue has number and clue text
	for (const clue of raw.clues.across) {
		if (typeof clue.number !== 'number' || typeof clue.clue !== 'string' || !clue.clue.trim()) {
			errors.push(`Invalid across clue structure: ${JSON.stringify(clue)}`)
		}
	}
	for (const clue of raw.clues.down) {
		if (typeof clue.number !== 'number' || typeof clue.clue !== 'string' || !clue.clue.trim()) {
			errors.push(`Invalid down clue structure: ${JSON.stringify(clue)}`)
		}
	}

	if (errors.length > 0) {
		return { valid: false, errors }
	}

	// 5. Build puzzle data with proper numbering
	// For a 5x5 word square: 1-across/down at (0,0), then 2-5 down for cols 1-4,
	// then 6-9 across for rows 1-4
	const acrossClues = acrossWords.map((word, row) => ({
		number: row === 0 ? 1 : row + 5,
		clue: raw.clues.across[row]?.clue || '',
		answer: word,
		row,
		col: 0,
		length: 5,
	}))

	const downClues = downWords.map((word, col) => ({
		number: col + 1,
		clue: raw.clues.down[col]?.clue || '',
		answer: word,
		row: 0,
		col,
		length: 5,
	}))

	// Client grid (empty strings for entry cells, null for black squares - none in word square)
	const clientGrid: (string | null)[][] = raw.grid.map((row) => row.map(() => ''))

	return {
		valid: true,
		errors: [],
		puzzleData: {
			grid: clientGrid,
			clues: {
				across: acrossClues,
				down: downClues,
			},
		},
		solution: {
			grid: raw.grid.map((row) => [...row]),
		},
	}
}
