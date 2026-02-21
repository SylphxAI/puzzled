/**
 * Queens Validation Tests
 *
 * Tests for the validateAndScore function which:
 * - Validates submission grid data
 * - Verifies win/loss claims using puzzle regions
 * - Calculates score based on time
 *
 * Scoring: Time-based
 * - Base: 500 points
 * - Time penalty: -1 point per 2 seconds
 * - Minimum: 100 points for a win
 */

import { describe, expect, test } from "bun:test";
import type { GameSubmission } from "../types";
import {
	type QueensPuzzleData,
	type QueensSolution,
	queensConfig,
} from "./config";

// Generate a puzzle for testing (6x6 medium difficulty)
const { puzzleData, solution } = queensConfig.generatePuzzle(12345, "medium");

// Helper to create submission
function createSubmission(
	status: "won" | "lost",
	finalGrid: boolean[][] | undefined,
	timeSpentMs: number,
): GameSubmission {
	return {
		status,
		attempts: 1,
		timeSpentMs,
		data: finalGrid !== undefined ? { finalGrid } : {},
	};
}

// Helper to create a correct grid for the puzzle
function createCorrectGrid(
	sol: QueensSolution,
	pd: QueensPuzzleData,
): boolean[][] {
	const grid: boolean[][] = Array.from({ length: pd.size }, () =>
		Array(pd.size).fill(false),
	);
	for (const [row, col] of sol.queens) {
		grid[row][col] = true;
	}
	return grid;
}

// Helper to create an incorrect grid (queens attacking each other)
function createIncorrectGrid(size: number): boolean[][] {
	// Put two queens on same row (invalid)
	const grid: boolean[][] = Array.from({ length: size }, () =>
		Array(size).fill(false),
	);
	grid[0][0] = true;
	grid[0][1] = true; // Same row as first queen
	return grid;
}

describe("queens validateAndScore", () => {
	const correctGrid = createCorrectGrid(solution, puzzleData);
	const incorrectGrid = createIncorrectGrid(puzzleData.size);

	describe("valid solutions", () => {
		test("fast solve (0 seconds) scores 500 points", () => {
			const submission = createSubmission("won", correctGrid, 0);
			const result = queensConfig.validateAndScore(
				solution,
				puzzleData,
				submission,
			);

			expect(result.valid).toBe(true);
			if (result.valid) {
				expect(result.status).toBe("won");
				expect(result.score).toBe(500);
			}
		});

		test("100 second solve scores 450 points", () => {
			// 100 seconds = 50 * 2 seconds = 50 point penalty
			const submission = createSubmission("won", correctGrid, 100000);
			const result = queensConfig.validateAndScore(
				solution,
				puzzleData,
				submission,
			);

			expect(result.valid).toBe(true);
			if (result.valid) {
				expect(result.status).toBe("won");
				expect(result.score).toBe(450);
			}
		});

		test("200 second solve scores 400 points", () => {
			const submission = createSubmission("won", correctGrid, 200000);
			const result = queensConfig.validateAndScore(
				solution,
				puzzleData,
				submission,
			);

			expect(result.valid).toBe(true);
			if (result.valid) {
				expect(result.status).toBe("won");
				expect(result.score).toBe(400);
			}
		});

		test("minimum score is 100 for wins", () => {
			// Very long time: 2000 seconds = 1000 penalty, but min is 100
			const submission = createSubmission("won", correctGrid, 2000000);
			const result = queensConfig.validateAndScore(
				solution,
				puzzleData,
				submission,
			);

			expect(result.valid).toBe(true);
			if (result.valid) {
				expect(result.status).toBe("won");
				expect(result.score).toBe(100);
			}
		});

		test("loss scores 0 points", () => {
			const submission = createSubmission("lost", incorrectGrid, 60000);
			const result = queensConfig.validateAndScore(
				solution,
				puzzleData,
				submission,
			);

			expect(result.valid).toBe(true);
			if (result.valid) {
				expect(result.status).toBe("lost");
				expect(result.score).toBe(0);
			}
		});
	});

	describe("invalid submissions", () => {
		test("rejects missing final grid", () => {
			const submission = createSubmission("won", undefined, 60000);
			const result = queensConfig.validateAndScore(
				solution,
				puzzleData,
				submission,
			);

			expect(result.valid).toBe(false);
			if (!result.valid) {
				expect(result.error).toContain("Missing final grid");
			}
		});

		test("rejects false win claim with incorrect grid", () => {
			const submission = createSubmission("won", incorrectGrid, 60000);
			const result = queensConfig.validateAndScore(
				solution,
				puzzleData,
				submission,
			);

			expect(result.valid).toBe(false);
			if (!result.valid) {
				expect(result.error).toContain("Invalid win claim");
			}
		});

		test("rejects false loss claim with correct grid", () => {
			const submission = createSubmission("lost", correctGrid, 60000);
			const result = queensConfig.validateAndScore(
				solution,
				puzzleData,
				submission,
			);

			expect(result.valid).toBe(false);
			if (!result.valid) {
				expect(result.error).toContain("Invalid loss claim");
			}
		});
	});

	describe("edge cases", () => {
		test("empty grid is incorrect", () => {
			const emptyGrid = Array.from({ length: puzzleData.size }, () =>
				Array(puzzleData.size).fill(false),
			);
			const submission = createSubmission("won", emptyGrid, 60000);
			const result = queensConfig.validateAndScore(
				solution,
				puzzleData,
				submission,
			);

			expect(result.valid).toBe(false);
		});

		test("handles null data", () => {
			const submission: GameSubmission = {
				status: "won",
				attempts: 1,
				timeSpentMs: 60000,
				data: null,
			};
			const result = queensConfig.validateAndScore(
				solution,
				puzzleData,
				submission,
			);

			expect(result.valid).toBe(false);
		});

		test("time penalty calculation - odd seconds", () => {
			// 99 seconds = 49 * 2 + 1 = 49 penalty (floors to pairs)
			const submission = createSubmission("won", correctGrid, 99000);
			const result = queensConfig.validateAndScore(
				solution,
				puzzleData,
				submission,
			);

			expect(result.valid).toBe(true);
			if (result.valid) {
				expect(result.score).toBe(451); // 500 - floor(99/2)
			}
		});
	});
});
