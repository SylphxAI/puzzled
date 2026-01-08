/**
 * Core game types and interfaces for modular game system
 *
 * PLUG-AND-PLAY ARCHITECTURE:
 * Each game is a self-contained module. Adding a new game:
 * 1. Create folder: /src/games/[game-slug]/
 * 2. Implement GameConfig with all required fields
 * 3. Create components/how-to-play.tsx for game rules
 * 4. Create translations/ folder with en.json (+ other locales)
 * 5. Register in /src/games/registry.ts
 *
 * That's it - no other files need to be modified.
 *
 * SECURITY ARCHITECTURE:
 * - Client NEVER calculates score
 * - Client sends submission data (moves, final state, etc.)
 * - Server validates AND calculates score using validateAndScore()
 * - This prevents score manipulation attacks
 */

import type { ComponentType } from 'react'

// ==========================================
// Constants
// ==========================================

/**
 * Default launch date for all games.
 * Used for day-number calculations (seed = days since launch).
 * DO NOT CHANGE after initial release - breaks historical puzzles.
 */
export const DEFAULT_LAUNCH_DATE = new Date('2024-01-01')

// ==========================================
// Game Classification
// ==========================================

/**
 * Primary game category for UI grouping
 */
export type GameCategory = 'word' | 'logic' | 'math' | 'spatial'

/**
 * Skills/abilities tested by a game
 * Used for filtering, recommendations, and skill badges
 */
export type GameSkill =
	| 'vocabulary' // Word knowledge
	| 'spelling' // Spelling ability
	| 'association' // Word/concept association
	| 'logic' // Logical deduction
	| 'arithmetic' // Math operations
	| 'pattern' // Pattern recognition
	| 'spatial' // Spatial reasoning
	| 'memory' // Memory/recall

/**
 * Base difficulty level (for games without difficulty selection)
 */
export type GameDifficulty = 'easy' | 'medium' | 'hard'

/**
 * Puzzle difficulty level (for games with difficulty selection)
 * Used when a game supports multiple difficulty levels
 */
export type PuzzleDifficulty = 'easy' | 'medium' | 'hard'

/** All valid puzzle difficulty values */
export const PUZZLE_DIFFICULTY_VALUES = ['easy', 'medium', 'hard'] as const

/**
 * Difficulty configuration for games that support difficulty selection
 * Each level defines how the puzzle should be generated differently
 */
export interface DifficultyLevelConfig {
	/** The difficulty level identifier */
	level: PuzzleDifficulty
	/** Translation key for the difficulty name (e.g., 'easy' -> t('common.difficulty.easy')) */
	labelKey: string
	/** Description of what makes this difficulty different */
	descriptionKey: string
	/** Parameters passed to puzzle generation (game-specific) */
	params: Record<string, unknown>
}

// ==========================================
// Submission & Result Types
// ==========================================

/**
 * What client sends to server when game ends
 * NOTE: NO score field - score is calculated server-side
 */
export type GameSubmission = {
	/** Claimed game outcome */
	status: 'won' | 'lost'
	/** Number of attempts/guesses made */
	attempts: number
	/** Time spent playing in milliseconds */
	timeSpentMs: number
	/**
	 * Game-specific data for server validation
	 * Each game defines what data it needs:
	 * - Wordle: { guesses: string[] }
	 * - Sudoku: { finalGrid: number[][] }
	 * - Queens: { finalGrid: boolean[][], regions: number[][] }
	 * - etc.
	 */
	data: unknown
}

/**
 * Result returned by server after validating submission
 * Server calculates score - client never does
 */
export type GameResult =
	| {
			valid: true
			/** Server-verified status (may differ from claimed if cheating detected) */
			status: 'won' | 'lost'
			/** Server-calculated score */
			score: number
	  }
	| {
			valid: false
			error: string
	  }

// ==========================================
// Parsed Puzzle Type
// ==========================================

/**
 * Parsed puzzle result from server data
 * Returned by GameConfig.parsePuzzleData()
 */
export interface ParsedPuzzle<TPuzzleData, TSolution> {
	puzzleData: TPuzzleData
	solution: TSolution
}

