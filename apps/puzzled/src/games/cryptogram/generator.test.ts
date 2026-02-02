/**
 * Cryptogram Generator Tests
 *
 * Tests for the cryptogram puzzle generation using substitution ciphers.
 * Verifies quote selection, cipher creation, and encryption correctness.
 */

import { describe, expect, test } from 'bun:test'
import { generateCryptogramPuzzle, getQuoteCount } from './generator'

// ============================================================================
// Quote Pool Tests
// ============================================================================

describe('quote pool', () => {
	test('has substantial number of quotes', () => {
		const count = getQuoteCount()
		// Should have 40+ quotes based on the implementation
		expect(count).toBeGreaterThan(40)
	})

	test('count is consistent across calls', () => {
		const count1 = getQuoteCount()
		const count2 = getQuoteCount()
		expect(count1).toBe(count2)
	})
})

// ============================================================================
// Puzzle Generation Tests
// ============================================================================

describe('generateCryptogramPuzzle', () => {
	describe('determinism', () => {
		test('same seed produces same puzzle', () => {
			const puzzle1 = generateCryptogramPuzzle(12345)
			const puzzle2 = generateCryptogramPuzzle(12345)

			expect(puzzle1.puzzleData.encryptedText).toBe(puzzle2.puzzleData.encryptedText)
			expect(puzzle1.puzzleData.author).toBe(puzzle2.puzzleData.author)
			expect(puzzle1.solution.originalText).toBe(puzzle2.solution.originalText)
			expect(puzzle1.solution.cipher).toEqual(puzzle2.solution.cipher)
		})

		test('different seeds produce different puzzles', () => {
			const puzzle1 = generateCryptogramPuzzle(0)
			const puzzle2 = generateCryptogramPuzzle(10)

			// Different quotes or different ciphers
			const different =
				puzzle1.solution.originalText !== puzzle2.solution.originalText ||
				puzzle1.puzzleData.encryptedText !== puzzle2.puzzleData.encryptedText

			expect(different).toBe(true)
		})
	})

	describe('puzzle structure', () => {
		test('has encrypted text', () => {
			const puzzle = generateCryptogramPuzzle(42)

			expect(puzzle.puzzleData.encryptedText).toBeDefined()
			expect(typeof puzzle.puzzleData.encryptedText).toBe('string')
			expect(puzzle.puzzleData.encryptedText.length).toBeGreaterThan(0)
		})

		test('has author', () => {
			const puzzle = generateCryptogramPuzzle(42)

			expect(puzzle.puzzleData.author).toBeDefined()
			expect(typeof puzzle.puzzleData.author).toBe('string')
			expect(puzzle.puzzleData.author.length).toBeGreaterThan(0)
		})

		test('has category', () => {
			const puzzle = generateCryptogramPuzzle(42)

			expect(puzzle.puzzleData.category).toBeDefined()
			expect(typeof puzzle.puzzleData.category).toBe('string')
		})

		test('has unique letter count', () => {
			const puzzle = generateCryptogramPuzzle(42)

			expect(puzzle.puzzleData.uniqueLetters).toBeDefined()
			expect(typeof puzzle.puzzleData.uniqueLetters).toBe('number')
			expect(puzzle.puzzleData.uniqueLetters).toBeGreaterThan(0)
			expect(puzzle.puzzleData.uniqueLetters).toBeLessThanOrEqual(26)
		})

		test('has max hints', () => {
			const puzzle = generateCryptogramPuzzle(42)

			expect(puzzle.puzzleData.maxHints).toBeDefined()
			expect(typeof puzzle.puzzleData.maxHints).toBe('number')
			expect(puzzle.puzzleData.maxHints).toBeGreaterThan(0)
		})
	})

	describe('solution structure', () => {
		test('has original text', () => {
			const puzzle = generateCryptogramPuzzle(42)

			expect(puzzle.solution.originalText).toBeDefined()
			expect(typeof puzzle.solution.originalText).toBe('string')
		})

		test('original text is uppercase', () => {
			const puzzle = generateCryptogramPuzzle(42)

			const originalText = puzzle.solution.originalText
			const uppercaseLetters = originalText.match(/[A-Z]/g) || []
			const lowercaseLetters = originalText.match(/[a-z]/g) || []

			expect(uppercaseLetters.length).toBeGreaterThan(0)
			expect(lowercaseLetters.length).toBe(0)
		})

		test('has cipher mapping', () => {
			const puzzle = generateCryptogramPuzzle(42)

			expect(puzzle.solution.cipher).toBeDefined()
			expect(typeof puzzle.solution.cipher).toBe('object')
		})

		test('has reverse cipher mapping', () => {
			const puzzle = generateCryptogramPuzzle(42)

			expect(puzzle.solution.reverseCipher).toBeDefined()
			expect(typeof puzzle.solution.reverseCipher).toBe('object')
		})
	})

	describe('cipher validity', () => {
		test('cipher is a bijection (one-to-one)', () => {
			const puzzle = generateCryptogramPuzzle(42)
			const cipher = puzzle.solution.cipher

			const values = Object.values(cipher)
			const uniqueValues = new Set(values)

			// Each letter maps to unique letter
			expect(uniqueValues.size).toBe(values.length)
		})

		test('reverse cipher inverts cipher', () => {
			const puzzle = generateCryptogramPuzzle(42)
			const cipher = puzzle.solution.cipher
			const reverse = puzzle.solution.reverseCipher

			for (const [plain, encrypted] of Object.entries(cipher)) {
				expect(reverse[encrypted]).toBe(plain)
			}
		})

		test('cipher covers all 26 letters', () => {
			const puzzle = generateCryptogramPuzzle(42)
			const cipher = puzzle.solution.cipher

			expect(Object.keys(cipher).length).toBe(26)

			const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
			for (const letter of alphabet) {
				expect(cipher[letter]).toBeDefined()
			}
		})
	})

	describe('encryption validity', () => {
		test('encrypted text can be decrypted to original', () => {
			for (let seed = 0; seed < 20; seed++) {
				const puzzle = generateCryptogramPuzzle(seed)
				const encrypted = puzzle.puzzleData.encryptedText
				const reverse = puzzle.solution.reverseCipher
				const original = puzzle.solution.originalText

				// Decrypt the encrypted text
				let decrypted = ''
				for (const char of encrypted) {
					if (char >= 'A' && char <= 'Z') {
						decrypted += reverse[char]
					} else {
						decrypted += char
					}
				}

				expect(decrypted).toBe(original)
			}
		})

		test('encrypted text preserves non-letters', () => {
			for (let seed = 0; seed < 10; seed++) {
				const puzzle = generateCryptogramPuzzle(seed)
				const encrypted = puzzle.puzzleData.encryptedText
				const original = puzzle.solution.originalText

				// Non-letter characters should be in same positions
				for (let i = 0; i < original.length; i++) {
					const origChar = original[i]
					if (!(origChar >= 'A' && origChar <= 'Z')) {
						expect(encrypted[i]).toBe(origChar)
					}
				}
			}
		})

		test('encrypted text same length as original', () => {
			for (let seed = 0; seed < 10; seed++) {
				const puzzle = generateCryptogramPuzzle(seed)

				expect(puzzle.puzzleData.encryptedText.length).toBe(puzzle.solution.originalText.length)
			}
		})
	})

	describe('quote selection', () => {
		test('quotes cycle through pool', () => {
			const quoteCount = getQuoteCount()
			const puzzle1 = generateCryptogramPuzzle(0)
			const puzzle2 = generateCryptogramPuzzle(quoteCount)

			// Should wrap around to same quote
			expect(puzzle1.solution.originalText).toBe(puzzle2.solution.originalText)
		})

		test('consecutive seeds select different quotes', () => {
			const quotes = new Set<string>()

			for (let seed = 0; seed < 20; seed++) {
				const puzzle = generateCryptogramPuzzle(seed)
				quotes.add(puzzle.solution.originalText)
			}

			// Should have 20 different quotes (or close if pool is smaller)
			expect(quotes.size).toBe(20)
		})
	})
})

