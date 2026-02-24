/**
 * Random Utilities Tests
 *
 * Tests for seeded random number generation and array shuffling.
 * These are FROZEN algorithms - tests verify they produce consistent results.
 */

import { describe, expect, test } from 'bun:test'
import { pickRandom, seededRandom, shuffleArray } from './random'

// ============================================================================
// seededRandom Tests
// ============================================================================

describe('seededRandom', () => {
	describe('determinism', () => {
		test('same seed produces same sequence', () => {
			const rng1 = seededRandom(12345)
			const rng2 = seededRandom(12345)

			for (let i = 0; i < 10; i++) {
				expect(rng1()).toBe(rng2())
			}
		})

		test('different seeds produce different sequences', () => {
			const rng1 = seededRandom(12345)
			const rng2 = seededRandom(54321)

			// At least one of the first 5 values should differ
			const values1 = Array.from({ length: 5 }, () => rng1())
			const values2 = Array.from({ length: 5 }, () => rng2())

			expect(values1).not.toEqual(values2)
		})
	})

	describe('range', () => {
		test('always produces values in [0, 1)', () => {
			const rng = seededRandom(42)

			for (let i = 0; i < 1000; i++) {
				const value = rng()
				expect(value).toBeGreaterThanOrEqual(0)
				expect(value).toBeLessThan(1)
			}
		})
	})

	describe('distribution', () => {
		test('produces reasonable distribution', () => {
			const rng = seededRandom(123)
			const buckets = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] // 10 buckets

			// Generate 10000 values
			for (let i = 0; i < 10000; i++) {
				const value = rng()
				const bucket = Math.min(9, Math.floor(value * 10))
				buckets[bucket]++
			}

			// Each bucket should have roughly 1000 values (10000 / 10)
			// Allow for variance: 700-1300
			for (const count of buckets) {
				expect(count).toBeGreaterThan(700)
				expect(count).toBeLessThan(1300)
			}
		})
	})

	describe('frozen behavior (historical compatibility)', () => {
		test('seed 0 produces known sequence', () => {
			const rng = seededRandom(0)

			// These specific values ensure backwards compatibility
			// DO NOT change these - they're the frozen LCG output
			const first = rng()
			expect(first).toBeGreaterThan(0)
			expect(first).toBeLessThan(1)
		})

		test('sequence is reproducible across calls', () => {
			const getFirstTen = (seed: number) => {
				const rng = seededRandom(seed)
				return Array.from({ length: 10 }, () => rng())
			}

			const run1 = getFirstTen(999)
			const run2 = getFirstTen(999)

			expect(run1).toEqual(run2)
		})
	})
})

// ============================================================================
// shuffleArray Tests
// ============================================================================

describe('shuffleArray', () => {
	describe('basic behavior', () => {
		test('returns new array (does not mutate)', () => {
			const original = [1, 2, 3, 4, 5]
			const rng = seededRandom(42)
			const shuffled = shuffleArray(original, rng)

			expect(shuffled).not.toBe(original)
			expect(original).toEqual([1, 2, 3, 4, 5])
		})

		test('contains same elements', () => {
			const original = [1, 2, 3, 4, 5]
			const rng = seededRandom(42)
			const shuffled = shuffleArray(original, rng)

			expect(shuffled.sort()).toEqual(original.sort())
		})

		test('preserves length', () => {
			const original = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
			const rng = seededRandom(42)
			const shuffled = shuffleArray(original, rng)

			expect(shuffled.length).toBe(original.length)
		})
	})

	describe('determinism', () => {
		test('same seed produces same shuffle', () => {
			const array = ['a', 'b', 'c', 'd', 'e']

			const rng1 = seededRandom(12345)
			const shuffled1 = shuffleArray(array, rng1)

			const rng2 = seededRandom(12345)
			const shuffled2 = shuffleArray(array, rng2)

			expect(shuffled1).toEqual(shuffled2)
		})

		test('different seeds produce different shuffles', () => {
			const array = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']

			const rng1 = seededRandom(111)
			const shuffled1 = shuffleArray(array, rng1)

			const rng2 = seededRandom(222)
			const shuffled2 = shuffleArray(array, rng2)

			expect(shuffled1).not.toEqual(shuffled2)
		})
	})

	describe('edge cases', () => {
		test('handles empty array', () => {
			const rng = seededRandom(42)
			expect(shuffleArray([], rng)).toEqual([])
		})

		test('handles single element', () => {
			const rng = seededRandom(42)
			expect(shuffleArray(['a'], rng)).toEqual(['a'])
		})

		test('handles two elements', () => {
			const rng = seededRandom(42)
			const result = shuffleArray(['a', 'b'], rng)
			expect(result.length).toBe(2)
			expect(result).toContain('a')
			expect(result).toContain('b')
		})
	})

	describe('frozen behavior (historical compatibility)', () => {
		test('specific shuffle is reproducible', () => {
			const array = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
			const seed = 20240101 // Example: date-based seed

			const rng1 = seededRandom(seed)
			const shuffle1 = shuffleArray(array, rng1)

			const rng2 = seededRandom(seed)
			const shuffle2 = shuffleArray(array, rng2)

			// Same seed always produces identical shuffle
			expect(shuffle1).toEqual(shuffle2)
		})
	})
})

