/**
 * Generate Puzzles Job Handler
 *
 * Direct execution handler for puzzle generation.
 * Extracted from /api/jobs/generate-puzzles/route.ts for sync execution.
 */

import { and, eq, isNull } from 'drizzle-orm'
import { GAME_CONFIGS, getAllGames, isValidGameSlug } from '@/games/registry'
import { formatGenerationSummary, generateGamePuzzle, shouldAlert } from '@/games/registry.server'
import type { GenerationSummary, PuzzleDifficulty, PuzzleGenerationResult } from '@/games/types'
import { db } from '@/lib/db'
import { dailyPuzzles } from '@/lib/db/schema'
import { handleWorkflowFailure } from '@/lib/dlq'
import { captureMessage } from '@/lib/monitoring'
import type { JobHandler } from '../handlers'

const DIFFICULTY_LEVELS: PuzzleDifficulty[] = ['easy', 'medium', 'hard']

/**
 * Get tomorrow's date string in YYYY-MM-DD format (UTC)
 */
function getTomorrowDateString(): string {
	const tomorrow = new Date()
	tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
	return tomorrow.toISOString().split('T')[0]!
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
		await fetch(webhookUrl, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				text: message,
				content: message,
			}),
		})
		console.log('[Alert] Sent alert to webhook')
	} catch (error) {
		console.error('[Alert] Failed to send alert:', error)
	}
}

/**
 * Report generation issues to platform monitoring
 */
function reportToMonitoring(summary: GenerationSummary): void {
	for (const result of summary.results) {
		if (!result.success) {
			captureMessage(`Puzzle generation failed: ${result.gameSlug}`, {
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

/**
 * Generate puzzle for a single game (with difficulty support)
 */
async function generateForGame(
	game: { slug: string; name: string; supportsDifficulty: boolean },
	targetDate: string,
	targetDateObj: Date,
): Promise<PuzzleGenerationResult> {
	const config = GAME_CONFIGS[game.slug as keyof typeof GAME_CONFIGS]

	// For games with difficulty support, generate 3 puzzles
	if (game.supportsDifficulty) {
		let successCount = 0
		let failCount = 0

		for (const difficulty of DIFFICULTY_LEVELS) {
			const existing = await db.query.dailyPuzzles.findFirst({
				where: and(
					eq(dailyPuzzles.gameSlug, game.slug),
					eq(dailyPuzzles.puzzleDate, targetDateObj),
					eq(dailyPuzzles.difficulty, difficulty),
				),
			})

			if (existing) {
				console.log(
					`[Puzzle Generator] ${game.slug} (${difficulty}) already exists for ${targetDate}`,
				)
				successCount++
				continue
			}

			const generation = await generateGamePuzzle(game.slug, targetDate, difficulty)

			if (!generation.result.success) {
				console.error(
					`[Puzzle Generator] ${game.slug} (${difficulty}) failed:`,
					generation.result.error,
				)
				failCount++
				continue
			}

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

		const allSucceeded = failCount === 0
		return {
			success: allSucceeded,
			gameSlug: game.slug,
			gameName: `${game.name} (${successCount}/${DIFFICULTY_LEVELS.length} difficulties)`,
			strategy: config.generationStrategy,
			error: failCount > 0 ? `${failCount} difficulties failed` : undefined,
		}
	}

	// For games WITHOUT difficulty support, generate single puzzle
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
			success: true,
			gameSlug: game.slug,
			gameName: game.name,
			strategy: config.generationStrategy,
		}
	}

	const generation = await generateGamePuzzle(game.slug, targetDate)

	if (!generation.result.success) {
		console.error(`[Puzzle Generator] ${game.slug} failed:`, generation.result.error)
		return generation.result
	}

	await db.insert(dailyPuzzles).values({
		gameSlug: game.slug,
		puzzleDate: targetDateObj,
		puzzleData: generation.puzzleData,
		solution: generation.solution,
		difficulty: null,
		seed: generation.seed,
		generatorVersion: 'v1.0',
	})

	console.log(`[Puzzle Generator] ${game.slug} saved successfully`)
	return generation.result
}

/**
 * Generate puzzles handler
 */
export const generatePuzzlesHandler: JobHandler = async (payload, context) => {
	const targetDate = (payload.targetDate as string) || getTomorrowDateString()
	const targetDateObj = new Date(`${targetDate}T00:00:00Z`)
	const runId = `gen-${targetDate}-${Date.now()}`

	console.log(
		`[Puzzle Generator] Starting for ${targetDate} (runId: ${runId}, jobId: ${context.jobId})`,
	)

	try {
		const registeredGames = getAllGames().map((g) => ({
			slug: g.slug,
			name: g.name,
			strategy: g.generationStrategy,
			supportsDifficulty: g.supportsDifficulty ?? false,
		}))

		console.log(`[Puzzle Generator] Found ${registeredGames.length} registered games`)

		const validGames = registeredGames.filter((game) => {
			if (!isValidGameSlug(game.slug)) {
				console.warn(`[Puzzle Generator] ${game.slug} not in registry, skipping`)
				return false
			}
			return true
		})

		console.log(`[Puzzle Generator] Generating ${validGames.length} games in parallel`)

		const generationResults = await Promise.allSettled(
			validGames.map((game) => generateForGame(game, targetDate, targetDateObj)),
		)

		const results: PuzzleGenerationResult[] = generationResults.map((settled, i) => {
			const game = validGames[i]!
			const config = GAME_CONFIGS[game.slug as keyof typeof GAME_CONFIGS]

			if (settled.status === 'fulfilled') {
				return settled.value
			}
			console.error(`[Puzzle Generator] ${game.slug} unexpected error:`, settled.reason)
			return {
				success: false,
				gameSlug: game.slug,
				gameName: game.name,
				strategy: config.generationStrategy,
				error: String(settled.reason),
			} as PuzzleGenerationResult
		})

		const summary: GenerationSummary = {
			date: targetDate,
			totalGames: results.length,
			successful: results.filter((r) => r.success).length,
			failed: results.filter((r) => !r.success).length,
			results,
		}

		console.log(formatGenerationSummary(summary))

		if (shouldAlert(summary)) {
			await sendAlert(summary)
			reportToMonitoring(summary)
		}

		return {
			success: summary.failed === 0,
			data: { summary, runId },
		}
	} catch (error) {
		const errorMessage = `Puzzle generation failed for ${targetDate}`
		console.error(errorMessage, error)

		await handleWorkflowFailure('generate-puzzles', payload, error, runId)

		captureMessage(errorMessage, {
			level: 'fatal',
			tags: { workflow: 'generate-puzzles', date: targetDate },
			extra: { payload, error: error instanceof Error ? error.message : String(error) },
		})

		const webhookUrl = process.env.ALERT_WEBHOOK_URL
		if (webhookUrl) {
			try {
				await fetch(webhookUrl, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						text: `❌ Puzzle Generation FAILED\nDate: ${targetDate}\nError: ${error instanceof Error ? error.message : String(error)}`,
					}),
				})
			} catch {
				// Ignore alert failures
			}
		}

		return {
			success: false,
			error: error instanceof Error ? error.message : String(error),
			data: { runId },
		}
	}
}
