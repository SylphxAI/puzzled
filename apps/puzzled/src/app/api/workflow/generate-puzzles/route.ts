// Node.js runtime required - @tailwindcss/node checks process.versions.bun
// which doesn't exist in edge runtime
export const runtime = 'nodejs'

import * as Sentry from '@sentry/nextjs'
import { serve } from '@upstash/workflow/nextjs'
import { and, eq, isNull } from 'drizzle-orm'
import { GAME_CONFIGS, getAllGames, isValidGameSlug } from '@/games/registry'
import { formatGenerationSummary, generateGamePuzzle, shouldAlert } from '@/games/registry.server'
import type { GenerationSummary, PuzzleDifficulty, PuzzleGenerationResult } from '@/games/types'

const DIFFICULTY_LEVELS: PuzzleDifficulty[] = ['easy', 'medium', 'hard']
import { db } from '@/lib/db'
import { dailyPuzzles } from '@/lib/db/schema'
import { handleWorkflowFailure } from '@/lib/dlq'

type GeneratePuzzlesPayload = {
	// Optional target date in YYYY-MM-DD format
	// If not provided, generates for tomorrow
	targetDate?: string
}

/**
 * Get tomorrow's date string in YYYY-MM-DD format (UTC)
 */
function getTomorrowDateString(): string {
	const tomorrow = new Date()
	tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
	return tomorrow.toISOString().split('T')[0]
}

/**
 * Send alert to configured webhook (Slack, Discord, etc.)
 */
async function sendAlert(summary: GenerationSummary): Promise<void> {
	const webhookUrl = process.env.ALERT_WEBHOOK_URL
	if (!webhookUrl) {
		console.warn('[Alert] ALERT_WEBHOOK_URL not configured, skipping alert')
		return
	}

	const message = formatGenerationSummary(summary)

	try {
		// Works with Slack, Discord, and most webhook services
		await fetch(webhookUrl, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				// Slack format
				text: message,
				// Discord format (also works)
				content: message,
			}),
		})
		console.log('[Alert] Sent alert to webhook')
	} catch (error) {
		console.error('[Alert] Failed to send alert:', error)
	}
}

/**
 * Report generation issues to Sentry
 */
function reportToSentry(summary: GenerationSummary): void {
	// Report failures as errors
	for (const result of summary.results) {
		if (!result.success) {
			Sentry.captureMessage(`Puzzle generation failed: ${result.gameSlug}`, {
				level: 'error',
				tags: {
					game: result.gameSlug,
					strategy: result.strategy,
					date: summary.date,
				},
				extra: {
					error: result.error,
					summary,
				},
			})
		}
	}
}

