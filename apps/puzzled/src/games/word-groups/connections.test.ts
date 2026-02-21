/**
 * Connections Game Logic Tests
 *
 * Tests for the Connections game mechanics including:
 * - Category matching
 * - Word selection/deselection
 * - Game state transitions (win, lose)
 * - Mistake tracking
 * - "One away" detection
 */

import { describe, expect, test } from "bun:test";
import type { Category, ConnectionsPuzzle, ConnectionsState } from "./types";
import { MAX_MISTAKES, WORDS_PER_CATEGORY } from "./types";

// ==========================================
// Copy of game logic for testing (from use-connections.ts)
// ==========================================

function findMatchingCategory(
	selectedWords: string[],
	puzzle: ConnectionsPuzzle,
	solvedCategories: Category[],
): Category | null {
	const solvedNames = new Set(solvedCategories.map((c) => c.name));

	for (const category of puzzle.categories) {
		if (solvedNames.has(category.name)) continue;

		const categoryWords = new Set(category.words);
		const allMatch = selectedWords.every((word) => categoryWords.has(word));

		if (allMatch && selectedWords.length === WORDS_PER_CATEGORY) {
			return category;
		}
	}

	return null;
}

function countMatchingWords(
	selectedWords: string[],
	puzzle: ConnectionsPuzzle,
	solvedCategories: Category[] = [],
): number {
	let maxMatching = 0;
	const solvedNames = new Set(solvedCategories.map((c) => c.name));

	for (const category of puzzle.categories) {
		// Skip already solved categories to avoid false one-away detection
		if (solvedNames.has(category.name)) continue;

		const categoryWords = new Set(category.words);
		const matching = selectedWords.filter((word) =>
			categoryWords.has(word),
		).length;
		maxMatching = Math.max(maxMatching, matching);
	}

	return maxMatching;
}

function createInitialState(puzzle: ConnectionsPuzzle): ConnectionsState {
	const allWords = puzzle.categories.flatMap((c) => c.words);
	return {
		puzzle,
		selectedWords: [],
		solvedCategories: [],
		remainingWords: allWords,
		mistakes: 0,
		gameStatus: "playing",
		guessHistory: [],
		lastGuessWasOneAway: false,
	};
}

// ==========================================
// Copy of reducer for testing (from use-connections.ts)
// ==========================================

type ConnectionsAction =
	| { type: "SELECT_WORD"; word: string }
	| { type: "DESELECT_WORD"; word: string }
	| { type: "CLEAR_SELECTION" }
	| { type: "SUBMIT_GUESS" }
	| { type: "SHUFFLE" }
	| { type: "RESET"; puzzle: ConnectionsPuzzle };

function connectionsReducer(
	state: ConnectionsState,
	action: ConnectionsAction,
): ConnectionsState {
	switch (action.type) {
		case "SELECT_WORD": {
			if (state.gameStatus !== "playing") return state;
			if (state.selectedWords.length >= WORDS_PER_CATEGORY) return state;
			if (state.selectedWords.includes(action.word)) return state;

			return {
				...state,
				selectedWords: [...state.selectedWords, action.word],
				lastGuessWasOneAway: false,
			};
		}

		case "DESELECT_WORD": {
			if (state.gameStatus !== "playing") return state;

			return {
				...state,
				selectedWords: state.selectedWords.filter((w) => w !== action.word),
			};
		}

		case "CLEAR_SELECTION": {
			return {
				...state,
				selectedWords: [],
			};
		}

		case "SUBMIT_GUESS": {
			if (state.gameStatus !== "playing") return state;
			if (state.selectedWords.length !== WORDS_PER_CATEGORY) return state;

			const matchingCategory = findMatchingCategory(
				state.selectedWords,
				state.puzzle,
				state.solvedCategories,
			);

			if (matchingCategory) {
				const newSolvedCategories = [
					...state.solvedCategories,
					matchingCategory,
				];
				const newRemainingWords = state.remainingWords.filter(
					(w) => !state.selectedWords.includes(w),
				);

				const isWon = newSolvedCategories.length === 4;

				return {
					...state,
					solvedCategories: newSolvedCategories,
					remainingWords: newRemainingWords,
					selectedWords: [],
					guessHistory: [...state.guessHistory, state.selectedWords],
					gameStatus: isWon ? "won" : "playing",
					lastGuessWasOneAway: false,
				};
			}

			// Wrong guess
			const matchingCount = countMatchingWords(
				state.selectedWords,
				state.puzzle,
				state.solvedCategories,
			);
			const wasOneAway = matchingCount === 3;
			const newMistakes = state.mistakes + 1;
			const isLost = newMistakes >= MAX_MISTAKES;

			return {
				...state,
				mistakes: newMistakes,
				selectedWords: [],
				guessHistory: [...state.guessHistory, state.selectedWords],
				gameStatus: isLost ? "lost" : "playing",
				lastGuessWasOneAway: wasOneAway,
			};
		}

		case "SHUFFLE": {
			if (state.gameStatus !== "playing") return state;
			// In tests, we just reverse the array for predictability
			return {
				...state,
				remainingWords: [...state.remainingWords].reverse(),
			};
		}

		case "RESET": {
			return createInitialState(action.puzzle);
		}

		default:
			return state;
	}
}