/**
 * Default implementation for parsing puzzle data from server
 * Most games can use this instead of implementing parsePuzzleData
 *
 * Logic:
 * 1. If server provides { puzzleData, solution } structure, use it directly
 * 2. Otherwise, generate from seed (fallback for archive mode)
 *
 * @param config - Game config with generatePuzzle function
 * @param data - Raw puzzle data from server
 * @param puzzleId - Puzzle ID for fallback generation
 * @param difficulty - Optional difficulty level for games with supportsDifficulty
 */
export function defaultParsePuzzleData<TPuzzleData, TSolution>(
	config: Pick<GameConfig<TPuzzleData, TSolution>, 'generatePuzzle'>,
	data: unknown,
	puzzleId?: string,
	difficulty?: PuzzleDifficulty,
): ParsedPuzzle<TPuzzleData, TSolution> {
	// Server provides nested structure with puzzleData and solution
	if (data && typeof data === 'object' && 'puzzleData' in data && 'solution' in data) {
		return data as ParsedPuzzle<TPuzzleData, TSolution>
	}

	// Fallback: generate from seed (for archive mode or missing data)
	const seed = Number.parseInt(puzzleId || String(Date.now()), 10)
	return config.generatePuzzle(seed, difficulty)
}

// ==========================================
// Stats Types
// ==========================================

/**
 * Props passed to all game components
 * This is the contract between GameRenderer and individual games
 *
 * Note: Props are optional to support default values in game components.
 * GameRenderer always provides puzzleId, puzzleData, and mode.
 * puzzleData is typed as unknown because GameRenderer is generic.
 * Each game component should use defaultParsePuzzleData() for type-safe parsing.
 */
export interface GameProps {
	/** Unique puzzle identifier (always provided by GameRenderer) */
	puzzleId?: string
	/** Puzzle data (game-specific, always provided by GameRenderer) */
	puzzleData?: unknown
	/** Game mode (default: 'daily') */
	mode?: 'daily' | 'archive'
	/** Difficulty level for games that support it (provided by GameRenderer) */
	difficulty?: PuzzleDifficulty
	/** Callback when game completes */
	onComplete?: (result: { status: 'won' | 'lost'; stats: GameCompletionStats }) => void
}

/**
 * Stats returned when game completes
 * Used for UI display, leaderboards, and percentile calculations
 * Score is added after server validation (client never calculates it)
 */
export interface GameCompletionStats {
	status?: 'won' | 'lost'
	attempts?: number
	maxAttempts?: number
	timeSpentMs?: number
	mistakes?: number
	hintsUsed?: number
	/** Server-calculated score - only present after server response */
	score?: number
}

/**
 * Stats for share text generation
 * Extends completion stats with guaranteed status
 */
export interface GameShareStats extends GameCompletionStats {
	status: 'won' | 'lost'
	/** Server-calculated score (added after server response) */
	score?: number
}

// ==========================================
// Puzzle Generation Types
// ==========================================

/**
 * Puzzle generation strategy
 * - 'seed': Deterministic from seed (e.g., Wordle uses word list) - infinite, never fails
 * - 'llm': Uses LLM to generate - may fail, NO silent fallback
 *
 * See docs/PUZZLE_GENERATION.md for architecture details.
 */
export type PuzzleGenerationStrategy = 'seed' | 'llm'

/**
 * Result from LLM puzzle generator
 */
export type LLMGeneratorResult = {
	success: boolean
	puzzleData?: unknown
	solution?: unknown
	error?: string
}

/**
 * Result from puzzle generation workflow
 */
export type PuzzleGenerationResult = {
	success: boolean
	gameSlug: string
	gameName: string
	strategy: PuzzleGenerationStrategy
	error?: string
}

/**
 * Summary of all puzzle generations for monitoring
 */
export type GenerationSummary = {
	date: string
	totalGames: number
	successful: number
	failed: number
	results: PuzzleGenerationResult[]
}

/**
 * Display metadata for UI rendering
 * Translations use these keys: games.[slug].tagline, games.[slug].highlight
 *
 * Colors are defined via theme token - see theme-colors.ts for definitions.
 * This ensures all Tailwind classes are static (tree-shakeable).
 */
