/**
 * Game Registry - Central registration point for all games
 *
 * PLUG-AND-PLAY ARCHITECTURE:
 * Each game is a self-contained module. To add a new game:
 * 1. Create folder: /src/games/[game-slug]/
 * 2. Implement GameConfig in config.ts
 * 3. Create components/how-to-play.tsx
 * 4. Create translations/en.json (+ other locales)
 * 5. Add import and entry to GAME_CONFIGS below
 *
 * That's it! The game will automatically appear in:
 * - Game selection UI
 * - How-to-play modal
 * - Server validation
 * - All other game-aware components
 */

import { arithmoConfig } from './arithmo/config'
import { blockSlideConfig } from './block-slide/config'
import { crosswordConfig } from './crossword/config'
import { cryptogramConfig } from './cryptogram/config'
import { killerSudokuConfig } from './killer-sudoku/config'
import { nonogramConfig } from './nonogram/config'
import { patternMatchConfig } from './pattern-match/config'
import { quadWordsConfig } from './quad-words/config'
import { queensConfig } from './queens/config'
import { sudokuConfig } from './sudoku/config'
import { tangoConfig } from './tango/config'
import type {
	DifficultyLevelConfig,
	GameCategory,
	GameConfig,
	GameDifficulty,
	GameDisplayMeta,
	GameRegistry,
	GameResult,
	GameSkill,
	GameSubmission,
} from './types'
import { wordBoxConfig } from './word-box/config'
import { wordGroupsConfig } from './word-groups/config'
import { wordGuessConfig } from './word-guess/config'
import { wordHiveConfig } from './word-hive/config'
import { wordLadderConfig } from './word-ladder/config'
import { wordSearchConfig } from './word-search/config'

// ==========================================
// Game Registry
// ==========================================

/**
 * All registered games mapped by slug
 */
export const GAME_CONFIGS = {
	'word-guess': wordGuessConfig,
	'word-groups': wordGroupsConfig,
	'word-hive': wordHiveConfig,
	crossword: crosswordConfig,
	sudoku: sudokuConfig,
	nonogram: nonogramConfig,
	'word-ladder': wordLadderConfig,
	arithmo: arithmoConfig,
	'pattern-match': patternMatchConfig,
	'block-slide': blockSlideConfig,
	queens: queensConfig,
	tango: tangoConfig,
	'word-box': wordBoxConfig,
	'quad-words': quadWordsConfig,
	'killer-sudoku': killerSudokuConfig,
	cryptogram: cryptogramConfig,
	'word-search': wordSearchConfig,
} as const satisfies GameRegistry

/**
 * Derived type for all valid game slugs
 * Use this instead of hard-coded string unions
 */
export type GameSlug = keyof typeof GAME_CONFIGS

/**
 * Get list of all registered game slugs
 */
export function getGameSlugs(): string[] {
	return Object.keys(GAME_CONFIGS)
}

/**
 * Get game config by slug
 */
// biome-ignore lint/suspicious/noExplicitAny: Registry returns union of all game configs
export function getGameConfig(slug: string): GameConfig<any, any, any, any> | undefined {
	if (!isValidGameSlug(slug)) return undefined
	return GAME_CONFIGS[slug]
}

/**
 * Check if a game slug is registered
 */
export function isValidGameSlug(slug: string): slug is GameSlug {
	return slug in GAME_CONFIGS
}

/**
 * Get HowToPlayContent component for a game
 * Returns undefined if game not found or has no HowToPlay
 */
function getHowToPlayContent(slug: string) {
	const config = GAME_CONFIGS[slug as GameSlug]
	return config?.HowToPlayContent
}

/**
 * Get all games sorted by sortOrder
 */
// biome-ignore lint/suspicious/noExplicitAny: Registry returns union of all game configs
export function getAllGames(): GameConfig<any, any, any, any>[] {
	return Object.values(GAME_CONFIGS).sort((a, b) => a.sortOrder - b.sortOrder)
}

/**
 * Full game metadata including display info for UI rendering
 */