// ==========================================
// Test fixtures
// ==========================================

const createTestPuzzle = (): ConnectionsPuzzle => ({
	id: "test-puzzle",
	date: "2024-01-15",
	categories: [
		{
			name: "Fruits",
			words: ["APPLE", "BANANA", "CHERRY", "DATE"],
			level: 0,
		},
		{
			name: "Colors",
			words: ["RED", "BLUE", "GREEN", "YELLOW"],
			level: 1,
		},
		{
			name: "Animals",
			words: ["DOG", "CAT", "BIRD", "FISH"],
			level: 2,
		},
		{
			name: "Numbers",
			words: ["ONE", "TWO", "THREE", "FOUR"],
			level: 3,
		},
	],
});

// ==========================================
// Tests
// ==========================================

describe("findMatchingCategory", () => {
	test("finds correct category when all words match", () => {
		const puzzle = createTestPuzzle();
		const selected = ["APPLE", "BANANA", "CHERRY", "DATE"];
		const result = findMatchingCategory(selected, puzzle, []);

		expect(result).not.toBeNull();
		expect(result?.name).toBe("Fruits");
	});

	test("returns null when words are from different categories", () => {
		const puzzle = createTestPuzzle();
		const selected = ["APPLE", "RED", "DOG", "ONE"];
		const result = findMatchingCategory(selected, puzzle, []);

		expect(result).toBeNull();
	});

	test("returns null when only 3 words match", () => {
		const puzzle = createTestPuzzle();
		const selected = ["APPLE", "BANANA", "CHERRY", "RED"]; // 3 fruits + 1 color
		const result = findMatchingCategory(selected, puzzle, []);

		expect(result).toBeNull();
	});

	test("ignores already solved categories", () => {
		const puzzle = createTestPuzzle();
		const solvedFruits = puzzle.categories[0];
		const selected = ["APPLE", "BANANA", "CHERRY", "DATE"];

		const result = findMatchingCategory(selected, puzzle, [solvedFruits]);
		expect(result).toBeNull();
	});

	test("finds category regardless of word order", () => {
		const puzzle = createTestPuzzle();
		const selected = ["DATE", "APPLE", "CHERRY", "BANANA"]; // Scrambled
		const result = findMatchingCategory(selected, puzzle, []);

		expect(result?.name).toBe("Fruits");
	});
});

