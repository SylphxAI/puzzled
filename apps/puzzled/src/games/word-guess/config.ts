/**
 * Wordle game configuration module
 * Implements GameConfig interface for modular game system
 */

import { calculateWordleScore, pickRandom } from "@/games/shared";
import {
	DEFAULT_LAUNCH_DATE,
	type GameConfig,
	type GameResult,
	type GameShareStats,
	type GameSubmission,
} from "../types";
import { WordleHowToPlay } from "./components/how-to-play";
import { WordGuessIcon } from "./icon";
import {
	type LetterStatus,
	MAX_GUESSES,
	WORD_LENGTH,
	type WordlePuzzleData,
	type WordleSolution,
} from "./types";
import { SOLUTION_WORDS, isValidWord } from "./words";

// ==========================================
// Types
// ==========================================

/**
 * Client's guess for validation
 */
type WordleGuess = {
	word: string;
};

/**
 * Result of validating a guess
 */
type WordleGuessResult = {
	valid: boolean;
	evaluation?: LetterStatus[];
	error?: string;
};

// ==========================================
// Helper Functions
// ==========================================

/**
 * Generate deterministic word from seed
 */
function getWordFromSeed(seed: number): string {
	const index = seed % SOLUTION_WORDS.length;
	return SOLUTION_WORDS[index].toUpperCase();
}

/**
 * Evaluate a guess against the solution
 */
function evaluateGuess(guess: string, solution: string): LetterStatus[] {
	const result: LetterStatus[] = Array(WORD_LENGTH).fill("absent");
	const solutionChars = solution.split("");
	const guessChars = guess.split("");

	// First pass: mark correct letters
	for (let i = 0; i < WORD_LENGTH; i++) {
		if (guessChars[i] === solutionChars[i]) {
			result[i] = "correct";
			solutionChars[i] = "";
		}
	}

	// Second pass: mark present letters
	for (let i = 0; i < WORD_LENGTH; i++) {
		if (result[i] === "correct") continue;
		const idx = solutionChars.indexOf(guessChars[i]);
		if (idx !== -1) {
			result[i] = "present";
			solutionChars[idx] = "";
		}
	}

	return result;
}

// ==========================================
// Game Configuration
// ==========================================

export const wordGuessConfig: GameConfig<
	WordlePuzzleData,
	WordleSolution,
	WordleGuess,
	WordleGuessResult
