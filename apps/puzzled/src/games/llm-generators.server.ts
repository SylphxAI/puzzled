/**
 * Server-only LLM puzzle generators
 *
 * This module contains all LLM-based puzzle generation logic.
 * It is SERVER-ONLY and must not be imported by client components.
 *
 * The game configs (used by client) only contain client-safe code.
 * This separation prevents bundler errors from server deps in client bundles.
 */

import 'server-only'

import {
	generateConnectionsPuzzle,
	generateCrosswordPuzzle,
	generateNonogramPuzzle,
} from '@/features/puzzle-generator/server'
import type { LLMGeneratorResult } from './types'
import { MAX_MISTAKES, TOTAL_CATEGORIES, WORDS_PER_CATEGORY } from './word-groups/types'

// ==========================================
// Connections LLM Generator
// ==========================================

/**
 * Deterministic shuffle based on seed
 */
function seededShuffle<T>(array: T[], seed: number): T[] {
	const shuffled = [...array]
	let currentSeed = seed

	const random = () => {
		const x = Math.sin(currentSeed++) * 10000
		return x - Math.floor(x)
	}

	for (let i = shuffled.length - 1; i > 0; i--) {
		const j = Math.floor(random() * (i + 1))
		;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
	}

	return shuffled
}

/**
 * Generate Connections puzzle using LLM
 */
export async function generateConnectionsWithLLM(date: string): Promise<LLMGeneratorResult> {
	try {
		const result = await generateConnectionsPuzzle(date)

		if (result.valid && result.puzzle) {
			const puzzle = result.puzzle
			const seed = parseInt(date.replace(/-/g, ''), 10)
			const shuffledWords = seededShuffle(
				puzzle.categories.flatMap((cat) => cat.words),
				seed,
			)

			return {
				success: true,
				puzzleData: {
					words: shuffledWords,
					maxMistakes: MAX_MISTAKES,
					wordsPerCategory: WORDS_PER_CATEGORY,
					totalCategories: TOTAL_CATEGORIES,
				},
				solution: {
					categories: puzzle.categories,
				},
			}
		}

		return { success: false, error: result.errors.join(', ') }
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : 'LLM generation failed',
		}
	}
}

// ==========================================
// Crossword LLM Generator
// ==========================================

/**
 * Generate Crossword puzzle using LLM
 */
export async function generateCrosswordWithLLM(_date: string): Promise<LLMGeneratorResult> {
	try {
		const result = await generateCrosswordPuzzle()

		if (result.valid && result.puzzleData && result.solution) {
			return {
				success: true,
				puzzleData: result.puzzleData,
				solution: result.solution,
			}
		}

		return { success: false, error: result.errors.join(', ') }
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : 'LLM generation failed',
		}
	}
}

// ==========================================
// Nonogram LLM Generator
// ==========================================

/**
 * Generate Nonogram puzzle using LLM
 */
export async function generateNonogramWithLLM(_date: string): Promise<LLMGeneratorResult> {
	try {
		const result = await generateNonogramPuzzle()

		if (result.valid && result.puzzleData && result.solution) {
			return {
				success: true,
				puzzleData: result.puzzleData,
				solution: result.solution,
			}
		}

		return { success: false, error: result.errors.join(', ') }
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : 'LLM generation failed',
		}
	}
}

// ==========================================
// Registry of LLM Generators
// ==========================================

type LLMGenerator = (date: string) => Promise<LLMGeneratorResult>

/**
 * Map of game slugs to their LLM generators
 * Only games with generationStrategy: 'llm' are included
 */
export const LLM_GENERATORS: Record<string, LLMGenerator> = {
	connections: generateConnectionsWithLLM,
	crossword: generateCrosswordWithLLM,
	nonogram: generateNonogramWithLLM,
}

/**
 * Get LLM generator for a game
 */
export function getLLMGenerator(slug: string): LLMGenerator | undefined {
	return LLM_GENERATORS[slug]
}

/**
 * Check if a game has LLM generation
 */
export function hasLLMGenerator(slug: string): boolean {
	return slug in LLM_GENERATORS
}