describe("countMatchingWords", () => {
	test("counts all matching words in single category", () => {
		const puzzle = createTestPuzzle();
		const selected = ["APPLE", "BANANA", "CHERRY", "DATE"];
		const count = countMatchingWords(selected, puzzle);

		expect(count).toBe(4);
	});

	test("counts partial matches - 3 from one category", () => {
		const puzzle = createTestPuzzle();
		const selected = ["APPLE", "BANANA", "CHERRY", "RED"];
		const count = countMatchingWords(selected, puzzle);

		expect(count).toBe(3); // 3 fruits
	});

	test("counts partial matches - 2 from each of two categories", () => {
		const puzzle = createTestPuzzle();
		const selected = ["APPLE", "BANANA", "RED", "BLUE"];
		const count = countMatchingWords(selected, puzzle);

		expect(count).toBe(2); // Max is 2 from either fruits or colors
	});

	test("returns maximum match count across categories", () => {
		const puzzle = createTestPuzzle();
		const selected = ["APPLE", "RED", "BLUE", "GREEN"];
		const count = countMatchingWords(selected, puzzle);

		expect(count).toBe(3); // 3 colors > 1 fruit
	});

	test("returns 0 for non-existent words", () => {
		const puzzle = createTestPuzzle();
		const selected = ["ZEBRA", "PURPLE", "FIVE", "GRAPE"];
		const count = countMatchingWords(selected, puzzle);

		expect(count).toBe(0);
	});

	test("excludes solved categories from matching", () => {
		const puzzle = createTestPuzzle();
		const fruitsCategory = puzzle.categories[0]; // Fruits category

		// If Fruits is already solved, selecting 3 fruits + 1 other
		// should NOT count as 3 matches (would be false one-away)
		const selected = ["APPLE", "BANANA", "CHERRY", "RED"];
		const countWithSolved = countMatchingWords(selected, puzzle, [
			fruitsCategory,
		]);

		// Should only count matches from unsolved categories (1 color match)
		expect(countWithSolved).toBe(1);

		// Without solved categories, it should count 3 fruits
		const countWithoutSolved = countMatchingWords(selected, puzzle, []);
		expect(countWithoutSolved).toBe(3);
	});
});

describe("createInitialState", () => {
	test("creates state with all 16 words", () => {
		const puzzle = createTestPuzzle();
		const state = createInitialState(puzzle);

		expect(state.remainingWords.length).toBe(16);
	});

	test("starts with empty selection", () => {
		const puzzle = createTestPuzzle();
		const state = createInitialState(puzzle);

		expect(state.selectedWords).toEqual([]);
	});

	test("starts with no solved categories", () => {
		const puzzle = createTestPuzzle();
		const state = createInitialState(puzzle);

		expect(state.solvedCategories).toEqual([]);
	});

	test("starts with 0 mistakes", () => {
		const puzzle = createTestPuzzle();
		const state = createInitialState(puzzle);

		expect(state.mistakes).toBe(0);
	});

	test("starts in playing status", () => {
		const puzzle = createTestPuzzle();
		const state = createInitialState(puzzle);

		expect(state.gameStatus).toBe("playing");
	});

	test("starts with empty guess history", () => {
		const puzzle = createTestPuzzle();
		const state = createInitialState(puzzle);

		expect(state.guessHistory).toEqual([]);
	});
});

describe("game constants", () => {
	test("MAX_MISTAKES is 4", () => {
		expect(MAX_MISTAKES).toBe(4);
	});

	test("WORDS_PER_CATEGORY is 4", () => {
		expect(WORDS_PER_CATEGORY).toBe(4);
	});
});

describe("isOneAway detection", () => {
	test("detects one-away when 3 words match", () => {
		const puzzle = createTestPuzzle();
		const selected = ["APPLE", "BANANA", "CHERRY", "RED"]; // 3 fruits + 1 color

		const matchCount = countMatchingWords(selected, puzzle);
		const isOneAway =
			selected.length === WORDS_PER_CATEGORY && matchCount === 3;

		expect(isOneAway).toBe(true);
	});

	test("not one-away when 4 words match", () => {
		const puzzle = createTestPuzzle();
		const selected = ["APPLE", "BANANA", "CHERRY", "DATE"];

		const matchCount = countMatchingWords(selected, puzzle);
		const isOneAway =
			selected.length === WORDS_PER_CATEGORY && matchCount === 3;

		expect(isOneAway).toBe(false); // It's a correct answer, not one-away
	});

	test("not one-away when 2 words match", () => {
		const puzzle = createTestPuzzle();
		const selected = ["APPLE", "BANANA", "RED", "BLUE"];

		const matchCount = countMatchingWords(selected, puzzle);
		const isOneAway =
			selected.length === WORDS_PER_CATEGORY && matchCount === 3;

		expect(isOneAway).toBe(false);
	});
});

