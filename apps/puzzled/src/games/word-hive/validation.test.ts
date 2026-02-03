/**
 * Word Hive (Spelling Bee) Validation Tests
 *
 * Tests for the validateAndScore function which:
 * - Validates submission found words data
 * - Verifies all found words are in valid word list
 * - Calculates score based on word length and pangrams
 *
 * Scoring: Sum of word scores
 * - 4-letter words: 1 point
 * - 5+ letter words: 1 point per letter
 * - Pangrams: +7 bonus points
 */

import { describe, expect, test } from 'bun:test'
import { wordHiveConfig } from './config'
import type { GameSubmission } from '../types'

// Generate a puzzle for testing
const { puzzleData, solution } = wordHiveConfig.generatePuzzle(12345)

// Valid words from solution
const validWords = solution.validWords
const pangrams = solution.pangrams

// Helper to create submission
function createSubmission(foundWords: string[], timeSpentMs = 60000): GameSubmission {
	return {
		status: 'won', // Spelling Bee always completes as 'won'
		attempts: foundWords.length,
		timeSpentMs,
		data: { foundWords },
	}
}

describe('word-hive validateAndScore', () => {
	describe('valid solutions', () => {
		test('finding one 4-letter word scores 1 point', () => {
			// Find a 4-letter word
			const fourLetterWord = validWords.find((w) => w.length === 4)
			if (fourLetterWord) {
				const submission = createSubmission([fourLetterWord])
				const result = wordHiveConfig.validateAndScore(solution, puzzleData, submission)

				expect(result.valid).toBe(true)
				if (result.valid) {
					expect(result.status).toBe('won')
					expect(result.score).toBe(1)
				}
			}
		})

		test('finding one 5-letter word scores 5 points', () => {
			// Find a 5-letter non-pangram word
			const fiveLetterWord = validWords.find((w) => w.length === 5 && !pangrams.includes(w))
			if (fiveLetterWord) {
				const submission = createSubmission([fiveLetterWord])
				const result = wordHiveConfig.validateAndScore(solution, puzzleData, submission)

				expect(result.valid).toBe(true)
				if (result.valid) {
					expect(result.status).toBe('won')
					expect(result.score).toBe(5)
				}
			}
		})

		test('finding a pangram scores word length + 7 bonus', () => {
			if (pangrams.length > 0) {
				const pangram = pangrams[0]
				const submission = createSubmission([pangram])
				const result = wordHiveConfig.validateAndScore(solution, puzzleData, submission)

				expect(result.valid).toBe(true)
				if (result.valid) {
					expect(result.status).toBe('won')
					expect(result.score).toBe(pangram.length + 7)
				}
			}
		})

		test('finding multiple words sums scores', () => {
			// Find a few words of different lengths
			const fourLetter = validWords.find((w) => w.length === 4 && !pangrams.includes(w))
			const fiveLetter = validWords.find((w) => w.length === 5 && !pangrams.includes(w))

			if (fourLetter && fiveLetter) {
				const submission = createSubmission([fourLetter, fiveLetter])
				const result = wordHiveConfig.validateAndScore(solution, puzzleData, submission)

				expect(result.valid).toBe(true)
				if (result.valid) {
					expect(result.status).toBe('won')
					expect(result.score).toBe(1 + 5) // 1 for 4-letter, 5 for 5-letter
				}
			}
		})

		test('finding all words calculates correct total', () => {
			const submission = createSubmission(validWords)
			const result = wordHiveConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(true)
			if (result.valid) {
				expect(result.status).toBe('won')
				// Calculate expected score
				let expectedScore = 0
				for (const word of validWords) {
					const isPangram = pangrams.includes(word)
					if (word.length === 4) {
						expectedScore += 1
					} else {
						expectedScore += word.length
					}
					if (isPangram) {
						expectedScore += 7
					}
				}
				expect(result.score).toBe(expectedScore)
			}
		})

		test('empty found words scores 0 points', () => {
			const submission = createSubmission([])
			const result = wordHiveConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(true)
			if (result.valid) {
				expect(result.status).toBe('won') // Spelling Bee always 'won'
				expect(result.score).toBe(0)
			}
		})
	})

	describe('invalid submissions', () => {
		test('rejects missing foundWords data', () => {
			const submission: GameSubmission = {
				status: 'won',
				attempts: 0,
				timeSpentMs: 60000,
				data: {},
			}
			const result = wordHiveConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(false)
			if (!result.valid) {
				expect(result.error).toContain('Missing found words')
			}
		})

		test('rejects invalid word claim', () => {
			const submission = createSubmission(['NOTINWORDLIST'])
			const result = wordHiveConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(false)
			if (!result.valid) {
				expect(result.error).toContain('Invalid word claim')
			}
		})

		test('rejects mix of valid and invalid words', () => {
			if (validWords.length > 0) {
				const submission = createSubmission([validWords[0], 'INVALIDXYZ'])
				const result = wordHiveConfig.validateAndScore(solution, puzzleData, submission)

				expect(result.valid).toBe(false)
			}
		})
	})

	describe('edge cases', () => {
		test('handles null data', () => {
			const submission: GameSubmission = {
				status: 'won',
				attempts: 0,
				timeSpentMs: 60000,
				data: null,
			}
			const result = wordHiveConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(false)
		})

		test('handles lowercase found words', () => {
			if (validWords.length > 0) {
				const lowercaseWords = validWords.slice(0, 3).map((w) => w.toLowerCase())
				const submission = createSubmission(lowercaseWords)
				const result = wordHiveConfig.validateAndScore(solution, puzzleData, submission)

				expect(result.valid).toBe(true)
			}
		})

		test('handles mixed case found words', () => {
			if (validWords.length > 0) {
				const mixedCaseWord = validWords[0].charAt(0) + validWords[0].slice(1).toLowerCase()
				const submission = createSubmission([mixedCaseWord])
				const result = wordHiveConfig.validateAndScore(solution, puzzleData, submission)

				expect(result.valid).toBe(true)
			}
		})

		test('spelling bee always returns won status', () => {
			// Even with no words found, status is 'won' (ranks determine quality)
			const submission = createSubmission([])
			const result = wordHiveConfig.validateAndScore(solution, puzzleData, submission)

			expect(result.valid).toBe(true)
			if (result.valid) {
				expect(result.status).toBe('won')
			}
		})
	})
})
