/**
 * Quordle (Quad-Words) Generator Tests
 *
 * Tests for the 4-word puzzle generation.
 * Verifies word selection, uniqueness, and determinism.
 */

import { describe, expect, test } from "bun:test";
import { generateQuordlePuzzle } from "./generator";

// ============================================================================
// Puzzle Generation Tests
// ============================================================================

describe("generateQuordlePuzzle", () => {
	describe("determinism", () => {
		test("same seed produces same puzzle", () => {
			const puzzle1 = generateQuordlePuzzle(12345);
			const puzzle2 = generateQuordlePuzzle(12345);

			expect(puzzle1.puzzleData.words).toEqual(puzzle2.puzzleData.words);
			expect(puzzle1.solution.words).toEqual(puzzle2.solution.words);
		});

		test("different seeds produce different puzzles", () => {
			const puzzle1 = generateQuordlePuzzle(100);
			const puzzle2 = generateQuordlePuzzle(200);

			// At least one word should differ
			const same =
				JSON.stringify(puzzle1.puzzleData.words) ===
				JSON.stringify(puzzle2.puzzleData.words);
			expect(same).toBe(false);
		});
	});

	describe("puzzle structure", () => {
		test("has exactly 4 words", () => {
			for (let seed = 0; seed < 30; seed++) {
				const puzzle = generateQuordlePuzzle(seed);
				expect(puzzle.puzzleData.words.length).toBe(4);
				expect(puzzle.solution.words.length).toBe(4);
			}
		});

		test("all words are at least 4 letters", () => {
			for (let seed = 0; seed < 30; seed++) {
				const puzzle = generateQuordlePuzzle(seed);

				for (const word of puzzle.puzzleData.words) {
					expect(word.length).toBeGreaterThanOrEqual(4);
				}
			}
		});

		test("all words are uppercase", () => {
			for (let seed = 0; seed < 30; seed++) {
				const puzzle = generateQuordlePuzzle(seed);

				for (const word of puzzle.puzzleData.words) {
					expect(word).toBe(word.toUpperCase());
				}
			}
		});

		test("all words contain only letters", () => {
			for (let seed = 0; seed < 30; seed++) {
				const puzzle = generateQuordlePuzzle(seed);

				for (const word of puzzle.puzzleData.words) {
					expect(word).toMatch(/^[A-Z]+$/);
				}
			}
		});
	});

	describe("word uniqueness", () => {
		test("all 4 words are unique within a puzzle", () => {
			for (let seed = 0; seed < 50; seed++) {
				const puzzle = generateQuordlePuzzle(seed);
				const words = puzzle.puzzleData.words;

				const uniqueWords = new Set(words);
				expect(uniqueWords.size).toBe(4);
			}
		});
	});

	describe("solution consistency", () => {
		test("puzzleData and solution contain same words", () => {
			for (let seed = 0; seed < 30; seed++) {
				const puzzle = generateQuordlePuzzle(seed);

				expect(puzzle.puzzleData.words).toEqual(puzzle.solution.words);
			}
		});

		test("words tuple type is enforced", () => {
			const puzzle = generateQuordlePuzzle(42);

			// TypeScript ensures this is a 4-tuple
			const [word1, word2, word3, word4] = puzzle.puzzleData.words;
			expect(word1).toBeDefined();
			expect(word2).toBeDefined();
			expect(word3).toBeDefined();
			expect(word4).toBeDefined();
		});
	});

	describe("word variety", () => {
		test("different seeds select different word combinations", () => {
			const seenCombinations = new Set<string>();

			for (let seed = 0; seed < 100; seed++) {
				const puzzle = generateQuordlePuzzle(seed);
				const key = puzzle.puzzleData.words.slice().sort().join("-");
				seenCombinations.add(key);
			}

			// Should have high variety
			expect(seenCombinations.size).toBeGreaterThan(90);
		});

		test("word pool contains common English words", () => {
			// Collect unique words across many puzzles
			const seenWords = new Set<string>();

			for (let seed = 0; seed < 50; seed++) {
				const puzzle = generateQuordlePuzzle(seed);
				for (const word of puzzle.puzzleData.words) {
					seenWords.add(word);
				}
			}

			// Should see a variety of words
			expect(seenWords.size).toBeGreaterThan(100);
		});
	});

	describe("edge cases", () => {
		test("seed 0 produces valid puzzle", () => {
			const puzzle = generateQuordlePuzzle(0);

			expect(puzzle.puzzleData.words.length).toBe(4);
			expect(puzzle.solution.words.length).toBe(4);
		});

		test("negative seeds produce valid puzzles", () => {
			const puzzle = generateQuordlePuzzle(-12345);

			expect(puzzle.puzzleData.words.length).toBe(4);
			for (const word of puzzle.puzzleData.words) {
				expect(word.length).toBe(5);
			}
		});

		test("large seeds produce valid puzzles", () => {
			const puzzle = generateQuordlePuzzle(999999999);

			expect(puzzle.puzzleData.words.length).toBe(4);
			for (const word of puzzle.puzzleData.words) {
				expect(word.length).toBe(5);
			}
		});
	});
});

// ============================================================================
// Integration Tests
// ============================================================================

describe("quordle integration", () => {
	test("daily puzzle simulation", () => {
		const dailyPuzzles = Array.from({ length: 30 }, (_, day) => {
			return generateQuordlePuzzle(20240101 + day);
		});

		for (const puzzle of dailyPuzzles) {
			expect(puzzle.puzzleData.words.length).toBe(4);

			// All words unique within puzzle
			const uniqueWords = new Set(puzzle.puzzleData.words);
			expect(uniqueWords.size).toBe(4);
		}
	});

	test("puzzles are playable (real English words)", () => {
		// Spot check that words look like real English words
		const commonPatterns = [
			/[AEIOU]/, // Has vowels
			/[BCDFGHJKLMNPQRSTVWXYZ]/, // Has consonants
		];

		for (let seed = 0; seed < 20; seed++) {
			const puzzle = generateQuordlePuzzle(seed);

			for (const word of puzzle.puzzleData.words) {
				for (const pattern of commonPatterns) {
					expect(word).toMatch(pattern);
				}
			}
		}
	});

	test("no obvious duplicates across consecutive daily puzzles", () => {
		const dailyPuzzles = Array.from({ length: 7 }, (_, day) => {
			return generateQuordlePuzzle(20240101 + day);
		});

		// Check that consecutive days don't share all 4 words
		for (let i = 1; i < dailyPuzzles.length; i++) {
			const prev = new Set(dailyPuzzles[i - 1].puzzleData.words);
			const curr = dailyPuzzles[i].puzzleData.words;

			const shared = curr.filter((w) => prev.has(w));
			// Unlikely to share more than 1-2 words by chance
			expect(shared.length).toBeLessThan(4);
		}
	});
});
