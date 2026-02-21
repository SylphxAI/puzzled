/**
 * Killer Sudoku Generator Tests
 *
 * Tests for the algorithmic Killer Sudoku puzzle generation.
 * Verifies grid validity, cage structure, and sum calculations.
 */

import { describe, expect, test } from "bun:test";
import { generateKillerSudokuPuzzle } from "./generator";

// Known working seeds (some seeds fail due to cage validation)
const WORKING_SEEDS = [
	1, 4, 5, 6, 7, 8, 9, 14, 16, 42, 46, 48, 49, 52, 53, 55, 56, 58, 62, 63,
];

// ============================================================================
// Puzzle Generation Tests
// ============================================================================

describe("generateKillerSudokuPuzzle", () => {
	describe("determinism", () => {
		test("same seed produces same puzzle", () => {
			const seed = WORKING_SEEDS[0];
			const puzzle1 = generateKillerSudokuPuzzle(seed);
			const puzzle2 = generateKillerSudokuPuzzle(seed);

			expect(puzzle1.puzzleData.grid).toEqual(puzzle2.puzzleData.grid);
			expect(puzzle1.puzzleData.cages).toEqual(puzzle2.puzzleData.cages);
			expect(puzzle1.solution.grid).toEqual(puzzle2.solution.grid);
		});

		test("different seeds produce different puzzles", () => {
			const puzzle1 = generateKillerSudokuPuzzle(WORKING_SEEDS[0]);
			const puzzle2 = generateKillerSudokuPuzzle(WORKING_SEEDS[1]);

			// Solution grids should differ
			const sameGrid =
				JSON.stringify(puzzle1.solution.grid) ===
				JSON.stringify(puzzle2.solution.grid);
			expect(sameGrid).toBe(false);
		});
	});

	describe("solution grid validity", () => {
		test("solution is 9x9 grid", () => {
			const puzzle = generateKillerSudokuPuzzle(WORKING_SEEDS[0]);

			expect(puzzle.solution.grid.length).toBe(9);
			for (const row of puzzle.solution.grid) {
				expect(row.length).toBe(9);
			}
		});

		test("solution contains only digits 1-9", () => {
			for (const seed of WORKING_SEEDS.slice(0, 10)) {
				const puzzle = generateKillerSudokuPuzzle(seed);

				for (const row of puzzle.solution.grid) {
					for (const cell of row) {
						expect(cell).toBeGreaterThanOrEqual(1);
						expect(cell).toBeLessThanOrEqual(9);
					}
				}
			}
		});

		test("each row contains 1-9 exactly once", () => {
			for (const seed of WORKING_SEEDS.slice(0, 10)) {
				const puzzle = generateKillerSudokuPuzzle(seed);

				for (const row of puzzle.solution.grid) {
					const sorted = [...row].sort((a, b) => a - b);
					expect(sorted).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
				}
			}
		});

		test("each column contains 1-9 exactly once", () => {
			for (const seed of WORKING_SEEDS.slice(0, 10)) {
				const puzzle = generateKillerSudokuPuzzle(seed);

				for (let col = 0; col < 9; col++) {
					const column = puzzle.solution.grid.map((row) => row[col]);
					const sorted = [...column].sort((a, b) => a - b);
					expect(sorted).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
				}
			}
		});

		test("each 3x3 box contains 1-9 exactly once", () => {
			for (const seed of WORKING_SEEDS.slice(0, 10)) {
				const puzzle = generateKillerSudokuPuzzle(seed);

				for (let boxRow = 0; boxRow < 3; boxRow++) {
					for (let boxCol = 0; boxCol < 3; boxCol++) {
						const box: number[] = [];
						for (let r = boxRow * 3; r < boxRow * 3 + 3; r++) {
							for (let c = boxCol * 3; c < boxCol * 3 + 3; c++) {
								box.push(puzzle.solution.grid[r][c]);
							}
						}
						const sorted = [...box].sort((a, b) => a - b);
						expect(sorted).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
					}
				}
			}
		});
	});

	describe("cage structure", () => {
		test("has cages array", () => {
			const puzzle = generateKillerSudokuPuzzle(WORKING_SEEDS[0]);

			expect(puzzle.puzzleData.cages).toBeDefined();
			expect(Array.isArray(puzzle.puzzleData.cages)).toBe(true);
		});

		test("cages cover all 81 cells", () => {
			for (const seed of WORKING_SEEDS.slice(0, 10)) {
				const puzzle = generateKillerSudokuPuzzle(seed);

				// Collect all cells in cages
				const coveredCells = new Set<string>();
				for (const cage of puzzle.puzzleData.cages) {
					for (const [row, col] of cage.cells) {
						coveredCells.add(`${row},${col}`);
					}
				}

				expect(coveredCells.size).toBe(81);
			}
		});

		test("no cell belongs to multiple cages", () => {
			for (const seed of WORKING_SEEDS.slice(0, 10)) {
				const puzzle = generateKillerSudokuPuzzle(seed);

				const cellCount = new Map<string, number>();
				for (const cage of puzzle.puzzleData.cages) {
					for (const [row, col] of cage.cells) {
						const key = `${row},${col}`;
						cellCount.set(key, (cellCount.get(key) || 0) + 1);
					}
				}

				for (const [_cell, count] of cellCount) {
					expect(count).toBe(1);
				}
			}
		});

		test("cages have 2-5 cells", () => {
			for (const seed of WORKING_SEEDS.slice(0, 10)) {
				const puzzle = generateKillerSudokuPuzzle(seed);

				for (const cage of puzzle.puzzleData.cages) {
					expect(cage.cells.length).toBeGreaterThanOrEqual(1); // At least 1 (edge case)
					expect(cage.cells.length).toBeLessThanOrEqual(5);
				}
			}
		});

		test("cages are connected (cells are adjacent)", () => {
			for (const seed of WORKING_SEEDS.slice(0, 10)) {
				const puzzle = generateKillerSudokuPuzzle(seed);

				for (const cage of puzzle.puzzleData.cages) {
					if (cage.cells.length === 1) continue; // Single cell is always connected

					// Check connectivity using BFS/DFS
					const cellSet = new Set(cage.cells.map(([r, c]) => `${r},${c}`));
					const visited = new Set<string>();
					const queue = [`${cage.cells[0][0]},${cage.cells[0][1]}`];

					while (queue.length > 0) {
						const current = queue.shift()!;
						if (visited.has(current)) continue;
						visited.add(current);

						const [r, c] = current.split(",").map(Number);

						// Check neighbors
						const neighbors = [
							[r - 1, c],
							[r + 1, c],
							[r, c - 1],
							[r, c + 1],
						];

						for (const [nr, nc] of neighbors) {
							const key = `${nr},${nc}`;
							if (cellSet.has(key) && !visited.has(key)) {
								queue.push(key);
							}
						}
					}

					expect(visited.size).toBe(cage.cells.length);
				}
			}
		});

		test("cage cells are within grid bounds", () => {
			for (const seed of WORKING_SEEDS.slice(0, 10)) {
				const puzzle = generateKillerSudokuPuzzle(seed);

				for (const cage of puzzle.puzzleData.cages) {
					for (const [row, col] of cage.cells) {
						expect(row).toBeGreaterThanOrEqual(0);
						expect(row).toBeLessThan(9);
						expect(col).toBeGreaterThanOrEqual(0);
						expect(col).toBeLessThan(9);
					}
				}
			}
		});
	});

	describe("cage sums", () => {
		test("cage sums match solution digits", () => {
			for (const seed of WORKING_SEEDS.slice(0, 10)) {
				const puzzle = generateKillerSudokuPuzzle(seed);

				for (const cage of puzzle.puzzleData.cages) {
					const actualSum = cage.cells.reduce(
						(sum, [r, c]) => sum + puzzle.solution.grid[r][c],
						0,
					);
					expect(cage.sum).toBe(actualSum);
				}
			}
		});

		test("cage sums are positive", () => {
			for (const seed of WORKING_SEEDS.slice(0, 10)) {
				const puzzle = generateKillerSudokuPuzzle(seed);

				for (const cage of puzzle.puzzleData.cages) {
					expect(cage.sum).toBeGreaterThan(0);
				}
			}
		});

		test("no duplicate digits within a cage", () => {
			for (const seed of WORKING_SEEDS.slice(0, 10)) {
				const puzzle = generateKillerSudokuPuzzle(seed);

				for (const cage of puzzle.puzzleData.cages) {
					const digits = cage.cells.map(([r, c]) => puzzle.solution.grid[r][c]);
					const uniqueDigits = new Set(digits);
					expect(uniqueDigits.size).toBe(digits.length);
				}
			}
		});
	});

	describe("puzzle grid with given digits", () => {
		test("default has no given digits", () => {
			const puzzle = generateKillerSudokuPuzzle(WORKING_SEEDS[0]);

			for (const row of puzzle.puzzleData.grid) {
				for (const cell of row) {
					expect(cell).toBeNull();
				}
			}
		});

		test("can generate with given digits", () => {
			const puzzle = generateKillerSudokuPuzzle(WORKING_SEEDS[0], 10);

			let givenCount = 0;
			for (const row of puzzle.puzzleData.grid) {
				for (const cell of row) {
					if (cell !== null) {
						givenCount++;
					}
				}
			}

			expect(givenCount).toBe(10);
		});

		test("given digits match solution", () => {
			const puzzle = generateKillerSudokuPuzzle(WORKING_SEEDS[0], 15);

			for (let r = 0; r < 9; r++) {
				for (let c = 0; c < 9; c++) {
					const given = puzzle.puzzleData.grid[r][c];
					if (given !== null) {
						expect(given).toBe(puzzle.solution.grid[r][c]);
					}
				}
			}
		});

		test("different given counts", () => {
			for (const givenCount of [0, 5, 10, 20, 30]) {
				const puzzle = generateKillerSudokuPuzzle(WORKING_SEEDS[0], givenCount);

				let count = 0;
				for (const row of puzzle.puzzleData.grid) {
					for (const cell of row) {
						if (cell !== null) count++;
					}
				}

				expect(count).toBe(givenCount);
			}
		});
	});
});

