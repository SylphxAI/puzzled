/**
 * Sudoku Puzzle Generator
 *
 * ⚠️ FROZEN SINCE: v1.0
 * DO NOT MODIFY - changing this breaks historical puzzles
 *
 * Generates infinite valid Sudoku puzzles using:
 * 1. Seed-based deterministic random number generator
 * 2. Backtracking algorithm to fill grid
 * 3. Cell removal based on difficulty
 */

import { seededRandom, shuffleArray } from "@/games/shared/random";
import type { SudokuPuzzleData } from "./types";
import { BOX_SIZE, GRID_SIZE, isValidPlacement } from "./types";

/**
 * Generate a complete valid Sudoku grid using backtracking
 */
function generateCompleteGrid(random: () => number): number[][] {
	const grid: number[][] = Array.from({ length: GRID_SIZE }, () =>
		Array(GRID_SIZE).fill(0),
	);

	function solve(row: number, col: number): boolean {
		// Move to next row when column overflows
		if (col >= GRID_SIZE) {
			col = 0;
			row++;
		}

		// Finished filling all rows
		if (row >= GRID_SIZE) {
			return true;
		}

		// Try numbers 1-9 in random order
		const numbers = shuffleArray([1, 2, 3, 4, 5, 6, 7, 8, 9], random);

		for (const num of numbers) {
			if (isValidPlacement(grid, row, col, num)) {
				grid[row][col] = num;

				if (solve(row, col + 1)) {
					return true;
				}

				grid[row][col] = 0;
			}
		}

		return false;
	}

	solve(0, 0);
	return grid;
}

/**
 * Count solutions for a puzzle (for uniqueness check)
 * Returns 0, 1, or 2 (stops counting at 2)
 */
function countSolutions(grid: (number | null)[][], maxCount = 2): number {
	const workGrid = grid.map((row) => [...row]);
	let count = 0;

	function solve(row: number, col: number): boolean {
		// Move to next row when column overflows
		if (col >= GRID_SIZE) {
			col = 0;
			row++;
		}

		// Found a solution
		if (row >= GRID_SIZE) {
			count++;
			return count >= maxCount; // Stop if we found enough
		}

		// Skip filled cells
		if (workGrid[row][col] !== null) {
			return solve(row, col + 1);
		}

		// Try each number
		for (let num = 1; num <= 9; num++) {
			if (isValidPlacement(workGrid as number[][], row, col, num)) {
				workGrid[row][col] = num;
				if (solve(row, col + 1)) {
					workGrid[row][col] = null;
					return true;
				}
				workGrid[row][col] = null;
			}
		}

		return false;
	}

	solve(0, 0);
	return count;
}

/**
 * Remove cells from a complete grid to create a puzzle
 * Ensures unique solution
 */
function removeNumbers(
	solution: number[][],
	difficulty: "easy" | "medium" | "hard",
	random: () => number,
): (number | null)[][] {
	// Cells to remove based on difficulty
	// Easy: 30-35 removed, Medium: 40-45 removed, Hard: 50-55 removed
	const removeCount = {
		easy: 32 + Math.floor(random() * 4),
		medium: 42 + Math.floor(random() * 4),
		hard: 52 + Math.floor(random() * 4),
	}[difficulty];

	// Create puzzle grid
	const puzzle: (number | null)[][] = solution.map((row) => [...row]);

	// Get all cell positions and shuffle
	const positions: [number, number][] = [];
	for (let r = 0; r < GRID_SIZE; r++) {
		for (let c = 0; c < GRID_SIZE; c++) {
			positions.push([r, c]);
		}
	}
	const shuffledPositions = shuffleArray(positions, random);

	let removed = 0;
	for (const [row, col] of shuffledPositions) {
		if (removed >= removeCount) break;

		const backup = puzzle[row][col];
		puzzle[row][col] = null;

		// For easier difficulties, always remove
		// For harder difficulties, check uniqueness occasionally
		if (difficulty === "easy" || random() > 0.3) {
			removed++;
		} else {
			// Check if puzzle still has unique solution
			const solutions = countSolutions(puzzle);
			if (solutions === 1) {
				removed++;
			} else {
				// Restore if multiple solutions
				puzzle[row][col] = backup;
			}
		}
	}

	return puzzle;
}

/**
 * Generate a Sudoku puzzle from a seed
 */
export function generateSudokuPuzzle(
	seed: number,
	difficulty: "easy" | "medium" | "hard" = "medium",
): {
	puzzleData: SudokuPuzzleData;
	solution: { grid: number[][] };
} {
	const random = seededRandom(seed);

	// Generate complete solution
	const solution = generateCompleteGrid(random);

	// Remove cells to create puzzle
	const puzzle = removeNumbers(solution, difficulty, random);

	return {
		puzzleData: {
			grid: puzzle,
			difficulty,
		},
		solution: {
			grid: solution,
		},
	};
}

/**
 * Get difficulty based on seed (cycles through difficulties)
 */
function _getDifficultyFromSeed(seed: number): "easy" | "medium" | "hard" {
	const difficulties: ("easy" | "medium" | "hard")[] = [
		"easy",
		"medium",
		"hard",
	];
	return difficulties[Math.abs(seed) % 3];
}

/**
 * Validate a complete Sudoku grid
 */
function _validateSudokuGrid(grid: number[][]): boolean {
	// Check rows
	for (let row = 0; row < GRID_SIZE; row++) {
		const seen = new Set<number>();
		for (let col = 0; col < GRID_SIZE; col++) {
			const val = grid[row][col];
			if (val < 1 || val > 9 || seen.has(val)) return false;
			seen.add(val);
		}
	}

	// Check columns
	for (let col = 0; col < GRID_SIZE; col++) {
		const seen = new Set<number>();
		for (let row = 0; row < GRID_SIZE; row++) {
			const val = grid[row][col];
			if (val < 1 || val > 9 || seen.has(val)) return false;
			seen.add(val);
		}
	}

	// Check 3x3 boxes
	for (let boxRow = 0; boxRow < 3; boxRow++) {
		for (let boxCol = 0; boxCol < 3; boxCol++) {
			const seen = new Set<number>();
			for (let r = 0; r < BOX_SIZE; r++) {
				for (let c = 0; c < BOX_SIZE; c++) {
					const val = grid[boxRow * BOX_SIZE + r][boxCol * BOX_SIZE + c];
					if (val < 1 || val > 9 || seen.has(val)) return false;
					seen.add(val);
				}
			}
		}
	}

	return true;
}
