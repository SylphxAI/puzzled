import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { appSettings } from '@/lib/db/schema'
import { ai } from './openrouter'
import { CONNECTIONS_SYSTEM_PROMPT, CONNECTIONS_USER_PROMPT } from './prompts/connections'
import { CROSSWORD_SYSTEM_PROMPT, CROSSWORD_USER_PROMPT } from './prompts/crossword'
import { NONOGRAM_SYSTEM_PROMPT, NONOGRAM_USER_PROMPT } from './prompts/nonogram'
import {
	type ConnectionsValidationResult,
	parseConnectionsResponse,
	validateConnectionsPuzzle,
} from './validators/connections'
import {
	type CrosswordValidationResult,
	parseCrosswordResponse,
	validateCrosswordPuzzle,
} from './validators/crossword'
import {
	type NonogramValidationResult,
	parseNonogramResponse,
	validateNonogramPuzzle,
} from './validators/nonogram'

/**
 * Maximum retry attempts for generation
 */
const MAX_RETRIES = 3

/**
 * Get the configured model from app settings
 * Throws if no model is configured - no silent fallback
 */
async function getConfiguredModel(): Promise<string> {
	try {
		const setting = await db.query.appSettings.findFirst({
			where: eq(appSettings.key, 'puzzle_generator_model'),
		})
		if (setting?.value && typeof setting.value === 'string') {
			return setting.value
		}
	} catch (error) {
		throw new Error(
			`[Generator] Failed to fetch configured model: ${error instanceof Error ? error.message : 'Unknown error'}. ` +
				`No fallback model - configure puzzle_generator_model in app settings.`,
		)
	}
	throw new Error(
		'[Generator] No puzzle_generator_model configured in app settings. ' +
			'Configure the model before running puzzle generation.',
	)
}

// ==========================================
// Generic Retry Logic (DRY)
// ==========================================

type GenerateWithRetryConfig<TParsed, TResult> = {
	name: string
	systemPrompt: string
	userPrompt: string
	temperature: number
	maxOutputTokens?: number
	parse: (text: string) => TParsed | null
	validate: (parsed: TParsed) => TResult
	onSuccess?: (result: TResult, attempt: number) => void
}

type GenerateWithRetryOptions = {
	model?: string
	retries?: number
}

/**
 * Generic LLM generation with retry logic
 *
 * This is the SINGLE implementation of retry logic for all LLM generators.
 * Each generator provides:
 * - Prompts (system + user)
 * - Parse function (extract structured data from LLM response)
 * - Validate function (verify puzzle is valid/solvable)
 */
async function generateWithRetry<TParsed, TResult extends { valid: boolean; errors: string[] }>(
	config: GenerateWithRetryConfig<TParsed, TResult>,
	options?: GenerateWithRetryOptions,
): Promise<TResult> {
	const model = options?.model || (await getConfiguredModel())
	const maxRetries = options?.retries || MAX_RETRIES

	let lastErrors: string[] = []

	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		try {
			console.log(`[${config.name}] Attempt ${attempt}/${maxRetries}`)

			// Use SDK AI client which routes through Platform
			const response = await ai.chat({
				model,
				messages: [
					{ role: 'system', content: config.systemPrompt },
					{ role: 'user', content: config.userPrompt },
				],
				max_tokens: config.maxOutputTokens || 1000,
				temperature: config.temperature,
			})

			const text = response.choices[0]?.message.content ?? ''

			const parsed = config.parse(text)
			if (!parsed) {
				lastErrors = ['Failed to parse LLM response as JSON']
				continue
			}

			const result = config.validate(parsed)

			if (result.valid) {
				console.log(`[${config.name}] Success on attempt ${attempt}`)
				config.onSuccess?.(result, attempt)
				return result
			}

			lastErrors = result.errors
			console.warn(`[${config.name}] Validation failed:`, result.errors)
		} catch (error) {
			console.error(`[${config.name}] Error on attempt ${attempt}:`, error)
			lastErrors = [error instanceof Error ? error.message : 'Unknown error']
		}
	}

	// Return failed result with accumulated errors
	return { valid: false, errors: lastErrors } as TResult
}

// ==========================================
// Game-Specific Generators
// ==========================================

/**
 * Generate a Connections puzzle using LLM
 */
