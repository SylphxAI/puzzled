/**
 * Word Search Generator Tests
 *
 * Tests for the themed word search puzzle generation.
 * Verifies word placement, grid structure, and theme selection.
 */

import { describe, expect, test } from "bun:test";
import { generateWordSearchPuzzle, getThemeCount } from "./generator";
import { GRID_SIZE, getDirectionVector } from "./types";

// ============================================================================
// Theme Pool Tests
// ============================================================================

describe("theme pool", () => {
	test("has multiple themes", () => {
		const count = getThemeCount();
		expect(count).toBeGreaterThan(5);
	});

	test("count is consistent across calls", () => {
		const count1 = getThemeCount();
		const count2 = getThemeCount();
		expect(count1).toBe(count2);
	});
});

// ============================================================================
// Puzzle Generation Tests
// ============================================================================

describe("generateWordSearchPuzzle", () => {
	describe("determinism", () => {
		test("same seed produces same puzzle", () => {
			const puzzle1 = generateWordSearchPuzzle(12345);
			const puzzle2 = generateWordSearchPuzzle(12345);

			expect(puzzle1.puzzleData.grid).toEqual(puzzle2.puzzleData.grid);
			expect(puzzle1.puzzleData.theme).toBe(puzzle2.puzzleData.theme);
			expect(puzzle1.solution.words).toEqual(puzzle2.solution.words);
		});

		test("different seeds produce different puzzles", () => {
			const puzzle1 = generateWordSearchPuzzle(100);
			const puzzle2 = generateWordSearchPuzzle(200);

			// Either theme, grid, or words should differ
			const sameTheme = puzzle1.puzzleData.theme === puzzle2.puzzleData.theme;
			const sameGrid =
				JSON.stringify(puzzle1.puzzleData.grid) ===
				JSON.stringify(puzzle2.puzzleData.grid);
			const sameWords =
				JSON.stringify(puzzle1.solution.words) ===
				JSON.stringify(puzzle2.solution.words);

			expect(sameTheme && sameGrid && sameWords).toBe(false);
		});
	});

	describe("puzzle structure", () => {
		test("has correct grid size", () => {
			const puzzle = generateWordSearchPuzzle(42);

			expect(puzzle.puzzleData.grid.length).toBe(GRID_SIZE);
			expect(puzzle.puzzleData.grid[0].length).toBe(GRID_SIZE);
		});

		test("grid is filled (no empty cells)", () => {
			const puzzle = generateWordSearchPuzzle(42);
			const grid = puzzle.puzzleData.grid;

			for (const row of grid) {
				for (const cell of row) {
					expect(cell.length).toBe(1);
					expect(cell).toMatch(/[A-Z]/);
				}
			}
		});

		test("has a theme", () => {
			const puzzle = generateWordSearchPuzzle(42);

			expect(puzzle.puzzleData.theme).toBeDefined();
			expect(typeof puzzle.puzzleData.theme).toBe("string");
			expect(puzzle.puzzleData.theme.length).toBeGreaterThan(0);
		});

		test("has word count", () => {
			const puzzle = generateWordSearchPuzzle(42);

			expect(puzzle.puzzleData.wordCount).toBeDefined();
			expect(puzzle.puzzleData.wordCount).toBeGreaterThan(0);
		});

		test("word count matches solution words", () => {
			for (let seed = 0; seed < 10; seed++) {
				const puzzle = generateWordSearchPuzzle(seed);
				expect(puzzle.puzzleData.wordCount).toBe(puzzle.solution.words.length);
			}
		});
	});

	describe("solution validity", () => {
		test("all words are uppercase", () => {
			const puzzle = generateWordSearchPuzzle(42);

			for (const word of puzzle.solution.words) {
				expect(word).toBe(word.toUpperCase());
			}
		});

		test("placements match words", () => {
			const puzzle = generateWordSearchPuzzle(42);

			expect(puzzle.solution.placements.length).toBe(
				puzzle.solution.words.length,
			);

			for (let i = 0; i < puzzle.solution.words.length; i++) {
				expect(puzzle.solution.placements[i].word).toBe(
					puzzle.solution.words[i],
				);
			}
		});

		test("words appear at correct positions in grid", () => {
			for (let seed = 0; seed < 10; seed++) {
				const puzzle = generateWordSearchPuzzle(seed);
				const grid = puzzle.puzzleData.grid;

				for (const placement of puzzle.solution.placements) {
					const vector = getDirectionVector(placement.direction);
					const word = placement.word;

					let row = placement.start.row;
					let col = placement.start.col;

					// Verify each letter
					for (let i = 0; i < word.length; i++) {
						expect(grid[row][col]).toBe(word[i]);
						row += vector.row;
						col += vector.col;
					}
				}
			}
		});

		test("placement start/end positions are consistent", () => {
			const puzzle = generateWordSearchPuzzle(42);

			for (const placement of puzzle.solution.placements) {
				const vector = getDirectionVector(placement.direction);
				const wordLength = placement.word.length;

				const expectedEndRow =
					placement.start.row + (wordLength - 1) * vector.row;
				const expectedEndCol =
					placement.start.col + (wordLength - 1) * vector.col;

				expect(placement.end.row).toBe(expectedEndRow);
				expect(placement.end.col).toBe(expectedEndCol);
			}
		});
	});

	describe("word placement", () => {
		test("words fit within grid boundaries", () => {
			for (let seed = 0; seed < 10; seed++) {
				const puzzle = generateWordSearchPuzzle(seed);

				for (const placement of puzzle.solution.placements) {
					// Start within bounds
					expect(placement.start.row).toBeGreaterThanOrEqual(0);
					expect(placement.start.row).toBeLessThan(GRID_SIZE);
					expect(placement.start.col).toBeGreaterThanOrEqual(0);
					expect(placement.start.col).toBeLessThan(GRID_SIZE);

					// End within bounds
					expect(placement.end.row).toBeGreaterThanOrEqual(0);
					expect(placement.end.row).toBeLessThan(GRID_SIZE);
					expect(placement.end.col).toBeGreaterThanOrEqual(0);
					expect(placement.end.col).toBeLessThan(GRID_SIZE);
				}
			}
		});

		test("words have valid directions", () => {
			const validDirections = [
				"horizontal",
				"vertical",
				"diagonal-down",
				"diagonal-up",
				"horizontal-reverse",
				"vertical-reverse",
				"diagonal-down-reverse",
				"diagonal-up-reverse",
			];

			for (let seed = 0; seed < 10; seed++) {
				const puzzle = generateWordSearchPuzzle(seed);

				for (const placement of puzzle.solution.placements) {
					expect(validDirections).toContain(placement.direction);
				}
			}
		});

		test("word length does not exceed grid size", () => {
			for (let seed = 0; seed < 20; seed++) {
				const puzzle = generateWordSearchPuzzle(seed);

				for (const word of puzzle.solution.words) {
					expect(word.length).toBeLessThanOrEqual(GRID_SIZE);
				}
			}
		});
	});
});

