/**
 * Word Groups (Connections) Validation Tests
 *
 * Tests for the validateAndScore function which:
 * - Validates submission data
 * - Verifies win/loss claims
 * - Calculates score based on mistakes
 *
 * Scoring: Mistake-based
 * - 0 mistakes: 100 points
 * - 1 mistake: 75 points
 * - 2 mistakes: 50 points
 * - 3 mistakes: 25 points
 * - 4+ mistakes (loss): 0 points
 */

import { describe, expect, test } from "bun:test";
import type { GameSubmission } from "../types";
import {
	type ConnectionsPuzzleData,
	type ConnectionsSolution,
	wordGroupsConfig,
} from "./config";
import type { Category } from "./types";

// Create test data
const testCategories: Category[] = [
	{ name: "Fruits", words: ["APPLE", "BANANA", "CHERRY", "DATE"], level: 0 },
	{ name: "Colors", words: ["RED", "BLUE", "GREEN", "YELLOW"], level: 1 },
	{ name: "Animals", words: ["DOG", "CAT", "BIRD", "FISH"], level: 2 },
	{ name: "Numbers", words: ["ONE", "TWO", "THREE", "FOUR"], level: 3 },
];

const testSolution: ConnectionsSolution = {
	categories: testCategories,
};

const testPuzzleData: ConnectionsPuzzleData = {
	words: testCategories.flatMap((c) => c.words),
	maxMistakes: 4,
	wordsPerCategory: 4,
	totalCategories: 4,
};

// Helper to create submission
function createSubmission(
	status: "won" | "lost",
	foundCategories: string[][],
	mistakes: number,
	timeSpentMs = 120000,
): GameSubmission {
	return {
		status,
		attempts: foundCategories.length + mistakes,
		timeSpentMs,
		data: { foundCategories, mistakes },
	};
}

