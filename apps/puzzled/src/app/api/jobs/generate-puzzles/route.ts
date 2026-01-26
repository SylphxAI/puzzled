export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minutes for puzzle generation

import { and, eq, isNull } from 'drizzle-orm'
import { type NextRequest, NextResponse } from 'next/server'
import { GAME_CONFIGS, getAllGames, isValidGameSlug } from '@/games/registry'
import { formatGenerationSummary, generateGamePuzzle, shouldAlert } from '@/games/registry.server'
import type { GenerationSummary, PuzzleDifficulty, PuzzleGenerationResult } from '@/games/types'
import { verifyCronAuth } from '@/lib/api/cron'
import { db } from '@/lib/db'
import { dailyPuzzles } from '@/lib/db/schema'
import { handleWorkflowFailure } from '@/lib/dlq'
import { captureMessage } from '@/lib/monitoring'

const DIFFICULTY_LEVELS: PuzzleDifficulty[] = ['easy', 'medium', 'hard']

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
 * Report generation issues to platform monitoring
 */
function reportToMonitoring(summary: GenerationSummary): void {
	// Report failures as errors
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
			success: allSucceeded,
			gameSlug: game.slug,
			gameName: `${game.name} (${successCount}/${DIFFICULTY_LEVELS.length} difficulties)`,
			strategy: config.generationStrategy,
			error: failCount > 0 ? `${failCount} difficulties failed` : undefined,
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
			success: true,
			gameSlug: game.slug,
			gameName: game.name,
			strategy: config.generationStrategy,
		}
	}

	// Generate single puzzle (no difficulty)
	const generation = await generateGamePuzzle(game.slug, targetDate)

	if (!generation.result.success) {
		console.error(`[Puzzle Generator] ${game.slug} failed:`, generation.result.error)
		return generation.result
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
	return generation.result
}

/**
 * POST /api/jobs/generate-puzzles
 *
 * Generates daily puzzles for all games.
 * Can be triggered by:
 * - Vercel Cron (via CRON_SECRET auth)
 * - Admin panel (manual trigger)
 * - SDK job scheduler (via Platform)
 *
 * Architecture:
 * - Parallel generation for all games (Promise.allSettled)
 * - Local DLQ for failure handling
 * - Alerting via webhook for failures
 */
export async function POST(request: NextRequest) {
	// Auth check - allow cron auth or internal calls
	const authError = verifyCronAuth(request, '[PuzzleGeneration]')
	// Also allow calls without auth header for internal/admin use
	const isInternalCall = request.headers.get('x-internal-call') === 'true'

	if (authError && !isInternalCall) {
		return authError
	}

	let payload: GeneratePuzzlesPayload = {}
	try {
		const body = await request.text()
		if (body) {
			payload = JSON.parse(body)
		}
	} catch {
		// Empty body is OK
	}

	const targetDate = payload.targetDate || getTomorrowDateString()
	const targetDateObj = new Date(`${targetDate}T00:00:00Z`)
	const runId = `gen-${targetDate}-${Date.now()}`

	console.log(`[Puzzle Generator] Starting for ${targetDate} (runId: ${runId})`)

	try {
		// Step 1: Get all games from registry (fully automatic)
		const registeredGames = getAllGames().map((g) => ({
			slug: g.slug,
			name: g.name,
			strategy: g.generationStrategy,
			supportsDifficulty: g.supportsDifficulty ?? false,
		}))

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
		// Using Promise.allSettled ensures one failure doesn't affect others
		const generationResults = await Promise.allSettled(
			validGames.map((game) => generateForGame(game, targetDate, targetDateObj)),
		)

		// Collect results
		const results: PuzzleGenerationResult[] = generationResults.map((settled, i) => {
			const game = validGames[i]!
			const config = GAME_CONFIGS[game.slug as keyof typeof GAME_CONFIGS]

			if (settled.status === 'fulfilled') {
				return settled.value
			}
			// Promise rejected - unexpected error
			console.error(`[Puzzle Generator] ${game.slug} unexpected error:`, settled.reason)
			return {
				success: false,
				gameSlug: game.slug,
				gameName: game.name,
				strategy: config.generationStrategy,
				error: String(settled.reason),
			} as PuzzleGenerationResult
		})

		// Step 4: Create summary
		const summary: GenerationSummary = {
			date: targetDate,
			totalGames: results.length,
			successful: results.filter((r) => r.success).length,
			failed: results.filter((r) => !r.success).length,
			results,
		}

		// Step 5: Log summary
		console.log(formatGenerationSummary(summary))

		// Step 6: Send alert and report to monitoring if needed
		if (shouldAlert(summary)) {
			await sendAlert(summary)
			reportToMonitoring(summary)
		}

		return NextResponse.json({
			success: summary.failed === 0,
			summary,
			runId,
		})
	} catch (error) {
		const errorMessage = `Puzzle generation failed for ${targetDate}`
		console.error(errorMessage, error)

		// Add to Dead Letter Queue for later retry/analysis
		await handleWorkflowFailure('generate-puzzles', payload, error, runId)

		// Report to platform monitoring
		captureMessage(errorMessage, {
			level: 'fatal',
			tags: {
				workflow: 'generate-puzzles',
				date: targetDate,
			},
			extra: {
				payload,
				error: error instanceof Error ? error.message : String(error),
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
						text: `❌ Puzzle Generation FAILED\nDate: ${targetDate}\nError: ${error instanceof Error ? error.message : String(error)}`,
					}),
				})
			} catch {
				// Ignore alert failures
			}
		}

		return NextResponse.json(
			{
				success: false,
				error: error instanceof Error ? error.message : String(error),
				runId,
			},
			{ status: 500 },
		)
	}
}
