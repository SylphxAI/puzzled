/**
 * Word Search Validation Tests
 *
 * Tests for the validateAndScore function which:
 * - Validates submission found words data
 * - Verifies all found words are valid
 * - Calculates score based on time
 *
 * Scoring: Time-based
 * - Base: 500 points
 * - Time penalty: -1 point per 2 seconds
 * - Minimum: 100 points for a win
 */

import { describe, expect, test } from "bun:test";
import type { GameSubmission } from "../types";
import { wordSearchConfig } from "./config";

// Generate a puzzle for testing
const { puzzleData, solution } = wordSearchConfig.generatePuzzle(12345);

// All words that need to be found
const allWords = solution.words;

// Helper to create submission
function createSubmission(
	status: "won" | "lost",
	foundWords: string[] | undefined,
	timeSpentMs: number,
): GameSubmission {
	return {
		status,
		attempts: foundWords?.length ?? 0,
		timeSpentMs,
		data: foundWords !== undefined ? { foundWords } : {},
	};
}

describe("word-search validateAndScore", () => {
	describe("valid solutions", () => {
		test("fast solve scores 500 points", () => {
			const submission = createSubmission("won", allWords, 0);
			const result = wordSearchConfig.validateAndScore(
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
			const submission = createSubmission("won", allWords, 100000);
			const result = wordSearchConfig.validateAndScore(
				solution,
				puzzleData,
				submission,
			);

			expect(result.valid).toBe(true);
			if (result.valid) {
				expect(result.status).toBe("won");
				expect(result.score).toBe(450); // 500 - 50
			}
		});

		test("200 second solve scores 400 points", () => {
			const submission = createSubmission("won", allWords, 200000);
			const result = wordSearchConfig.validateAndScore(
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
			const submission = createSubmission("won", allWords, 2000000);
			const result = wordSearchConfig.validateAndScore(
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
			const partialWords = allWords.slice(0, Math.floor(allWords.length / 2));
			const submission = createSubmission("lost", partialWords, 60000);
			const result = wordSearchConfig.validateAndScore(
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
		test("rejects missing foundWords data", () => {
			const submission = createSubmission("won", undefined, 60000);
			const result = wordSearchConfig.validateAndScore(
				solution,
				puzzleData,
				submission,
			);

			expect(result.valid).toBe(false);
			if (!result.valid) {
				expect(result.error).toContain("Missing found words");
			}
		});

		test("rejects invalid word in found words", () => {
			const wordsWithInvalid = [...allWords, "NOTAVALIDWORD"];
			const submission = createSubmission("won", wordsWithInvalid, 60000);
			const result = wordSearchConfig.validateAndScore(
				solution,
				puzzleData,
				submission,
			);

			expect(result.valid).toBe(false);
			if (!result.valid) {
				expect(result.error).toContain("Invalid word");
			}
		});

		test("rejects false win claim with incomplete words", () => {
			const partialWords = allWords.slice(0, -1); // Missing one word
			const submission = createSubmission("won", partialWords, 60000);
			const result = wordSearchConfig.validateAndScore(
				solution,
				puzzleData,
				submission,
			);

			expect(result.valid).toBe(false);
			if (!result.valid) {
				expect(result.error).toContain("Invalid win claim");
			}
		});

		test("rejects false loss claim when all words found", () => {
			const submission = createSubmission("lost", allWords, 60000);
			const result = wordSearchConfig.validateAndScore(
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
		test("handles null data", () => {
			const submission: GameSubmission = {
				status: "won",
				attempts: 0,
				timeSpentMs: 60000,
				data: null,
			};
			const result = wordSearchConfig.validateAndScore(
				solution,
				puzzleData,
				submission,
			);

			expect(result.valid).toBe(false);
		});

		test("empty found words array is a loss", () => {
			const submission = createSubmission("lost", [], 60000);
			const result = wordSearchConfig.validateAndScore(
				solution,
				puzzleData,
				submission,
			);

			expect(result.valid).toBe(true);
			if (result.valid) {
				expect(result.status).toBe("lost");
			}
		});

		test("time penalty calculation - odd seconds", () => {
			// 99 seconds = floor(99/2) = 49 penalty
			const submission = createSubmission("won", allWords, 99000);
			const result = wordSearchConfig.validateAndScore(
				solution,
				puzzleData,
				submission,
			);

			expect(result.valid).toBe(true);
			if (result.valid) {
				expect(result.score).toBe(451); // 500 - 49
			}
		});

		test("words can be found in any order", () => {
			const reversedWords = [...allWords].reverse();
			const submission = createSubmission("won", reversedWords, 0);
			const result = wordSearchConfig.validateAndScore(
				solution,
				puzzleData,
				submission,
			);

			expect(result.valid).toBe(true);
			if (result.valid) {
				expect(result.status).toBe("won");
			}
		});
	});
});
