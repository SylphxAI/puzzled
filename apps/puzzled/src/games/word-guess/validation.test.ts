/**
 * Word Guess (Wordle) Validation Tests
 *
 * Tests for the validateAndScore function which:
 * - Validates submission data
 * - Verifies win/loss claims
 * - Calculates score based on attempts
 *
 * Scoring: 100 - (attempts-1)*15
 * - 1 attempt: 100, 2: 85, 3: 70, 4: 55, 5: 40, 6: 25
 * - Loss: 0
 */

import { describe, expect, test } from "bun:test";
import type { GameSubmission } from "../types";
import { wordGuessConfig } from "./config";

// Helper to create a submission
function createSubmission(
	status: "won" | "lost",
	guesses: string[],
	timeSpentMs = 60000,
): GameSubmission {
	return {
		status,
		attempts: guesses.length,
		timeSpentMs,
		data: { guesses },
	};
}

// Generate a puzzle for testing
const { puzzleData, solution } = wordGuessConfig.generatePuzzle(12345);
const solutionWord = solution.word.toUpperCase();

describe("word-guess validateAndScore", () => {
	describe("valid solutions", () => {
		test("win on first attempt scores 100 points", () => {
			const submission = createSubmission("won", [solutionWord]);
			const result = wordGuessConfig.validateAndScore(
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

		test("win on second attempt scores 85 points", () => {
			const submission = createSubmission("won", ["CRANE", solutionWord]);
			const result = wordGuessConfig.validateAndScore(
				solution,
				puzzleData,
				submission,
			);

			expect(result.valid).toBe(true);
			if (result.valid) {
				expect(result.status).toBe("won");
				expect(result.score).toBe(85);
			}
		});

		test("win on third attempt scores 70 points", () => {
			const submission = createSubmission("won", [
				"CRANE",
				"SLATE",
				solutionWord,
			]);
			const result = wordGuessConfig.validateAndScore(
				solution,
				puzzleData,
				submission,
			);

			expect(result.valid).toBe(true);
			if (result.valid) {
				expect(result.status).toBe("won");
				expect(result.score).toBe(70);
			}
		});

		test("win on fourth attempt scores 55 points", () => {
			const submission = createSubmission("won", [
				"CRANE",
				"SLATE",
				"AUDIO",
				solutionWord,
			]);
			const result = wordGuessConfig.validateAndScore(
				solution,
				puzzleData,
				submission,
			);

			expect(result.valid).toBe(true);
			if (result.valid) {
				expect(result.status).toBe("won");
				expect(result.score).toBe(55);
			}
		});

		test("win on fifth attempt scores 40 points", () => {
			const submission = createSubmission("won", [
				"CRANE",
				"SLATE",
				"AUDIO",
				"PLUMB",
				solutionWord,
			]);
			const result = wordGuessConfig.validateAndScore(
				solution,
				puzzleData,
				submission,
			);

			expect(result.valid).toBe(true);
			if (result.valid) {
				expect(result.status).toBe("won");
				expect(result.score).toBe(40);
			}
		});

		test("win on sixth attempt scores 25 points", () => {
			const submission = createSubmission("won", [
				"CRANE",
				"SLATE",
				"AUDIO",
				"PLUMB",
				"QUICK",
				solutionWord,
			]);
			const result = wordGuessConfig.validateAndScore(
				solution,
				puzzleData,
				submission,
			);

			expect(result.valid).toBe(true);
			if (result.valid) {
				expect(result.status).toBe("won");
				expect(result.score).toBe(25);
			}
		});

		test("loss after 6 incorrect guesses scores 0 points", () => {
			const submission = createSubmission("lost", [
				"CRANE",
				"SLATE",
				"AUDIO",
				"PLUMB",
				"QUICK",
				"JUMPY",
			]);
			const result = wordGuessConfig.validateAndScore(
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
		test("rejects missing guesses data", () => {
			const submission: GameSubmission = {
				status: "won",
				attempts: 1,
				timeSpentMs: 60000,
				data: {},
			};
			const result = wordGuessConfig.validateAndScore(
				solution,
				puzzleData,
				submission,
			);

			expect(result.valid).toBe(false);
			if (!result.valid) {
				expect(result.error).toContain("Missing guesses data");
			}
		});

		test("rejects empty guesses array", () => {
			const submission = createSubmission("won", []);
			const result = wordGuessConfig.validateAndScore(
				solution,
				puzzleData,
				submission,
			);

			expect(result.valid).toBe(false);
			if (!result.valid) {
				expect(result.error).toContain("Missing guesses data");
			}
		});

		test("rejects null data", () => {
			const submission: GameSubmission = {
				status: "won",
				attempts: 1,
				timeSpentMs: 60000,
				data: null,
			};
			const result = wordGuessConfig.validateAndScore(
				solution,
				puzzleData,
				submission,
			);

			expect(result.valid).toBe(false);
		});

		test("rejects invalid word in guesses", () => {
			const submission = createSubmission("won", ["XYZAB", solutionWord]);
			const result = wordGuessConfig.validateAndScore(
				solution,
				puzzleData,
				submission,
			);

			expect(result.valid).toBe(false);
			if (!result.valid) {
				expect(result.error).toContain("Invalid word");
			}
		});

		test("rejects false win claim when final guess does not match", () => {
			const submission = createSubmission("won", ["CRANE", "SLATE"]);
			const result = wordGuessConfig.validateAndScore(
				solution,
				puzzleData,
				submission,
			);

			expect(result.valid).toBe(false);
			if (!result.valid) {
				expect(result.error).toContain("Invalid win claim");
			}
		});

		test("rejects false loss claim when final guess matches", () => {
			const submission = createSubmission("lost", ["CRANE", solutionWord]);
			const result = wordGuessConfig.validateAndScore(
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
		test("handles lowercase guesses", () => {
			const submission = createSubmission("won", [solutionWord.toLowerCase()]);
			const result = wordGuessConfig.validateAndScore(
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

		test("handles mixed case guesses", () => {
			const mixedCase =
				solutionWord.charAt(0) + solutionWord.slice(1).toLowerCase();
			const submission = createSubmission("won", [mixedCase]);
			const result = wordGuessConfig.validateAndScore(
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

		test("validates all intermediate guesses are real words", () => {
			// First guess is invalid, final guess is correct
			const submission = createSubmission("won", ["ZZZZZ", solutionWord]);
			const result = wordGuessConfig.validateAndScore(
				solution,
				puzzleData,
				submission,
			);

			expect(result.valid).toBe(false);
			if (!result.valid) {
				expect(result.error).toContain("Invalid word");
			}
		});
	});
});