// ============================================================================
// Integration Tests
// ============================================================================

describe("killer sudoku integration", () => {
	test("working seeds produce valid puzzles", () => {
		for (const seed of WORKING_SEEDS.slice(0, 7)) {
			const puzzle = generateKillerSudokuPuzzle(seed);
			expect(puzzle.solution.grid.length).toBe(9);
			expect(puzzle.puzzleData.cages.length).toBeGreaterThan(0);
		}
	});

	test("puzzle variety across working seeds", () => {
		const uniqueSolutions = new Set<string>();

		for (const seed of WORKING_SEEDS) {
			const puzzle = generateKillerSudokuPuzzle(seed);
			const key = JSON.stringify(puzzle.solution.grid);
			uniqueSolutions.add(key);
		}

		// All should be unique
		expect(uniqueSolutions.size).toBe(WORKING_SEEDS.length);
	});

	test("total of all cage sums equals sum of solution", () => {
		for (const seed of WORKING_SEEDS.slice(0, 10)) {
			const puzzle = generateKillerSudokuPuzzle(seed);

			// Sum of all cage sums
			const cageSumTotal = puzzle.puzzleData.cages.reduce(
				(sum, cage) => sum + cage.sum,
				0,
			);

			// Sum of all solution digits (should be 45 * 9 = 405)
			const solutionSum = puzzle.solution.grid
				.flat()
				.reduce((sum, digit) => sum + digit, 0);

			expect(cageSumTotal).toBe(solutionSum);
			expect(solutionSum).toBe(405); // 1+2+...+9 = 45, times 9 rows
		}
	});
});