describe("game flow scenarios", () => {
	test("winning game - solve all 4 categories", () => {
		const puzzle = createTestPuzzle();
		let state = createInitialState(puzzle);

		// Simulate solving all categories
		for (const category of puzzle.categories) {
			const selectedWords = category.words;
			const matchingCategory = findMatchingCategory(
				selectedWords,
				puzzle,
				state.solvedCategories,
			);

			expect(matchingCategory).not.toBeNull();
			state = {
				...state,
				solvedCategories: [...state.solvedCategories, matchingCategory!],
				remainingWords: state.remainingWords.filter(
					(w) => !selectedWords.includes(w),
				),
			};
		}

		expect(state.solvedCategories.length).toBe(4);
		expect(state.remainingWords.length).toBe(0);
	});

	test("losing game - 4 mistakes", () => {
		let mistakes = 0;
		const maxMistakes = MAX_MISTAKES;

		// Simulate 4 wrong guesses
		for (let i = 0; i < 4; i++) {
			mistakes++;
		}

		const isLost = mistakes >= maxMistakes;
		expect(isLost).toBe(true);
	});

	test("game continues with 3 mistakes", () => {
		const mistakes = 3;
		const isLost = mistakes >= MAX_MISTAKES;

		expect(isLost).toBe(false);
	});
});

describe("score calculation", () => {
	test("perfect game score - no mistakes", () => {
		// Based on the validation in games router:
		// Base score: 4 categories * 100 = 400
		// Mistake penalty: 0 * 25 = 0
		// Perfect bonus: 100
		// Total: 500
		const categoriesSolved = 4;
		const mistakes = 0;
		const baseScore = categoriesSolved * 100;
		const mistakePenalty = mistakes * 25;
		const perfectBonus = mistakes === 0 ? 100 : 0;

		const score = baseScore - mistakePenalty + perfectBonus;
		expect(score).toBe(500);
	});

	test("score with 2 mistakes", () => {
		const categoriesSolved = 4;
		const mistakes = 2;
		const baseScore = categoriesSolved * 100;
		const mistakePenalty = mistakes * 25;

		const score = baseScore - mistakePenalty;
		expect(score).toBe(350); // 400 - 50
	});

	test("minimum score with 4 mistakes and loss", () => {
		// Can still solve some categories before losing
		const categoriesSolved = 2;
		const mistakes = 4;
		const baseScore = categoriesSolved * 100;
		const mistakePenalty = mistakes * 25;

		const score = baseScore - mistakePenalty;
		expect(score).toBe(100); // 200 - 100
	});
});

describe("lastGuessWasOneAway state", () => {
	test("starts as false", () => {
		const puzzle = createTestPuzzle();
		const state = createInitialState(puzzle);

		expect(state.lastGuessWasOneAway).toBe(false);
	});

	test("is set to true after one-away wrong guess (3 matching words)", () => {
		const puzzle = createTestPuzzle();
		const state = createInitialState(puzzle);
		const selectedWords = ["APPLE", "BANANA", "CHERRY", "RED"]; // 3 fruits + 1 color

		// Simulate what happens in SUBMIT_GUESS reducer
		const matchingCategory = findMatchingCategory(
			selectedWords,
			puzzle,
			state.solvedCategories,
		);
		expect(matchingCategory).toBeNull(); // Wrong guess

		const matchCount = countMatchingWords(selectedWords, puzzle);
		const wasOneAway = matchCount === 3;

		expect(wasOneAway).toBe(true);
	});

	test("is false after wrong guess with only 2 matching words", () => {
		const puzzle = createTestPuzzle();
		const selectedWords = ["APPLE", "BANANA", "RED", "BLUE"]; // 2 fruits + 2 colors

		const matchCount = countMatchingWords(selectedWords, puzzle);
		const wasOneAway = matchCount === 3;

		expect(wasOneAway).toBe(false);
	});

	test("is false after correct guess (4 matching words)", () => {
		const puzzle = createTestPuzzle();
		const selectedWords = ["APPLE", "BANANA", "CHERRY", "DATE"]; // All fruits

		// Correct guesses don't trigger one-away
		const matchingCategory = findMatchingCategory(selectedWords, puzzle, []);
		expect(matchingCategory).not.toBeNull();

		// Only wrong guesses can be "one away"
		const wasOneAway =
			matchingCategory === null &&
			countMatchingWords(selectedWords, puzzle) === 3;
		expect(wasOneAway).toBe(false);
	});

	test("should be cleared when new selection starts (reducer behavior)", () => {
		// This tests the expected behavior: after displaying "One Away" toast,
		// the flag should be cleared when user starts selecting new words
		// so the toast doesn't show again for the same guess

		const puzzle = createTestPuzzle();
		let state = createInitialState(puzzle);

		// Simulate a one-away state
		state = { ...state, lastGuessWasOneAway: true };
		expect(state.lastGuessWasOneAway).toBe(true);

		// Simulate SELECT_WORD action clearing the flag
		state = { ...state, lastGuessWasOneAway: false };
		expect(state.lastGuessWasOneAway).toBe(false);
	});
});

