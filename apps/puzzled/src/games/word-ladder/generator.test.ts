/**
 * Word Ladder Generator Tests
 *
 * Tests for the FROZEN BFS-based word ladder puzzle generation.
 * Verifies path validity, word selection, and determinism.
 */

import { describe, expect, test } from "bun:test";
import { generateWordLadderPuzzle, getPuzzleCount } from "./generator";
import { isOneLetterChange } from "./types";

// ============================================================================
// Puzzle Count Tests
// ============================================================================

describe("puzzle count", () => {
	test("returns Infinity for algorithmic generation", () => {
		const count = getPuzzleCount();
		expect(count).toBe(Number.POSITIVE_INFINITY);
	});
});

// ============================================================================
// Puzzle Generation Tests
// ============================================================================

describe("generateWordLadderPuzzle", () => {
	describe("determinism", () => {
		test("same seed produces same puzzle", () => {
			const puzzle1 = generateWordLadderPuzzle(12345);
			const puzzle2 = generateWordLadderPuzzle(12345);

			expect(puzzle1.start).toBe(puzzle2.start);
			expect(puzzle1.end).toBe(puzzle2.end);
			expect(puzzle1.path).toEqual(puzzle2.path);
		});

		test("different seeds produce different puzzles", () => {
			const puzzle1 = generateWordLadderPuzzle(100);
			const puzzle2 = generateWordLadderPuzzle(200);

			// Either start, end, or path should differ
			const same =
				puzzle1.start === puzzle2.start &&
				puzzle1.end === puzzle2.end &&
				JSON.stringify(puzzle1.path) === JSON.stringify(puzzle2.path);

			expect(same).toBe(false);
		});
	});

	describe("puzzle structure", () => {
		test("has start word", () => {
			const puzzle = generateWordLadderPuzzle(42);

			expect(puzzle.start).toBeDefined();
			expect(typeof puzzle.start).toBe("string");
			expect(puzzle.start.length).toBeGreaterThan(0);
		});

		test("has end word", () => {
			const puzzle = generateWordLadderPuzzle(42);

			expect(puzzle.end).toBeDefined();
			expect(typeof puzzle.end).toBe("string");
			expect(puzzle.end.length).toBeGreaterThan(0);
		});

		test("has path array", () => {
			const puzzle = generateWordLadderPuzzle(42);

			expect(Array.isArray(puzzle.path)).toBe(true);
			expect(puzzle.path.length).toBeGreaterThanOrEqual(2);
		});

		test("start and end are different", () => {
			for (let seed = 0; seed < 20; seed++) {
				const puzzle = generateWordLadderPuzzle(seed);
				expect(puzzle.start).not.toBe(puzzle.end);
			}
		});
	});

	describe("path validity", () => {
		test("path starts with start word", () => {
			for (let seed = 0; seed < 20; seed++) {
				const puzzle = generateWordLadderPuzzle(seed);
				expect(puzzle.path[0]).toBe(puzzle.start);
			}
		});

		test("path ends with end word", () => {
			for (let seed = 0; seed < 20; seed++) {
				const puzzle = generateWordLadderPuzzle(seed);
				expect(puzzle.path[puzzle.path.length - 1]).toBe(puzzle.end);
			}
		});

		test("each step in path differs by exactly one letter", () => {
			for (let seed = 0; seed < 20; seed++) {
				const puzzle = generateWordLadderPuzzle(seed);
				const path = puzzle.path;

				for (let i = 1; i < path.length; i++) {
					const isValid = isOneLetterChange(path[i - 1], path[i]);
					expect(isValid).toBe(true);
				}
			}
		});

		test("all words in path have same length", () => {
			for (let seed = 0; seed < 20; seed++) {
				const puzzle = generateWordLadderPuzzle(seed);
				const wordLength = puzzle.start.length;

				for (const word of puzzle.path) {
					expect(word.length).toBe(wordLength);
				}
			}
		});

		test("all words are lowercase", () => {
			for (let seed = 0; seed < 20; seed++) {
				const puzzle = generateWordLadderPuzzle(seed);

				expect(puzzle.start).toBe(puzzle.start.toLowerCase());
				expect(puzzle.end).toBe(puzzle.end.toLowerCase());

				for (const word of puzzle.path) {
					expect(word).toBe(word.toLowerCase());
				}
			}
		});
	});

	describe("path quality", () => {
		test("path length is reasonable (2-8 steps)", () => {
			for (let seed = 0; seed < 30; seed++) {
				const puzzle = generateWordLadderPuzzle(seed);

				expect(puzzle.path.length).toBeGreaterThanOrEqual(2);
				expect(puzzle.path.length).toBeLessThanOrEqual(8);
			}
		});

		test("word length is 3 or 4 letters", () => {
			for (let seed = 0; seed < 30; seed++) {
				const puzzle = generateWordLadderPuzzle(seed);
				const length = puzzle.start.length;

				expect(length === 3 || length === 4).toBe(true);
			}
		});
	});
});

// ============================================================================
// Helper Function Tests
// ============================================================================

describe("isOneLetterChange", () => {
	test("returns true for single character difference", () => {
		expect(isOneLetterChange("cat", "bat")).toBe(true);
		expect(isOneLetterChange("cat", "cot")).toBe(true);
		expect(isOneLetterChange("cat", "cap")).toBe(true);
	});

	test("returns false for identical words", () => {
		expect(isOneLetterChange("cat", "cat")).toBe(false);
	});

	test("returns false for multiple differences", () => {
		expect(isOneLetterChange("cat", "dog")).toBe(false);
		expect(isOneLetterChange("cat", "car")).toBe(true); // Only 1 diff
		expect(isOneLetterChange("cat", "bag")).toBe(false); // 2 diffs
	});

	test("returns false for different lengths", () => {
		expect(isOneLetterChange("cat", "cats")).toBe(false);
		expect(isOneLetterChange("cat", "ca")).toBe(false);
	});
});

// ============================================================================
// Integration Tests
// ============================================================================

describe("word ladder integration", () => {
	test("daily puzzle simulation", () => {
		const dailyPuzzles = Array.from({ length: 7 }, (_, day) => {
			return generateWordLadderPuzzle(20240101 + day);
		});

		for (const puzzle of dailyPuzzles) {
			// All valid
			expect(puzzle.path.length).toBeGreaterThanOrEqual(2);
			expect(puzzle.path[0]).toBe(puzzle.start);
			expect(puzzle.path[puzzle.path.length - 1]).toBe(puzzle.end);
		}
	});

	test("puzzle variety across seeds", () => {
		const uniquePuzzles = new Set<string>();

		for (let seed = 0; seed < 50; seed++) {
			const puzzle = generateWordLadderPuzzle(seed);
			const key = `${puzzle.start}-${puzzle.end}`;
			uniquePuzzles.add(key);
		}

		// Should have good variety of start-end pairs
		expect(uniquePuzzles.size).toBeGreaterThan(30);
	});

	test("validates full path transformation", () => {
		for (let seed = 0; seed < 10; seed++) {
			const puzzle = generateWordLadderPuzzle(seed);
			const path = puzzle.path;

			// Verify we can transform from start to end step by step
			let current = puzzle.start;
			for (let i = 1; i < path.length; i++) {
				expect(isOneLetterChange(current, path[i])).toBe(true);
				current = path[i];
			}
			expect(current).toBe(puzzle.end);
		}
	});
});