export type GameMetadata = {
	slug: string
	name: string
	description: string
	sortOrder: number
	/** Primary category for grouping */
	category: GameCategory
	/** Skills tested by this game */
	skills: GameSkill[]
	/** Base difficulty level */
	difficulty: GameDifficulty
	display: GameDisplayMeta
	/** Whether this game supports player-selectable difficulty levels */
	supportsDifficulty: boolean
	/** Available difficulty levels (if supportsDifficulty is true) */
	difficultyLevels?: DifficultyLevelConfig[]
}

/**
 * Get game metadata (without functions) for client use
 */
export function getGameMetadata(slug: string): GameMetadata | null {
	if (!isValidGameSlug(slug)) return null
	const config = GAME_CONFIGS[slug]

	return {
		slug: config.slug,
		name: config.name,
		description: config.description,
		sortOrder: config.sortOrder,
		category: config.category,
		skills: config.skills,
		difficulty: config.difficulty,
		display: config.display,
		supportsDifficulty: config.supportsDifficulty ?? false,
		difficultyLevels: config.difficultyLevels,
	}
}

/**
 * Get all game metadata for client use
 * Sorted by sortOrder
 */
export function getAllGameMetadata(): GameMetadata[] {
	return getAllGames().map((config) => ({
		slug: config.slug,
		name: config.name,
		description: config.description,
		sortOrder: config.sortOrder,
		category: config.category,
		skills: config.skills,
		difficulty: config.difficulty,
		display: config.display,
		supportsDifficulty: config.supportsDifficulty ?? false,
		difficultyLevels: config.difficultyLevels,
	}))
}

/**
 * Get all games that support difficulty selection
 */
function getGamesWithDifficulty(): GameMetadata[] {
	return getAllGameMetadata().filter((game) => game.supportsDifficulty)
}

/**
 * Check if a game supports difficulty selection
 */
export function gameSupportsDifficulty(slug: string): boolean {
	if (!isValidGameSlug(slug)) return false
	return GAME_CONFIGS[slug].supportsDifficulty ?? false
}

/**
 * Get difficulty levels for a game
 * Returns undefined if game doesn't support difficulty
 */
function getGameDifficultyLevels(slug: string): DifficultyLevelConfig[] | undefined {
	if (!isValidGameSlug(slug)) return undefined
	const config = GAME_CONFIGS[slug]
	if (!config.supportsDifficulty) return undefined
	return config.difficultyLevels
}

/**
 * Get the custom SVG icon component for a game
 */
export function getGameIconComponent(
	slug: string,
): React.ComponentType<{ size?: number; className?: string }> | undefined {
	if (!isValidGameSlug(slug)) return undefined
	return GAME_CONFIGS[slug].IconComponent
}

// ==========================================
// Puzzle Generation
// ==========================================

/**
 * Generate seed from UTC date
 * All users worldwide get same puzzle number on same day
 */
export function getSeedFromDate(date: Date = new Date()): number {
	const year = date.getUTCFullYear()
	const month = date.getUTCMonth() + 1
	const day = date.getUTCDate()
	return year * 10000 + month * 100 + day
}

// NOTE: Server-only puzzle generation functions are in registry.server.ts
// - generatePuzzleWithLLM()
// - generateGamePuzzle()
// - generateAllPuzzles()
// This separation prevents bundler errors from server deps in client bundles.

/**
 * CORE VALIDATION FUNCTION - Validates submission AND calculates score
 *
 * This is the single source of truth for game results.
 * Client sends moves/final state, server validates everything and calculates score.
 * The client NEVER calculates score.
 *
 * @param slug - Game identifier
 * @param solution - The stored solution
 * @param puzzleData - The puzzle configuration
 * @param submission - User's submission with game-specific data
 * @returns Validation result with server-calculated score
 */
export function validateAndScore(
	slug: string,
	solution: unknown,
	puzzleData: unknown,
	submission: GameSubmission,
): GameResult {
	if (!isValidGameSlug(slug)) {
		return { valid: false, error: `Unknown game: ${slug}` }
	}
	const config = GAME_CONFIGS[slug]
	// biome-ignore lint/suspicious/noExplicitAny: Runtime validated slug guarantees matching types
	return config.validateAndScore(solution as any, puzzleData as any, submission)
}

// ==========================================
// Re-exports from types (for convenience)
// ==========================================

export type {
	
	GameConfig,
	
	
	GameResult,
	GameSubmission,
	
	
	
	
	
} from './types'