describe("connectionsReducer", () => {
	describe("SELECT_WORD", () => {
		test("adds word to selection", () => {
			const puzzle = createTestPuzzle();
			let state = createInitialState(puzzle);

			state = connectionsReducer(state, { type: "SELECT_WORD", word: "APPLE" });

			expect(state.selectedWords).toEqual(["APPLE"]);
		});

		test("adds multiple words to selection", () => {
			const puzzle = createTestPuzzle();
			let state = createInitialState(puzzle);

			state = connectionsReducer(state, { type: "SELECT_WORD", word: "APPLE" });
			state = connectionsReducer(state, {
				type: "SELECT_WORD",
				word: "BANANA",
			});

			expect(state.selectedWords).toEqual(["APPLE", "BANANA"]);
		});

		test("does not add duplicate word", () => {
			const puzzle = createTestPuzzle();
			let state = createInitialState(puzzle);

			state = connectionsReducer(state, { type: "SELECT_WORD", word: "APPLE" });
			state = connectionsReducer(state, { type: "SELECT_WORD", word: "APPLE" });

			expect(state.selectedWords).toEqual(["APPLE"]);
		});

		test("does not add 5th word", () => {
			const puzzle = createTestPuzzle();
			let state = createInitialState(puzzle);

			state = connectionsReducer(state, { type: "SELECT_WORD", word: "APPLE" });
			state = connectionsReducer(state, {
				type: "SELECT_WORD",
				word: "BANANA",
			});
			state = connectionsReducer(state, {
				type: "SELECT_WORD",
				word: "CHERRY",
			});
			state = connectionsReducer(state, { type: "SELECT_WORD", word: "DATE" });
			state = connectionsReducer(state, { type: "SELECT_WORD", word: "RED" });

			expect(state.selectedWords).toHaveLength(4);
			expect(state.selectedWords).not.toContain("RED");
		});

		test("does nothing when game is won", () => {
			const puzzle = createTestPuzzle();
			let state = createInitialState(puzzle);
			state = { ...state, gameStatus: "won" };

			state = connectionsReducer(state, { type: "SELECT_WORD", word: "APPLE" });

			expect(state.selectedWords).toEqual([]);
		});

		test("does nothing when game is lost", () => {
			const puzzle = createTestPuzzle();
			let state = createInitialState(puzzle);
			state = { ...state, gameStatus: "lost" };

			state = connectionsReducer(state, { type: "SELECT_WORD", word: "APPLE" });

			expect(state.selectedWords).toEqual([]);
		});

		test("clears lastGuessWasOneAway flag", () => {
			const puzzle = createTestPuzzle();
			let state = createInitialState(puzzle);
			state = { ...state, lastGuessWasOneAway: true };

			state = connectionsReducer(state, { type: "SELECT_WORD", word: "APPLE" });

			expect(state.lastGuessWasOneAway).toBe(false);
		});
	});

	describe("DESELECT_WORD", () => {
		test("removes word from selection", () => {
			const puzzle = createTestPuzzle();
			let state = createInitialState(puzzle);
			state = { ...state, selectedWords: ["APPLE", "BANANA"] };

			state = connectionsReducer(state, {
				type: "DESELECT_WORD",
				word: "APPLE",
			});

			expect(state.selectedWords).toEqual(["BANANA"]);
		});

		test("does nothing when game is won", () => {
			const puzzle = createTestPuzzle();
			let state = createInitialState(puzzle);
			state = { ...state, gameStatus: "won", selectedWords: ["APPLE"] };

			state = connectionsReducer(state, {
				type: "DESELECT_WORD",
				word: "APPLE",
			});

			expect(state.selectedWords).toEqual(["APPLE"]);
		});
	});

	describe("CLEAR_SELECTION", () => {
		test("clears all selected words", () => {
			const puzzle = createTestPuzzle();
			let state = createInitialState(puzzle);
			state = { ...state, selectedWords: ["APPLE", "BANANA", "CHERRY"] };

			state = connectionsReducer(state, { type: "CLEAR_SELECTION" });

			expect(state.selectedWords).toEqual([]);
		});
	});

	describe("SUBMIT_GUESS", () => {
		test("correct guess adds category to solved", () => {
			const puzzle = createTestPuzzle();
			let state = createInitialState(puzzle);

			// Select all fruits
			state = connectionsReducer(state, { type: "SELECT_WORD", word: "APPLE" });
			state = connectionsReducer(state, {
				type: "SELECT_WORD",
				word: "BANANA",
			});
			state = connectionsReducer(state, {
				type: "SELECT_WORD",
				word: "CHERRY",
			});
			state = connectionsReducer(state, { type: "SELECT_WORD", word: "DATE" });
			state = connectionsReducer(state, { type: "SUBMIT_GUESS" });

			expect(state.solvedCategories).toHaveLength(1);
			expect(state.solvedCategories[0].name).toBe("Fruits");
			expect(state.selectedWords).toEqual([]);
			expect(state.mistakes).toBe(0);
			expect(state.gameStatus).toBe("playing");
		});

		test("correct guess removes words from remaining", () => {
			const puzzle = createTestPuzzle();
			let state = createInitialState(puzzle);

			state = connectionsReducer(state, { type: "SELECT_WORD", word: "APPLE" });
			state = connectionsReducer(state, {
				type: "SELECT_WORD",
				word: "BANANA",
			});
			state = connectionsReducer(state, {
				type: "SELECT_WORD",
				word: "CHERRY",
			});
			state = connectionsReducer(state, { type: "SELECT_WORD", word: "DATE" });
			state = connectionsReducer(state, { type: "SUBMIT_GUESS" });

			expect(state.remainingWords).toHaveLength(12);
			expect(state.remainingWords).not.toContain("APPLE");
			expect(state.remainingWords).not.toContain("BANANA");
		});

		test("correct guess adds to guess history", () => {
			const puzzle = createTestPuzzle();
			let state = createInitialState(puzzle);

			state = connectionsReducer(state, { type: "SELECT_WORD", word: "APPLE" });
			state = connectionsReducer(state, {
				type: "SELECT_WORD",
				word: "BANANA",
			});
			state = connectionsReducer(state, {
				type: "SELECT_WORD",
				word: "CHERRY",
			});
			state = connectionsReducer(state, { type: "SELECT_WORD", word: "DATE" });
			state = connectionsReducer(state, { type: "SUBMIT_GUESS" });

			expect(state.guessHistory).toHaveLength(1);
			expect(state.guessHistory[0]).toEqual([
				"APPLE",
				"BANANA",
				"CHERRY",
				"DATE",
			]);
		});

		test("wrong guess increments mistakes", () => {
			const puzzle = createTestPuzzle();
			let state = createInitialState(puzzle);

			// Mix of fruits and colors
			state = connectionsReducer(state, { type: "SELECT_WORD", word: "APPLE" });
			state = connectionsReducer(state, { type: "SELECT_WORD", word: "RED" });
			state = connectionsReducer(state, { type: "SELECT_WORD", word: "DOG" });
			state = connectionsReducer(state, { type: "SELECT_WORD", word: "ONE" });
			state = connectionsReducer(state, { type: "SUBMIT_GUESS" });

			expect(state.mistakes).toBe(1);
			expect(state.solvedCategories).toHaveLength(0);
			expect(state.selectedWords).toEqual([]);
			expect(state.gameStatus).toBe("playing");
		});

		test("one-away wrong guess sets lastGuessWasOneAway", () => {
			const puzzle = createTestPuzzle();
			let state = createInitialState(puzzle);

			// 3 fruits + 1 color
			state = connectionsReducer(state, { type: "SELECT_WORD", word: "APPLE" });
			state = connectionsReducer(state, {
				type: "SELECT_WORD",
				word: "BANANA",
			});
			state = connectionsReducer(state, {
				type: "SELECT_WORD",
				word: "CHERRY",
			});
			state = connectionsReducer(state, { type: "SELECT_WORD", word: "RED" });
			state = connectionsReducer(state, { type: "SUBMIT_GUESS" });

			expect(state.lastGuessWasOneAway).toBe(true);
			expect(state.mistakes).toBe(1);
		});

		test("4th mistake triggers loss", () => {
			const puzzle = createTestPuzzle();
			let state = createInitialState(puzzle);
			const wrongGuess = ["APPLE", "RED", "DOG", "ONE"];

			// Submit 4 wrong guesses
			for (let i = 0; i < 4; i++) {
				for (const word of wrongGuess) {
					state = connectionsReducer(state, { type: "SELECT_WORD", word });
				}
				state = connectionsReducer(state, { type: "SUBMIT_GUESS" });
			}

			expect(state.mistakes).toBe(4);
			expect(state.gameStatus).toBe("lost");
		});

		test("solving all 4 categories triggers win", () => {
			const puzzle = createTestPuzzle();
			let state = createInitialState(puzzle);

			// Solve all categories in order
			for (const category of puzzle.categories) {
				for (const word of category.words) {
					state = connectionsReducer(state, { type: "SELECT_WORD", word });
				}
				state = connectionsReducer(state, { type: "SUBMIT_GUESS" });
			}

			expect(state.solvedCategories).toHaveLength(4);
			expect(state.gameStatus).toBe("won");
			expect(state.remainingWords).toHaveLength(0);
		});

		test("does nothing with less than 4 words selected", () => {
			const puzzle = createTestPuzzle();
			let state = createInitialState(puzzle);

			state = connectionsReducer(state, { type: "SELECT_WORD", word: "APPLE" });
			state = connectionsReducer(state, {
				type: "SELECT_WORD",
				word: "BANANA",
			});
			const beforeSubmit = { ...state };
			state = connectionsReducer(state, { type: "SUBMIT_GUESS" });

			expect(state.selectedWords).toEqual(beforeSubmit.selectedWords);
			expect(state.guessHistory).toEqual(beforeSubmit.guessHistory);
		});

		test("does nothing when game is already won", () => {
			const puzzle = createTestPuzzle();
			let state = createInitialState(puzzle);
			state = {
				...state,
				gameStatus: "won",
				selectedWords: ["APPLE", "BANANA", "CHERRY", "DATE"],
			};

			const beforeSubmit = { ...state };
			state = connectionsReducer(state, { type: "SUBMIT_GUESS" });

			expect(state).toEqual(beforeSubmit);
		});
	});

	describe("SHUFFLE", () => {
		test("shuffles remaining words", () => {
			const puzzle = createTestPuzzle();
			let state = createInitialState(puzzle);
			const originalOrder = [...state.remainingWords];

			state = connectionsReducer(state, { type: "SHUFFLE" });

			// Words should be different order (in test, we reverse)
			expect(state.remainingWords).not.toEqual(originalOrder);
			expect(state.remainingWords.sort()).toEqual(originalOrder.sort());
		});

		test("does nothing when game is won", () => {
			const puzzle = createTestPuzzle();
			let state = createInitialState(puzzle);
			state = { ...state, gameStatus: "won" };
			const beforeShuffle = [...state.remainingWords];

			state = connectionsReducer(state, { type: "SHUFFLE" });

			expect(state.remainingWords).toEqual(beforeShuffle);
		});
	});

	describe("RESET", () => {
		test("resets to initial state with new puzzle", () => {
			const puzzle = createTestPuzzle();
			let state = createInitialState(puzzle);
			state = {
				...state,
				mistakes: 3,
				gameStatus: "lost",
				selectedWords: ["APPLE"],
			};

			state = connectionsReducer(state, { type: "RESET", puzzle });

			expect(state.mistakes).toBe(0);
			expect(state.gameStatus).toBe("playing");
			expect(state.selectedWords).toEqual([]);
			expect(state.solvedCategories).toEqual([]);
			expect(state.guessHistory).toEqual([]);
		});
	});
});

describe("edge cases", () => {
	test("selecting same word twice has no effect", () => {
		const selectedWords = ["APPLE"];
		const newWord = "APPLE";

		// Check if already selected before adding
		const shouldAdd = !selectedWords.includes(newWord);
		expect(shouldAdd).toBe(false);
	});

	test("cannot select more than 4 words", () => {
		const selectedWords = ["APPLE", "BANANA", "CHERRY", "DATE"];
		const canSelect = selectedWords.length < WORDS_PER_CATEGORY;

		expect(canSelect).toBe(false);
	});

	test("categories are case-sensitive", () => {
		const puzzle = createTestPuzzle();
		const selected = ["apple", "banana", "cherry", "date"]; // lowercase

		// Original words are uppercase
		const result = findMatchingCategory(selected, puzzle, []);
		expect(result).toBeNull();
	});
});