describe("word-groups validateAndScore", () => {
	describe("valid solutions", () => {
		test("perfect game (0 mistakes) scores 100 points", () => {
			const foundCategories = testCategories.map((c) => c.words);
			const submission = createSubmission("won", foundCategories, 0);
			const result = wordGroupsConfig.validateAndScore(
				testSolution,
				testPuzzleData,
				submission,
			);

			expect(result.valid).toBe(true);
			if (result.valid) {
				expect(result.status).toBe("won");
				expect(result.score).toBe(100);
			}
		});

		test("1 mistake scores 75 points", () => {
			const foundCategories = testCategories.map((c) => c.words);
			const submission = createSubmission("won", foundCategories, 1);
			const result = wordGroupsConfig.validateAndScore(
				testSolution,
				testPuzzleData,
				submission,
			);

			expect(result.valid).toBe(true);
			if (result.valid) {
				expect(result.status).toBe("won");
				expect(result.score).toBe(75);
			}
		});

		test("2 mistakes scores 50 points", () => {
			const foundCategories = testCategories.map((c) => c.words);
			const submission = createSubmission("won", foundCategories, 2);
			const result = wordGroupsConfig.validateAndScore(
				testSolution,
				testPuzzleData,
				submission,
			);

			expect(result.valid).toBe(true);
			if (result.valid) {
				expect(result.status).toBe("won");
				expect(result.score).toBe(50);
			}
		});

		test("3 mistakes scores 25 points", () => {
			const foundCategories = testCategories.map((c) => c.words);
			const submission = createSubmission("won", foundCategories, 3);
			const result = wordGroupsConfig.validateAndScore(
				testSolution,
				testPuzzleData,
				submission,
			);

			expect(result.valid).toBe(true);
			if (result.valid) {
				expect(result.status).toBe("won");
				expect(result.score).toBe(25);
			}
		});

		test("loss scores 0 points", () => {
			const foundCategories = [
				testCategories[0].words,
				testCategories[1].words,
			]; // Only 2 categories
			const submission = createSubmission("lost", foundCategories, 4);
			const result = wordGroupsConfig.validateAndScore(
				testSolution,
				testPuzzleData,
				submission,
			);

			expect(result.valid).toBe(true);
			if (result.valid) {
				expect(result.status).toBe("lost");
				expect(result.score).toBe(0);
			}
		});

		test("categories found in any order are valid", () => {
			// Reversed order
			const foundCategories = [...testCategories].reverse().map((c) => c.words);
			const submission = createSubmission("won", foundCategories, 0);
			const result = wordGroupsConfig.validateAndScore(
				testSolution,
				testPuzzleData,
				submission,
			);

			expect(result.valid).toBe(true);
			if (result.valid) {
				expect(result.status).toBe("won");
				expect(result.score).toBe(100);
			}
		});

		test("words within category can be in any order", () => {
			// Scramble words within each category
			const foundCategories = testCategories.map((c) => [...c.words].reverse());
			const submission = createSubmission("won", foundCategories, 0);
			const result = wordGroupsConfig.validateAndScore(
				testSolution,
				testPuzzleData,
				submission,
			);

			expect(result.valid).toBe(true);
			if (result.valid) {
				expect(result.status).toBe("won");
				expect(result.score).toBe(100);
			}
		});
	});

	describe("invalid submissions", () => {
		test("rejects missing foundCategories", () => {
			const submission: GameSubmission = {
				status: "won",
				attempts: 4,
				timeSpentMs: 120000,
				data: { mistakes: 0 },
			};
			const result = wordGroupsConfig.validateAndScore(
				testSolution,
				testPuzzleData,
				submission,
			);

			expect(result.valid).toBe(false);
			if (!result.valid) {
				expect(result.error).toContain("Missing found categories");
			}
		});

		test("rejects false win claim with incomplete categories", () => {
			const foundCategories = [
				testCategories[0].words,
				testCategories[1].words,
			];
			const submission = createSubmission("won", foundCategories, 0);
			const result = wordGroupsConfig.validateAndScore(
				testSolution,
				testPuzzleData,
				submission,
			);

			expect(result.valid).toBe(false);
			if (!result.valid) {
				expect(result.error).toContain("Invalid win claim");
			}
		});

		test("rejects false loss claim when all categories found", () => {
			const foundCategories = testCategories.map((c) => c.words);
			const submission = createSubmission("lost", foundCategories, 4);
			const result = wordGroupsConfig.validateAndScore(
				testSolution,
				testPuzzleData,
				submission,
			);

			expect(result.valid).toBe(false);
			if (!result.valid) {
				expect(result.error).toContain("Invalid loss claim");
			}
		});

		test("rejects category with wrong word count", () => {
			const foundCategories = [
				["APPLE", "BANANA", "CHERRY"], // Only 3 words
				testCategories[1].words,
				testCategories[2].words,
				testCategories[3].words,
			];
			const submission = createSubmission("won", foundCategories, 0);
			const result = wordGroupsConfig.validateAndScore(
				testSolution,
				testPuzzleData,
				submission,
			);

			// Should count as incomplete (3 valid categories, not 4)
			expect(result.valid).toBe(false);
		});

		test("rejects invalid category grouping", () => {
			const foundCategories = [
				["APPLE", "BANANA", "RED", "BLUE"], // Mixed categories
				testCategories[1].words,
				testCategories[2].words,
				testCategories[3].words,
			];
			const submission = createSubmission("won", foundCategories, 0);
			const result = wordGroupsConfig.validateAndScore(
				testSolution,
				testPuzzleData,
				submission,
			);

			expect(result.valid).toBe(false);
		});
	});

	describe("edge cases", () => {
		test("handles case-insensitive word matching", () => {
			const foundCategories = testCategories.map((c) =>
				c.words.map((w) => w.toLowerCase()),
			);
			const submission = createSubmission("won", foundCategories, 0);
			const result = wordGroupsConfig.validateAndScore(
				testSolution,
				testPuzzleData,
				submission,
			);

			expect(result.valid).toBe(true);
			if (result.valid) {
				expect(result.status).toBe("won");
			}
		});

		test("handles empty found categories as loss", () => {
			const submission = createSubmission("lost", [], 4);
			const result = wordGroupsConfig.validateAndScore(
				testSolution,
				testPuzzleData,
				submission,
			);

			expect(result.valid).toBe(true);
			if (result.valid) {
				expect(result.status).toBe("lost");
				expect(result.score).toBe(0);
			}
		});

		test("high mistake count still scores minimum", () => {
			const foundCategories = testCategories.map((c) => c.words);
			const submission = createSubmission("won", foundCategories, 10);
			const result = wordGroupsConfig.validateAndScore(
				testSolution,
				testPuzzleData,
				submission,
			);

			expect(result.valid).toBe(true);
			if (result.valid) {
				// 100 - 10*25 = -150, but min is 0
				expect(result.score).toBe(0);
			}
		});
	});
});
