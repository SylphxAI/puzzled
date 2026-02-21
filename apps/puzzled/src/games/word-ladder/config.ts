/**
 * Word Ladder Game Configuration
 * Transform one word into another, one letter at a time
 */

import { compareByTime, isPerfectGame } from "@/games/shared";
import { formatTimer } from "@/games/shared/format";
import {
	DEFAULT_LAUNCH_DATE,
	type GameConfig,
	type GameResult,
	type GameSubmission,
} from "../types";
import { WordLadderHowToPlay } from "./components/how-to-play";
import { WordLadderIcon } from "./icon";
import { getPuzzleFromSeed, getWordList } from "./puzzles";
import type {
	WordLadderGuess,
	WordLadderGuessResult,
	WordLadderPuzzleData,
	WordLadderSolution,
} from "./types";
import { isOneLetterChange } from "./types";

// Client-side puzzle data
type WordLadderPuzzleClientData = WordLadderPuzzleData;

export const wordLadderConfig: GameConfig<
	WordLadderPuzzleClientData,
	WordLadderSolution,
	WordLadderGuess,
	WordLadderGuessResult
> = {
	slug: "word-ladder",
	name: "Word Ladder",
	description: "Transform one word into another, changing one letter at a time",
	IconComponent: WordLadderIcon,
	sortOrder: 7,
	category: "word",
	skills: ["vocabulary"],
	difficulty: "medium",
	HowToPlayContent: WordLadderHowToPlay,
	display: {
		taglineKey: "games.wordLadder.tagline",
		highlightKey: "games.wordLadder.highlight",
		duration: "~3 min",
		theme: "orange",
	},
	generationStrategy: "seed",

	launchDate: DEFAULT_LAUNCH_DATE,
	isPerfectGame,
	compareForPercentile: compareByTime,

	// Custom: shows attempts/maxAttempts if available
	formatScoreDisplay: (stats) => {
		if (stats.status === "lost") return "Lost";
		if (stats.attempts && stats.maxAttempts) {
			return `${stats.attempts}/${stats.maxAttempts}`;
		}
		if (stats.timeSpentMs) {
			return formatTimer(stats.timeSpentMs);
		}
		return stats.score ? `${stats.score} pts` : "Won";
	},

	/**
	 * Generate puzzle from seed
	 */
	generatePuzzle(seed: number) {
		return getPuzzleFromSeed(seed);
	},

	/**
	 * Validate a word guess
	 */
	validateGuess(
		solution: WordLadderSolution,
		guess: WordLadderGuess,
	): WordLadderGuessResult {
		const wordList = getWordList();
		const word = guess.word.toLowerCase();

		// Check if it's a valid word
		const isWord = wordList.has(word);
		if (!isWord) {
			return { valid: false, isWord: false, isOneLetterChange: false };
		}

		// For the first word after start, compare to start
		// For subsequent words, compare to the previous word in the user's path
		// We need the previous word which should be passed in context
		// For simplicity, we'll validate against the solution path position
		const previousWord =
			guess.step === 0
				? solution.path[0]
				: solution.path[Math.min(guess.step, solution.path.length - 1)];

		const isValidChange = isOneLetterChange(previousWord, word);
		const reachedEnd = word === solution.path[solution.path.length - 1];

		return {
			valid: isWord && isValidChange,
			isWord: true,
			isOneLetterChange: isValidChange,
			reachedEnd,
		};
	},

	/**
	 * CORE VALIDATION - Validates submission AND calculates score
	 *
	 * Scoring: Step-based
	 * - Base: 100 points for optimal solution
	 * - Penalty: -10 points per extra step
	 * - Minimum: 25 points for a win
	 */
	validateAndScore(
		solution: WordLadderSolution,
		_puzzleData: WordLadderPuzzleClientData,
		submission: GameSubmission,
	): GameResult {
		const data = submission.data as { path?: string[] } | undefined;

		// If lost, no path needed
		if (submission.status === "lost") {
			return { valid: true, status: "lost", score: 0 };
		}

		// Must provide path to validate a win
		if (!data?.path || data.path.length < 2) {
			return { valid: false, error: "No valid path provided" };
		}

		const path = data.path.map((w) => w.toLowerCase());
		const startWord = solution.path[0].toLowerCase();
		const endWord = solution.path[solution.path.length - 1].toLowerCase();

		// Verify path starts with start word
		if (path[0] !== startWord) {
			return { valid: false, error: `Path must start with ${startWord}` };
		}

		// Verify path ends with end word
		if (path[path.length - 1] !== endWord) {
			return { valid: false, error: `Path must end with ${endWord}` };
		}

		// Verify each step is a one-letter change and valid word
		const wordList = getWordList();
		for (let i = 0; i < path.length; i++) {
			// Verify word is valid
			if (!wordList.has(path[i])) {
				return { valid: false, error: `Invalid word: ${path[i]}` };
			}

			// Verify one-letter change (except for first word)
			if (i > 0 && !isOneLetterChange(path[i - 1], path[i])) {
				return {
					valid: false,
					error: `Invalid step: ${path[i - 1]} → ${path[i]}`,
				};
			}
		}

		// Calculate score: 100 - (extra steps * 10)
		const optimalSteps = solution.path.length - 1;
		const playerSteps = path.length - 1;
		const extraSteps = Math.max(0, playerSteps - optimalSteps);
		const score = Math.max(25, 100 - extraSteps * 10);

		return { valid: true, status: "won", score };
	},
};
