/**
 * Server-only game registry functions
 *
 * This module contains server-only functions for puzzle generation.
 * For client-safe metadata, use registry.ts instead.
 *
 * The separation prevents bundler errors from server deps in client bundles.
 */

import 'server-only'

import { getLLMGenerator } from './llm-generators.server'
import { GAME_CONFIGS, getAllGames, isValidGameSlug } from './registry'
import type { GenerationSummary, PuzzleDifficulty, PuzzleGenerationResult } from './types'

// ==========================================
// Server-Only Puzzle Generation
// ==========================================

/**
 * Generate puzzle for a specific game
 *
 * Strategy:
 * - Seed-based games: Deterministic generation from seed (YYYYMMDD)
 * - LLM games: Generate with LLM, throw error if fails (no silent fallback)
 *
 * See docs/PUZZLE_ARCHITECTURE.md for architecture details.
 *
 * @param slug - Game identifier
 * @param date - Target date in YYYY-MM-DD format
 * @param difficulty - Optional difficulty level (for games with supportsDifficulty)
 *
 * Returns:
 * - puzzleData: The puzzle content visible to players
 * - solution: The correct answer(s)
 * - seed: The seed used for generation (YYYYMMDD format for audit trail)
 */
async function generatePuzzleWithLLM(
	slug: string,
	date: string,
	difficulty?: PuzzleDifficulty,
): Promise<{ puzzleData: unknown; solution: unknown; seed: number }> {
	if (!isValidGameSlug(slug)) {
		throw new Error(`Unknown game: ${slug}`)
	}
	const config = GAME_CONFIGS[slug]

	// Seed is always derived from date for consistent audit trail
	// For difficulty-enabled games, we add an offset to ensure different puzzles per difficulty
	const baseSeed = Number.parseInt(date.replace(/-/g, ''), 10)
	const difficultyOffset =
		difficulty === 'easy' ? 0 : difficulty === 'medium' ? 1 : difficulty === 'hard' ? 2 : 0
	const seed = baseSeed + difficultyOffset

	// Seed-based generation: deterministic, never fails
	if (config.generationStrategy === 'seed') {
		const result = config.generatePuzzle(seed, difficulty)
		return { puzzleData: result.puzzleData, solution: result.solution, seed }
	}

	// LLM generation: use server-only generators
	// Note: LLM generators currently don't support difficulty parameter
	const llmGenerator = getLLMGenerator(slug)
	if (!llmGenerator) {
		throw new Error(`No LLM generator found for game: ${slug}`)
	}

	const llmResult = await llmGenerator(date)

	if (llmResult.success && llmResult.puzzleData && llmResult.solution) {
		return {
			puzzleData: llmResult.puzzleData,
			solution: llmResult.solution,
			seed, // Record seed even for LLM games for consistency
		}
	}

	// LLM failed - throw error instead of silent fallback
	// This will trigger alerts and require manual intervention
	throw new Error(
		`[${slug}] LLM generation failed for ${date}: ${llmResult.error}. ` +
			`No fallback - manual intervention required.`,
	)
}

/**
 * Generate puzzle for a single game with full result tracking
 *
 * Returns puzzleData, solution, and seed for database storage.
 * Per PUZZLE_ARCHITECTURE.md: seed recorded for audit trail.
 *
 * @param slug - Game identifier
 * @param date - Target date in YYYY-MM-DD format
 * @param difficulty - Optional difficulty level (for games with supportsDifficulty)
 */
export async function generateGamePuzzle(
	slug: string,
	date: string,
	difficulty?: PuzzleDifficulty,
): Promise<{
	result: PuzzleGenerationResult
	puzzleData?: unknown
	solution?: unknown
	seed?: number
	difficulty?: PuzzleDifficulty
}> {
	if (!isValidGameSlug(slug)) {
		return {
			result: {
				success: false,
				gameSlug: slug,
				gameName: slug,
				strategy: 'seed',
				error: `Game "${slug}" not found in registry`,
			},
		}
	}
	const config = GAME_CONFIGS[slug]

	try {
		const generated = await generatePuzzleWithLLM(slug, date, difficulty)
		return {
			result: {
				success: true,
				gameSlug: config.slug,
				gameName: config.name,
				strategy: config.generationStrategy,
			},
			puzzleData: generated.puzzleData,
			solution: generated.solution,
			seed: generated.seed,
			difficulty,
		}
	} catch (error) {
		return {
			result: {
				success: false,
				gameSlug: config.slug,
				gameName: config.name,
				strategy: config.generationStrategy,
				error: error instanceof Error ? error.message : 'Unknown error',
			},
		}
	}
}

/**
 * Generate puzzles for ALL registered games
 * Fully automatic - just add game to registry and it's included
 */
async function _generateAllPuzzles(date: string): Promise<GenerationSummary> {
	const allGames = getAllGames()
	const results: PuzzleGenerationResult[] = []

	// Generate all puzzles in parallel
	const generations = await Promise.all(
		allGames.map(async (config) => {
			const { result, puzzleData, solution } = await generateGamePuzzle(config.slug, date)
			return { result, puzzleData, solution }
		}),
	)

	for (const gen of generations) {
		results.push(gen.result)
	}

	const summary: GenerationSummary = {
		date,
		totalGames: results.length,
		successful: results.filter((r) => r.success).length,
		failed: results.filter((r) => !r.success).length,
		results,
	}

	return summary
}

/**
 * Check if any generation failed (for alerting)
 */
export function shouldAlert(summary: GenerationSummary): boolean {
	return summary.failed > 0
}

/**
 * Format summary for logging/alerting
 */
export function formatGenerationSummary(summary: GenerationSummary): string {
	const lines = [
		`📊 Puzzle Generation Summary for ${summary.date}`,
		`Total: ${summary.totalGames} | ✅ Success: ${summary.successful} | ❌ Failed: ${summary.failed}`,
		'',
		'Details:',
	]

	for (const result of summary.results) {
		const icon = result.success ? '✅' : '❌'
		const status = result.success ? 'OK' : `Failed: ${result.error}`
		lines.push(`${icon} ${result.gameName} (${result.strategy}): ${status}`)
	}

	return lines.join('\n')
}