export async function generateConnectionsPuzzle(
	puzzleDate: string,
	options?: GenerateWithRetryOptions,
): Promise<ConnectionsValidationResult> {
	return generateWithRetry<
		ReturnType<typeof parseConnectionsResponse>,
		ConnectionsValidationResult
	>(
		{
			name: 'Connections Generator',
			systemPrompt: CONNECTIONS_SYSTEM_PROMPT,
			userPrompt: CONNECTIONS_USER_PROMPT,
			temperature: 0.8, // Some creativity for variety
			parse: parseConnectionsResponse,
			validate: (parsed) => {
				const puzzleId = `connections-${puzzleDate}`
				return validateConnectionsPuzzle(parsed!, puzzleId, puzzleDate)
			},
		},
		options,
	)
}

/**
 * Generate a Nonogram puzzle using LLM
 */
export async function generateNonogramPuzzle(
	options?: GenerateWithRetryOptions,
): Promise<NonogramValidationResult> {
	return generateWithRetry<ReturnType<typeof parseNonogramResponse>, NonogramValidationResult>(
		{
			name: 'Nonogram Generator',
			systemPrompt: NONOGRAM_SYSTEM_PROMPT,
			userPrompt: NONOGRAM_USER_PROMPT,
			temperature: 0.9, // Higher creativity for unique patterns
			parse: parseNonogramResponse,
			validate: (parsed) => validateNonogramPuzzle(parsed!),
			onSuccess: (result) => {
				if (result.puzzleData?.theme) {
					console.log(`[Nonogram Generator] Theme: ${result.puzzleData.theme}`)
				}
			},
		},
		options,
	)
}

/**
 * Generate a Crossword Mini (word square) puzzle using LLM
 */
export async function generateCrosswordPuzzle(
	options?: GenerateWithRetryOptions,
): Promise<CrosswordValidationResult> {
	return generateWithRetry<ReturnType<typeof parseCrosswordResponse>, CrosswordValidationResult>(
		{
			name: 'Crossword Generator',
			systemPrompt: CROSSWORD_SYSTEM_PROMPT,
			userPrompt: CROSSWORD_USER_PROMPT,
			temperature: 0.8, // Balanced creativity for word squares
			parse: parseCrosswordResponse,
			validate: (parsed) => validateCrosswordPuzzle(parsed!),
			onSuccess: (result) => {
				const firstWord = result.puzzleData?.clues.across[0]?.answer
				if (firstWord) {
					console.log(`[Crossword Generator] First word: ${firstWord}`)
				}
			},
		},
		options,
	)
}

/**
 * Get today's date string in YYYY-MM-DD format (UTC)
 */
function _getTodayDateString(): string {
	const now = new Date()
	return now.toISOString().split('T')[0]
}

/**
 * Get tomorrow's date string in YYYY-MM-DD format (UTC)
 */
function _getTomorrowDateString(): string {
	const tomorrow = new Date()
	tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
	return tomorrow.toISOString().split('T')[0]
}

/**
 * Result of daily puzzle generation for all LLM games
 */
type DailyPuzzleResults = {
	connections: ConnectionsValidationResult
	crossword: CrosswordValidationResult
	nonogram: NonogramValidationResult
}

/**
 * Generate all daily puzzles for a given date
 *
 * Generates all 3 LLM-based puzzles in parallel:
 * - Connections: Category grouping puzzle (requires semantic understanding)
 * - Crossword: 5×5 word square with clues (requires wordplay/semantics)
 * - Nonogram: 10×10 pixel art puzzle (requires visual creativity)
 *
 * Each puzzle is validated for solvability before being returned.
 * No fallbacks - if any puzzle fails, the error is returned for that game.
 */
async function _generateDailyPuzzles(date: string): Promise<DailyPuzzleResults> {
	console.log(`[Daily Generator] Generating all LLM puzzles for ${date}`)
	const startTime = Date.now()

	// Generate all puzzles in parallel - each game is independent
	const [connections, crossword, nonogram] = await Promise.all([
		generateConnectionsPuzzle(date),
		generateCrosswordPuzzle(),
		generateNonogramPuzzle(),
	])

	// Log summary
	const duration = ((Date.now() - startTime) / 1000).toFixed(1)
	const results = [
		connections.valid ? '✅ Connections' : '❌ Connections',
		crossword.valid ? '✅ Crossword' : '❌ Crossword',
		nonogram.valid ? '✅ Nonogram' : '❌ Nonogram',
	]
	console.log(`[Daily Generator] Completed in ${duration}s: ${results.join(', ')}`)

	// Log any failures for alerting
	if (!connections.valid) {
		console.error(`[Daily Generator] Connections failed:`, connections.errors)
	}
	if (!crossword.valid) {
		console.error(`[Daily Generator] Crossword failed:`, crossword.errors)
	}
	if (!nonogram.valid) {
		console.error(`[Daily Generator] Nonogram failed:`, nonogram.errors)
	}

	return { connections, crossword, nonogram }
}