export interface GameDisplayMeta {
	/** Translation key suffix for tagline (e.g., 'wordle' -> 'games.wordle.tagline') */
	taglineKey: string
	/** Translation key suffix for highlight text */
	highlightKey: string
	/** Estimated time to complete */
	duration: string
	/** Color theme token - all color classes derived from this */
	theme: import('./theme-colors').GameColorTheme
}

// ==========================================
// Game Configuration Interface
// ==========================================

/**
 * Configuration for a game module
 * Each game implements this interface to be registered in the system
 *
 * PLUG-AND-PLAY: Games are self-contained modules that define their own:
 * - Puzzle generation (generatePuzzle)
 * - Validation AND scoring (validateAndScore) <- Server-side score calculation
 * - UI components (HowToPlayContent)
 * - Translations (in translations/ folder)
 *
 * SECURITY: The validateAndScore function runs on SERVER only.
 * Client sends submission data, server validates AND calculates score.
 */
export interface GameConfig<
	TPuzzleData = unknown,
	TSolution = unknown,
	TGuess = unknown,
	TGuessResult = unknown,
> {
	// ==========================================
	// Metadata
	// ==========================================
	slug: string
	name: string
	description: string
	/** Custom SVG icon component for this game */
	IconComponent: ComponentType<{ size?: number; className?: string }>
	sortOrder: number

	// ==========================================
	// Classification (for UI filtering/grouping)
	// ==========================================

	/** Primary category for grouping */
	category: GameCategory
	/** Skills tested by this game (for filtering and recommendations) */
	skills: GameSkill[]
	/** Base difficulty level (for games without difficulty selection) */
	difficulty: GameDifficulty

	/** Display metadata for UI rendering */
	display: GameDisplayMeta

	// ==========================================
	// Difficulty Selection (optional)
	// ==========================================

	/**
	 * Whether this game supports player-selectable difficulty levels
	 * If true, difficultyLevels must be provided
	 *
	 * When supportsDifficulty is true:
	 * - Multiple puzzles are generated per day (one per difficulty)
	 * - Player can choose which difficulty to play
	 * - Completing ANY difficulty counts for streak (only once per day)
	 * - Stats track completions per difficulty
	 */
	supportsDifficulty?: boolean

	/**
	 * Available difficulty levels for this game
	 * Required when supportsDifficulty is true
	 * Order determines display order in UI (first = default)
	 */
	difficultyLevels?: DifficultyLevelConfig[]

	// ==========================================
	// Components (for plug-and-play UI)
	// ==========================================

	/**
	 * Main game component (lazy-loaded)
	 * Dynamically imported using next/dynamic for optimal code splitting
	 * Each game defines this in its config.ts using dynamic()
	 */
	GameComponent: ComponentType<GameProps>

	/**
	 * How-to-play content component
	 * Rendered inside the HowToPlayModal when user clicks "How to Play"
	 * Should include title, rules, and visual examples
	 */
	HowToPlayContent?: ComponentType

	// ==========================================
	// Puzzle Generation
	// ==========================================

	/**
	 * How puzzles are generated for this game
	 * - 'seed': Deterministic from seed (infinite, reproducible) - no AI needed
	 * - 'llm': Uses LLM to generate (requires semantic understanding) - NO fallback
	 */
	generationStrategy: PuzzleGenerationStrategy

	/**
	 * Generate puzzle data and solution for a given seed
	 * Seed is deterministic based on date, ensuring all users get same puzzle
	 *
	 * @param seed - Numeric seed based on UTC date (YYYYMMDD)
	 * @param difficulty - Optional difficulty level (for games with supportsDifficulty)
	 * @param difficultyParams - Optional parameters from DifficultyLevelConfig.params
	 * @returns puzzleData (sent to client) and solution (kept server-side)
	 */
	generatePuzzle: (
		seed: number,
		difficulty?: PuzzleDifficulty,
		difficultyParams?: Record<string, unknown>,
	) => {
		puzzleData: TPuzzleData
		solution: TSolution
	}

	// ==========================================
	// Validation & Scoring (SERVER-SIDE)
	// ==========================================

	/**
	 * Validate a single guess/move (real-time validation)
	 * Used for games that need feedback on each guess (e.g., Wordle)
	 *
	 * @param solution - The stored solution
	 * @param guess - User's guess
	 * @param puzzleData - Optional puzzle context
	 * @returns Validation result with feedback
	 */
	validateGuess?: (solution: TSolution, guess: TGuess, puzzleData?: TPuzzleData) => TGuessResult

	/**
	 * CORE VALIDATION FUNCTION - RUNS ON SERVER ONLY
	 *
	 * Validates the submission AND calculates the score.
	 * This is the single source of truth for game results.
	 *
	 * Security: Client sends moves/final state, server validates everything.
	 * The client NEVER calculates score - this function does.
	 *
	 * Scoring Guidelines (implement per-game):
	 * - Wordle: 100 - (attempts-1)*15, 0 for loss
	 * - Sudoku: 1000 - mistakes*50 - seconds, min 100
	 * - Queens: 500 - seconds, min 100
	 * - Nonogram: 500 - errors*25 - seconds/2, min 100
	 * - Connections: 100 - mistakes*20
	 * - Block Slide: 200 - moves + par bonus
	 *
	 * @param solution - The stored solution
	 * @param puzzleData - The puzzle configuration
	 * @param submission - User's submission with game-specific data
	 * @returns Validation result with server-calculated score
	 */
	validateAndScore: (
		solution: TSolution,
		puzzleData: TPuzzleData,
		submission: GameSubmission,
	) => GameResult

	// ==========================================
	// Game Lifecycle (optional)
	// ==========================================

	/**
	 * When the game launched (for archive puzzle number calculation)
	 * If not provided, defaults to 2024-01-01
	 */
	launchDate?: Date

	// ==========================================
	// Display Customization (optional)
	// ==========================================

	/**
	 * Check if the game result qualifies as a "perfect" game
	 * Used for special celebration/display in result cards, stats, leaderboards
	 * If not provided, no "perfect game" badge is shown
	 */
	isPerfectGame?: (stats: GameCompletionStats) => boolean

	/**
	 * Format score for display in UI (e.g., "3/6" for Wordle, "2 mistakes" for Connections)
	 * Used in daily completion summaries and leaderboards
	 * If not provided, shows raw score or nothing
	 *
	 * @param stats - Game completion stats including status, attempts, score, etc.
	 * @returns Formatted score string for display
	 */
	formatScoreDisplay?: (stats: GameShareStats) => string

	/**
	 * Compare two game sessions for percentile ranking
	 * Return positive if a is better than b, negative if worse, 0 if equal
	 * If not provided, uses default comparison (higher score = better)
	 *
	 * @param a - First session stats
	 * @param b - Second session stats
	 * @returns Comparison result (positive = a is better)
	 */
	compareForPercentile?: (a: GameCompletionStats, b: GameCompletionStats) => number

	/**
	 * Format custom share text for this game
	 * If not provided, uses default share text format
	 */
	formatShareText?: (stats: GameShareStats) => string

	// ==========================================
	// Share Text Customization (optional)
	// ==========================================

	/**
	 * Get performance emoji for share text
	 * If not provided, uses generic emoji
	 */
	getShareEmoji?: (stats: GameShareStats) => string

	/**
	 * Get victory/loss message for share text
	 * If not provided, uses generic message
	 */
	getShareMessage?: (stats: GameShareStats) => string

	/**
	 * Get result string for share text (e.g., "3/6" for Wordle)
	 * If not provided, returns empty string
	 */
	getResultString?: (stats: GameShareStats) => string

	/**
	 * Get challenge message for share text
	 * If not provided, uses generic challenge
	 */
	getChallengeMessage?: (stats: GameShareStats) => string
}

// ==========================================
// Game Registry Type
// ==========================================

/**
 * Registry of all available games
 * Uses 'any' for flexibility - individual game configs are typed
 */
// biome-ignore lint/suspicious/noExplicitAny: Generic registry requires any for flexibility
export type GameRegistry = Record<string, GameConfig<any, any, any, any>>