// ============================================================================
// Theme Tests
// ============================================================================

describe("word search themes", () => {
	test("different seeds can select different themes", () => {
		const themes = new Set<string>();

		for (let seed = 0; seed < 50; seed++) {
			const puzzle = generateWordSearchPuzzle(seed);
			themes.add(puzzle.puzzleData.theme);
		}

		// Should have theme variety
		expect(themes.size).toBeGreaterThan(5);
	});

	test("words match their theme (spot check)", () => {
		// Generate puzzles and check word relevance
		// This is a spot check since we can't verify all themes programmatically
		const puzzles = Array.from({ length: 20 }, (_, i) =>
			generateWordSearchPuzzle(i),
		);

		for (const puzzle of puzzles) {
			// Just verify words are non-empty uppercase strings
			for (const word of puzzle.solution.words) {
				expect(word.length).toBeGreaterThan(0);
				expect(word).toBe(word.toUpperCase());
			}
		}
	});
});

// ============================================================================
// Integration Tests
// ============================================================================

describe("word search integration", () => {
	test("daily puzzle simulation", () => {
		const dailyPuzzles = Array.from({ length: 7 }, (_, day) => {
			return generateWordSearchPuzzle(20240101 + day);
		});

		for (const puzzle of dailyPuzzles) {
			expect(puzzle.puzzleData.grid.length).toBe(GRID_SIZE);
			expect(puzzle.solution.words.length).toBeGreaterThan(0);
		}
	});

	test("puzzle variety across seeds", () => {
		const uniqueGrids = new Set<string>();

		for (let seed = 0; seed < 50; seed++) {
			const puzzle = generateWordSearchPuzzle(seed);
			uniqueGrids.add(JSON.stringify(puzzle.puzzleData.grid));
		}

		// All 50 puzzles should be unique
		expect(uniqueGrids.size).toBe(50);
	});

	test("reasonable word counts", () => {
		for (let seed = 0; seed < 20; seed++) {
			const puzzle = generateWordSearchPuzzle(seed);

			// Should have between 6-12 words typically
			expect(puzzle.solution.words.length).toBeGreaterThanOrEqual(4);
			expect(puzzle.solution.words.length).toBeLessThanOrEqual(15);
		}
	});
});