export const { POST } = serve<GeneratePuzzlesPayload>(
	async (context) => {
		const targetDate = context.requestPayload.targetDate || getTomorrowDateString()
		const targetDateObj = new Date(`${targetDate}T00:00:00Z`)

		console.log(`[Puzzle Generator] Starting for ${targetDate}`)

		// Step 1: Get all games from registry (fully automatic)
		const registeredGames = await context.run('get-registered-games', () => {
			return getAllGames().map((g) => ({
				slug: g.slug,
				name: g.name,
				strategy: g.generationStrategy,
				supportsDifficulty: g.supportsDifficulty ?? false,
			}))
		})

		console.log(`[Puzzle Generator] Found ${registeredGames.length} registered games`)

		// Step 2: Get valid games from registry (SSOT)
		const validGames = registeredGames.filter((game) => {
			if (!isValidGameSlug(game.slug)) {
				console.warn(`[Puzzle Generator] ${game.slug} not in registry, skipping`)
				return false
			}
			return true
		})

		console.log(`[Puzzle Generator] Generating ${validGames.length} games in parallel`)

		// Step 3: Generate puzzles for all games in PARALLEL
		// Games with difficulty support get 3 puzzles (easy, medium, hard)
		// Games without difficulty support get 1 puzzle
		// Using Promise.allSettled ensures one failure doesn't affect others
		const generationResults = await Promise.allSettled(
			validGames.map((game) =>
				context.run(`generate-${game.slug}`, async () => {
					const config = GAME_CONFIGS[game.slug as keyof typeof GAME_CONFIGS]

					// For games with difficulty support, generate 3 puzzles
					if (game.supportsDifficulty) {
						const difficultyResults: PuzzleGenerationResult[] = []
						let successCount = 0
						let failCount = 0

						for (const difficulty of DIFFICULTY_LEVELS) {
							// Check if this difficulty puzzle already exists
							const existing = await db.query.dailyPuzzles.findFirst({
								where: and(
									eq(dailyPuzzles.gameSlug, game.slug),
									eq(dailyPuzzles.puzzleDate, targetDateObj),
									eq(dailyPuzzles.difficulty, difficulty),
								),
							})

							if (existing) {
								console.log(`[Puzzle Generator] ${game.slug} (${difficulty}) already exists for ${targetDate}`)
								successCount++
								continue
							}

							// Generate puzzle for this difficulty
							const generation = await generateGamePuzzle(game.slug, targetDate, difficulty)

							if (!generation.result.success) {
								console.error(`[Puzzle Generator] ${game.slug} (${difficulty}) failed:`, generation.result.error)
								failCount++
								difficultyResults.push(generation.result)
								continue
							}

							// Save to database with difficulty
							await db.insert(dailyPuzzles).values({
								gameSlug: game.slug,
								puzzleDate: targetDateObj,
								puzzleData: generation.puzzleData,
								solution: generation.solution,
								difficulty,
								seed: generation.seed,
								generatorVersion: 'v1.0',
							})

							console.log(`[Puzzle Generator] ${game.slug} (${difficulty}) saved successfully`)
							successCount++
						}

						// Return combined result for multi-difficulty game
						const allSucceeded = failCount === 0
						return {
							alreadyExists: successCount === DIFFICULTY_LEVELS.length && failCount === 0,
							result: {
								success: allSucceeded,
								gameSlug: game.slug,
								gameName: `${game.name} (${successCount}/${DIFFICULTY_LEVELS.length} difficulties)`,
								strategy: config.generationStrategy,
								error: failCount > 0 ? `${failCount} difficulties failed` : undefined,
							} as PuzzleGenerationResult,
						}
					}

					// For games WITHOUT difficulty support, generate single puzzle
					// Check if puzzle already exists (null difficulty)
					const existing = await db.query.dailyPuzzles.findFirst({
						where: and(
							eq(dailyPuzzles.gameSlug, game.slug),
							eq(dailyPuzzles.puzzleDate, targetDateObj),
							isNull(dailyPuzzles.difficulty),
						),
					})

					if (existing) {
						console.log(`[Puzzle Generator] ${game.slug} already exists for ${targetDate}`)
						return {
							alreadyExists: true,
							result: {
								success: true,
								gameSlug: game.slug,
								gameName: game.name,
								strategy: config.generationStrategy,
							} as PuzzleGenerationResult,
						}
					}

					// Generate single puzzle (no difficulty)
					const generation = await generateGamePuzzle(game.slug, targetDate)

					if (!generation.result.success) {
						console.error(`[Puzzle Generator] ${game.slug} failed:`, generation.result.error)
						return { alreadyExists: false, generation, result: generation.result }
					}

					// Save to database (difficulty = null)
					await db.insert(dailyPuzzles).values({
						gameSlug: game.slug,
						puzzleDate: targetDateObj,
						puzzleData: generation.puzzleData,
						solution: generation.solution,
						difficulty: null, // Single puzzle (no difficulty selection)
						seed: generation.seed,
						generatorVersion: 'v1.0',
					})

					console.log(`[Puzzle Generator] ${game.slug} saved successfully`)
					return { alreadyExists: false, generation, result: generation.result }
				}),
			),
		)

		// Collect results
		const results: PuzzleGenerationResult[] = generationResults.map((settled, i) => {
			const game = validGames[i]
			const config = GAME_CONFIGS[game.slug as keyof typeof GAME_CONFIGS]

			if (settled.status === 'fulfilled') {
				return settled.value.result
			} else {
				// Promise rejected - unexpected error
				console.error(`[Puzzle Generator] ${game.slug} unexpected error:`, settled.reason)
				return {
					success: false,
					gameSlug: game.slug,
					gameName: game.name,
					strategy: config.generationStrategy,
					error: String(settled.reason),
				} as PuzzleGenerationResult
			}
		})

		// Step 4: Create summary
		const summary: GenerationSummary = await context.run('create-summary', () => ({
			date: targetDate,
			totalGames: results.length,
			successful: results.filter((r) => r.success).length,
			failed: results.filter((r) => !r.success).length,
			results,
		}))

		// Step 5: Log summary
		await context.run('log-summary', () => {
			console.log(formatGenerationSummary(summary))
		})

		// Step 6: Send alert and report to Sentry if needed
		if (shouldAlert(summary)) {
			await context.run('send-alert', async () => {
				await sendAlert(summary)
				reportToSentry(summary)
			})
		}

		return summary
	},
	{
		// Per spec: Exponential backoff retry with 3 attempts
		retries: 3,

		failureFunction: async ({ context, failResponse }) => {
			const errorMessage = `Puzzle generation workflow failed for ${context.requestPayload.targetDate || 'tomorrow'}`

			console.error(errorMessage, {
				payload: context.requestPayload,
				error: failResponse,
			})

			// Add to Dead Letter Queue for later retry/analysis
			// Per spec: All workflows must have dead-letter handling
			await handleWorkflowFailure(
				'generate-puzzles',
				context.requestPayload,
				failResponse,
				context.workflowRunId,
			)

			// Report to Sentry
			Sentry.captureMessage(errorMessage, {
				level: 'fatal',
				tags: {
					workflow: 'generate-puzzles',
					date: context.requestPayload.targetDate || 'tomorrow',
				},
				extra: {
					payload: context.requestPayload,
					failResponse,
				},
			})

			// Try to send alert on failure
			const webhookUrl = process.env.ALERT_WEBHOOK_URL
			if (webhookUrl) {
				try {
					await fetch(webhookUrl, {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							text: `❌ Puzzle Generation Workflow FAILED\nDate: ${context.requestPayload.targetDate || 'tomorrow'}\nError: ${JSON.stringify(failResponse)}`,
						}),
					})
				} catch {
					// Ignore alert failures
				}
			}
		},
	},
)