> = {
	slug: "word-guess",
	name: "Word Guess",
	description: "Guess the 5-letter word in 6 tries",
	IconComponent: WordGuessIcon,
	sortOrder: 1,
	category: "word",
	skills: ["vocabulary", "logic"],
	difficulty: "medium",
	HowToPlayContent: WordleHowToPlay,
	display: {
		taglineKey: "games.wordGuess.tagline",
		highlightKey: "games.wordGuess.highlight",
		duration: "~2 min",
		theme: "emerald",
	},

	// Wordle uses deterministic seed-based generation from word list
	// No LLM needed - 2,300+ words = 6+ years of puzzles
	generationStrategy: "seed",

	/**
	 * Generate puzzle from seed
	 * Returns puzzleData (for client) and solution (server-only)
	 */
	generatePuzzle: (seed: number) => {
		const word = getWordFromSeed(seed);

		return {
			puzzleData: {
				wordLength: WORD_LENGTH,
				maxAttempts: MAX_GUESSES,
			},
			solution: {
				word,
			},
		};
	},

	/**
	 * Validate a single guess (real-time feedback)
	 */
	validateGuess: (
		solution: WordleSolution,
		guess: WordleGuess,
	): WordleGuessResult => {
		const word = guess.word.toUpperCase();

		// Validate word length
		if (word.length !== WORD_LENGTH) {
			return { valid: false, error: `Word must be ${WORD_LENGTH} letters` };
		}

		// Validate word exists in dictionary
		if (!isValidWord(word)) {
			return { valid: false, error: "Not a valid word" };
		}

		// Evaluate against solution
		const evaluation = evaluateGuess(word, solution.word.toUpperCase());

		return {
			valid: true,
			evaluation,
		};
	},

	/**
	 * CORE VALIDATION - Validates submission AND calculates score
	 *
	 * Scoring: 100 - (attempts-1)*15
	 * - 1 attempt: 100 points
	 * - 2 attempts: 85 points
	 * - 3 attempts: 70 points
	 * - 4 attempts: 55 points
	 * - 5 attempts: 40 points
	 * - 6 attempts: 25 points
	 * - Loss: 0 points
	 */
	validateAndScore: (
		solution: WordleSolution,
		_puzzleData: WordlePuzzleData,
		submission: GameSubmission,
	): GameResult => {
		const data = submission.data as { guesses?: string[] } | undefined;

		// Must have guesses to validate
		if (
			!data?.guesses ||
			!Array.isArray(data.guesses) ||
			data.guesses.length === 0
		) {
			return { valid: false, error: "Missing guesses data" };
		}

		const guesses = data.guesses;
		const solutionWord = solution.word.toUpperCase();

		// Validate each guess is a real word
		for (const guess of guesses) {
			if (!isValidWord(guess.toUpperCase())) {
				return { valid: false, error: `Invalid word in guesses: ${guess}` };
			}
		}

		// Check if final guess matches solution
		const lastGuess = guesses[guesses.length - 1].toUpperCase();
		const won = lastGuess === solutionWord;

		// Verify claimed status matches reality
		if (submission.status === "won" && !won) {
			return {
				valid: false,
				error: "Invalid win claim - final guess does not match solution",
			};
		}
		if (submission.status === "lost" && won) {
			return {
				valid: false,
				error: "Invalid loss claim - final guess matches solution",
			};
		}

		// Calculate score using shared Wordle-style formula
		const attempts = guesses.length;
		const score = calculateWordleScore(won, attempts);

		return { valid: true, status: won ? "won" : "lost", score };
	},

	/**
	 * Perfect game: solved in 1 attempt
	 */
	isPerfectGame: (stats) => stats.attempts === 1,

	launchDate: DEFAULT_LAUNCH_DATE,

	formatScoreDisplay: (stats) => {
		if (stats.status === "lost") return "X/6";
		return `${stats.attempts}/6`;
	},

	compareForPercentile: (a, b) => {
		// Wins beat losses
		if (a.status === "won" && b.status !== "won") return 1;
		if (a.status !== "won" && b.status === "won") return -1;
		// For wins, fewer attempts = better
		return (b.attempts ?? 6) - (a.attempts ?? 6);
	},

	// ==========================================
	// Share Text Customization
	// ==========================================

	getShareEmoji: (stats: GameShareStats) => {
		if (stats.status === "lost") return pickRandom(["😅", "💔", "🙈", "😤"]);
		const attempts = stats.attempts ?? 6;
		if (attempts === 1) return pickRandom(["🤯", "😱", "🎯"]);
		if (attempts === 2) return pickRandom(["🔥", "⚡", "✨"]);
		if (attempts <= 3) return pickRandom(["💪", "🎉", "🙌"]);
		if (attempts <= 4) return pickRandom(["👍", "😊", "🎊"]);
		return pickRandom(["😮‍💨", "🥵", "😅"]);
	},

	getShareMessage: (stats: GameShareStats) => {
		if (stats.status === "lost") {
			return pickRandom([
				"This one got me...",
				"Tougher than expected!",
				"Can you solve what I couldn't?",
				"This puzzle broke me!",
			]);
		}
		const attempts = stats.attempts ?? 6;
		if (attempts === 1)
			return pickRandom(["First try!", "Nailed it!", "Lucky guess? 🤔"]);
		if (attempts === 2)
			return pickRandom(["Too easy!", "Got it in 2!", "Crushed it!"]);
		if (attempts <= 3)
			return pickRandom(["Not bad!", "Solved it!", "Easy work!"]);
		if (attempts <= 4)
			return pickRandom(["Got it!", "Done!", "Another day, another win!"]);
		return pickRandom(["Close call!", "Phew!", "That was tough!"]);
	},

	getResultString: (stats: GameShareStats) => {
		return stats.status === "won" ? `${stats.attempts ?? 6}/6` : "X/6";
	},

	getChallengeMessage: (stats: GameShareStats) => {
		if (stats.status === "lost") {
			return pickRandom([
				"Can you solve it?",
				"Think you can do better?",
				"Try beating this puzzle!",
			]);
		}
		const attempts = stats.attempts ?? 6;
		if (attempts <= 2) return "Beat my score 👀";
		if (attempts <= 4) return "Think you can beat me?";
		return "Can you do better?";
	},
};