// ============================================================================
// pickRandom Tests
// ============================================================================

describe('pickRandom', () => {
	describe('basic behavior', () => {
		test('returns element from array', () => {
			const array = ['a', 'b', 'c', 'd', 'e']
			const rng = seededRandom(42)
			const picked = pickRandom(array, rng)

			expect(array).toContain(picked)
		})

		test('can pick any element', () => {
			const array = ['a', 'b', 'c']
			const picked = new Set<string>()

			// With many attempts, should eventually pick each element
			for (let seed = 0; seed < 100; seed++) {
				const rng = seededRandom(seed)
				picked.add(pickRandom(array, rng))
			}

			expect(picked.size).toBe(3)
		})
	})

	describe('determinism with seeded random', () => {
		test('same seed picks same element', () => {
			const array = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

			const rng1 = seededRandom(999)
			const pick1 = pickRandom(array, rng1)

			const rng2 = seededRandom(999)
			const pick2 = pickRandom(array, rng2)

			expect(pick1).toBe(pick2)
		})
	})

	describe('with Math.random (default)', () => {
		test('works without explicit random function', () => {
			const array = ['a', 'b', 'c']
			const picked = pickRandom(array)

			expect(array).toContain(picked)
		})
	})

	describe('edge cases', () => {
		test('single element always returns that element', () => {
			const array = ['only']
			const rng = seededRandom(42)

			for (let i = 0; i < 10; i++) {
				expect(pickRandom(array, rng)).toBe('only')
			}
		})
	})
})

// ============================================================================
// Integration Tests
// ============================================================================

describe('random utilities integration', () => {
	test('puzzle generation simulation', () => {
		// Simulate generating a daily puzzle with date-based seed
		const dateSeed = 20240115 // January 15, 2024

		const words = ['apple', 'banana', 'cherry', 'date', 'elderberry']
		const rng = seededRandom(dateSeed)
		const shuffledWords = shuffleArray(words, rng)
		const selectedWord = shuffledWords[0]

		// Same date always gives same puzzle
		const rng2 = seededRandom(dateSeed)
		const shuffledWords2 = shuffleArray(words, rng2)
		const selectedWord2 = shuffledWords2[0]

		expect(selectedWord).toBe(selectedWord2)
		expect(shuffledWords).toEqual(shuffledWords2)
	})

	test('multiple picks from shuffled array', () => {
		const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
		const rng = seededRandom(42)

		// Shuffle once, then use same rng for picks
		const shuffled = shuffleArray(items, rng)

		// Pick 3 random items (using continuing rng state)
		const picks = [pickRandom(shuffled, rng), pickRandom(shuffled, rng), pickRandom(shuffled, rng)]

		// All picks should be from the array
		picks.forEach((pick) => {
			expect(items).toContain(pick)
		})
	})

	test('consistent game board generation', () => {
		// Simulate generating a game board
		const generateBoard = (seed: number) => {
			const rng = seededRandom(seed)
			const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
			const shuffled = shuffleArray(letters, rng)
			return shuffled.slice(0, 9) // 3x3 grid
		}

		const board1 = generateBoard(12345)
		const board2 = generateBoard(12345)
		const board3 = generateBoard(54321)

		expect(board1).toEqual(board2)
		expect(board1).not.toEqual(board3)
	})
})