// ============================================================================
// Category Tests
// ============================================================================

describe('cryptogram categories', () => {
	test('puzzles have valid categories', () => {
		const validCategories = [
			'Inspiration',
			'Wisdom',
			'Science',
			'Literature',
			'Life',
			'Success',
			'Creativity',
			'Philosophy',
			'Courage',
			'Humor',
		]

		for (let seed = 0; seed < 30; seed++) {
			const puzzle = generateCryptogramPuzzle(seed)
			expect(validCategories).toContain(puzzle.puzzleData.category)
		}
	})

	test('multiple categories represented', () => {
		const categories = new Set<string>()

		for (let seed = 0; seed < 50; seed++) {
			const puzzle = generateCryptogramPuzzle(seed)
			categories.add(puzzle.puzzleData.category)
		}

		// Should have variety of categories
		expect(categories.size).toBeGreaterThan(5)
	})
})

// ============================================================================
// Integration Tests
// ============================================================================

describe('cryptogram integration', () => {
	test('daily puzzle simulation', () => {
		const dailyPuzzles = Array.from({ length: 7 }, (_, day) => {
			return generateCryptogramPuzzle(20240101 + day)
		})

		for (const puzzle of dailyPuzzles) {
			expect(puzzle.puzzleData.encryptedText.length).toBeGreaterThan(0)
			expect(puzzle.puzzleData.author.length).toBeGreaterThan(0)
		}
	})

	test('puzzle variety across seeds', () => {
		const uniqueQuotes = new Set<string>()
		const uniqueEncryptions = new Set<string>()

		for (let seed = 0; seed < 50; seed++) {
			const puzzle = generateCryptogramPuzzle(seed)
			uniqueQuotes.add(puzzle.solution.originalText)
			uniqueEncryptions.add(puzzle.puzzleData.encryptedText)
		}

		// Each seed should produce unique quote
		expect(uniqueQuotes.size).toBe(50)
		// Encryptions should also be unique (different ciphers)
		expect(uniqueEncryptions.size).toBe(50)
	})

	test('all quotes have reasonable length', () => {
		const quoteCount = getQuoteCount()

		for (let seed = 0; seed < quoteCount; seed++) {
			const puzzle = generateCryptogramPuzzle(seed)
			const originalLength = puzzle.solution.originalText.length

			// Quotes should be between 20 and 150 characters
			expect(originalLength).toBeGreaterThan(15)
			expect(originalLength).toBeLessThan(150)
		}
	})
})
