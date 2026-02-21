/**
 * Killer Sudoku Puzzle Generator
 *
 * ⚠️ FROZEN ALGORITHM - DO NOT MODIFY
 * Changes will break historical puzzles
 *
 * Generates puzzles algorithmically:
 * 1. Create a valid solved Sudoku grid
 * 2. Generate random cages (connected cell groups)
 * 3. Calculate cage sums from solution
 */

import { seededRandom, shuffleArray } from "@/games/shared/random";
import type {
	Cage,
	KillerSudokuPuzzleData,
	KillerSudokuSolution,
} from "./types";

/**
 * Generate a valid solved Sudoku grid using backtracking
 */
function generateSolvedGrid(random: () => number): number[][] {
	const grid: number[][] = Array(9)
		.fill(null)
		.map(() => Array(9).fill(0));

	function isValidPlacement(row: number, col: number, num: number): boolean {
		// Check row
		for (let c = 0; c < 9; c++) {
			if (grid[row][c] === num) return false;
		}

		// Check column
		for (let r = 0; r < 9; r++) {
			if (grid[r][col] === num) return false;
		}

		// Check 3x3 box
		const boxRow = Math.floor(row / 3) * 3;
		const boxCol = Math.floor(col / 3) * 3;
		for (let r = boxRow; r < boxRow + 3; r++) {
			for (let c = boxCol; c < boxCol + 3; c++) {
				if (grid[r][c] === num) return false;
			}
		}

		return true;
	}

	function solve(pos: number): boolean {
		if (pos === 81) return true;

		const row = Math.floor(pos / 9);
		const col = pos % 9;

		// Try numbers in random order for variety
		const numbers = shuffleArray([1, 2, 3, 4, 5, 6, 7, 8, 9], random);

		for (const num of numbers) {
			if (isValidPlacement(row, col, num)) {
				grid[row][col] = num;
				if (solve(pos + 1)) return true;
				grid[row][col] = 0;
			}
		}

		return false;
	}

	solve(0);
	return grid;
}

/**
 * Generate cages covering the entire grid
 * Each cage is a connected group of 2-5 cells
 */
function generateCages(grid: number[][], random: () => number): Cage[] {
	const cages: Cage[] = [];
	const assigned: boolean[][] = Array(9)
		.fill(null)
		.map(() => Array(9).fill(false));

	const directions = [
		[-1, 0],
		[1, 0],
		[0, -1],
		[0, 1],
	];

	// Get unassigned neighbors
	function getNeighbors(row: number, col: number): [number, number][] {
		const neighbors: [number, number][] = [];
		for (const [dr, dc] of directions) {
			const nr = row + dr;
			const nc = col + dc;
			if (nr >= 0 && nr < 9 && nc >= 0 && nc < 9 && !assigned[nr][nc]) {
				neighbors.push([nr, nc]);
			}
		}
		return neighbors;
	}

	// Create cages for all cells
	for (let r = 0; r < 9; r++) {
		for (let c = 0; c < 9; c++) {
			if (assigned[r][c]) continue;

			// Start a new cage
			const cageCells: [number, number][] = [[r, c]];
			assigned[r][c] = true;

			// Grow cage to 2-5 cells
			const targetSize = 2 + Math.floor(random() * 4); // 2-5 cells

			while (cageCells.length < targetSize) {
				// Find all possible cells to add (neighbors of current cage cells)
				const candidates: [number, number][] = [];
				for (const [cr, cc] of cageCells) {
					for (const [nr, nc] of getNeighbors(cr, cc)) {
						// Check if already in candidates
						if (!candidates.some(([pr, pc]) => pr === nr && pc === nc)) {
							candidates.push([nr, nc]);
						}
					}
				}

				if (candidates.length === 0) break;

				// Pick a random candidate
				const [nr, nc] = candidates[Math.floor(random() * candidates.length)];
				cageCells.push([nr, nc]);
				assigned[nr][nc] = true;
			}

			// Calculate sum for this cage
			const sum = cageCells.reduce(
				(total, [cr, cc]) => total + grid[cr][cc],
				0,
			);

			cages.push({
				cells: cageCells,
				sum,
			});
		}
	}

	return cages;
}

/**
 * Validate that cage sums are achievable
 * (Basic sanity check - sum should match digits)
 */
function validateCages(grid: number[][], cages: Cage[]): boolean {
	for (const cage of cages) {
		const actualSum = cage.cells.reduce(
			(total, [r, c]) => total + grid[r][c],
			0,
		);
		if (actualSum !== cage.sum) {
			return false;
		}

		// Check for duplicate digits in cage (not allowed in Killer Sudoku)
		const digits = cage.cells.map(([r, c]) => grid[r][c]);
		const uniqueDigits = new Set(digits);
		if (uniqueDigits.size !== digits.length) {
			return false;
		}
	}
	return true;
}

/**
 * Add given digits to the puzzle grid for easier difficulties
 * Randomly selects cells from the solution to pre-fill
 */
function addGivenDigits(
	solutionGrid: number[][],
	numGiven: number,
	random: () => number,
): (number | null)[][] {
	// Start with empty grid
	const grid: (number | null)[][] = Array(9)
		.fill(null)
		.map(() => Array(9).fill(null));

	if (numGiven <= 0) return grid;

	// Create list of all cell positions
	const positions: [number, number][] = [];
	for (let r = 0; r < 9; r++) {
		for (let c = 0; c < 9; c++) {
			positions.push([r, c]);
		}
	}

	// Shuffle and pick first numGiven cells
	const shuffled = shuffleArray(positions, random);
	for (let i = 0; i < Math.min(numGiven, 81); i++) {
		const [r, c] = shuffled[i];
		grid[r][c] = solutionGrid[r][c];
	}

	return grid;
}

/**
 * Generate a Killer Sudoku puzzle from a seed
 * @param seed - Numeric seed for deterministic generation
 * @param givenDigits - Number of pre-filled cells (0 for pure Killer Sudoku)
 */
export function generateKillerSudokuPuzzle(
	seed: number,
	givenDigits = 0,
): {
	puzzleData: KillerSudokuPuzzleData;
	solution: KillerSudokuSolution;
} {
	const random = seededRandom(seed);

	// Generate solved grid
	const solutionGrid = generateSolvedGrid(random);

	// Generate cages
	let cages = generateCages(solutionGrid, random);
	let attempts = 0;
	const maxAttempts = 5;

	// Regenerate if cages are invalid (shouldn't happen, but safety check)
	while (!validateCages(solutionGrid, cages) && attempts < maxAttempts) {
		attempts++;
		const newRandom = seededRandom(seed + attempts * 1000);
		cages = generateCages(solutionGrid, newRandom);
	}

	if (!validateCages(solutionGrid, cages)) {
		// ⚠️ ARCHITECTURE PRINCIPLE: No silent fallbacks
		throw new Error(
			`KillerSudoku: Failed to generate valid cages for seed ${seed}. ` +
				`This indicates a bug in the cage generation algorithm.`,
		);
	}

	// Create initial grid with optional given digits
	const grid = addGivenDigits(
		solutionGrid,
		givenDigits,
		seededRandom(seed + 999),
	);

	return {
		puzzleData: {
			grid,
			cages,
		},
		solution: {
			grid: solutionGrid,
		},
	};
}
