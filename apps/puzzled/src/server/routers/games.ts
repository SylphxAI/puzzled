/**
 * Games Router
 *
 * All game-related procedures: puzzles, validation, saving results.
 */

import { TRPCError } from '@trpc/server'
import { and, desc, eq, gte, inArray, isNull } from 'drizzle-orm'
import { z } from 'zod'
import { getPuzzleDateStringUTC, getPuzzleNumber, getTodayUTC } from '@/features/daily/server'
import { hasPremiumAccess } from '@/features/subscription/server'
import { getGameConfig, isValidGameSlug, validateAndScore } from '@/games/registry'
import type { GameResult, GameSubmission, PuzzleDifficulty } from '@/games/types'
import { PUZZLE_DIFFICULTY_VALUES } from '@/games/types'
import { PAGINATION } from '@/lib/config/validation'
import { db } from '@/lib/db'
import {
	dailyPuzzles,
	GAME_MODE_VALUES,
	GAME_RESULT_STATUSES,
	gameSessions,
	type NewGameSession,
	userStats,
	userStreaks,
} from '@/lib/db/schema'
import { getOrCreatePuzzle } from '../services/puzzle'
import { protectedProcedure, protectedRateLimitedProcedure, publicProcedure, router } from '../trpc'

// ==========================================
// Input Schemas
// ==========================================

const gameSlugSchema = z.string().refine(isValidGameSlug, {
	message: 'Invalid game slug',
})

/**
 * Game result submission schema
 *
 * IMPORTANT: No `score` field - score is calculated server-side
 * Client sends submission data, server validates and calculates score
 */
const gameResultSchema = z.object({
	gameSlug: gameSlugSchema,
	status: z.enum(GAME_RESULT_STATUSES),
	attempts: z.number(),
	timeSpentMs: z.number(),
	mode: z.enum(GAME_MODE_VALUES).default('daily'),
	archiveDate: z.string().optional(),
	puzzleId: z.string().uuid(),
	/**
	 * Difficulty level (for games with supportsDifficulty)
	 * NULL/undefined for games without difficulty selection
	 */
	difficulty: z.enum(PUZZLE_DIFFICULTY_VALUES).optional(),
	/**
	 * Game-specific submission data for server validation
	 * Each game defines what data it needs:
	 * - Wordle: { guesses: string[] }
	 * - Sudoku: { finalGrid: number[][] }
	 * - Queens: { finalGrid: boolean[][] }
	 * - etc.
	 */
	data: z.unknown(),
})

// ==========================================
// Games Router
// ==========================================

export const gamesRouter = router({
	/**
	 * Get daily puzzle status for a user
	 * Public: returns puzzle data
	 * Authenticated: also returns completion status
	 *
	 * For games with difficulty support, pass difficulty to get specific puzzle
	 * and check completion status for that difficulty.
	 */
	getDailyStatus: publicProcedure
		.input(
			z.object({
				gameSlug: gameSlugSchema,
				difficulty: z.enum(PUZZLE_DIFFICULTY_VALUES).optional(),
			}),
		)
		.query(async ({ input, ctx }) => {
			const today = getTodayUTC()
			const puzzleDateString = getPuzzleDateStringUTC(today)

			// Validate game exists in registry (SSOT)
			if (!isValidGameSlug(input.gameSlug)) {
				throw new TRPCError({
					code: 'NOT_FOUND',
					message: `Unknown game: ${input.gameSlug}`,
				})
			}

			// Get or create today's puzzle using centralized service
			// Pass difficulty for games that support it
			const { puzzle } = await getOrCreatePuzzle(input.gameSlug, today, input.difficulty)

			// Check completion for authenticated users
			// For games with difficulty, check completion for specific difficulty
			let completedSession = null
			if (ctx.session?.user) {
				const conditions = [
					eq(gameSessions.userId, ctx.session.user.id),
					eq(gameSessions.gameSlug, input.gameSlug),
					eq(gameSessions.puzzleDate, today),
					eq(gameSessions.mode, 'daily'),
					inArray(gameSessions.status, ['won', 'lost']),
				]

				// Match difficulty (or null for games without difficulty)
				if (input.difficulty) {
					conditions.push(eq(gameSessions.difficulty, input.difficulty))
				} else {
					conditions.push(isNull(gameSessions.difficulty))
				}

				const [session] = await db
					.select()
					.from(gameSessions)
					.where(and(...conditions))
					.limit(1)

				if (session) completedSession = session
			}

			const puzzleNumber = getPuzzleNumber(input.gameSlug, today)

			return {
				hasCompleted: !!completedSession,
				completedSession,
				puzzle: {
					id: puzzle.id,
					puzzleNumber,
					puzzleDate: puzzleDateString,
					puzzleData: puzzle.puzzleData,
					difficulty: input.difficulty ?? null,
				},
				canPlay: !completedSession,
				mode: 'daily' as const,
			}
		}),

	/**
	 * Get today's puzzle without user context
	 *
	 * For games with difficulty support, pass difficulty to get specific puzzle.
	 */
	getTodaysPuzzle: publicProcedure
		.input(
			z.object({
				gameSlug: gameSlugSchema,
				difficulty: z.enum(PUZZLE_DIFFICULTY_VALUES).optional(),
			}),
		)
		.query(async ({ input }) => {
			const today = getTodayUTC()

			// Validate game exists in registry (SSOT)
			if (!isValidGameSlug(input.gameSlug)) return null

			// Get or create today's puzzle using centralized service
			// Pass difficulty for games that support it
			const { puzzle } = await getOrCreatePuzzle(input.gameSlug, today, input.difficulty)

			return {
				puzzleId: puzzle.id,
				puzzleNumber: getPuzzleNumber(input.gameSlug, today),
				puzzleDate: getPuzzleDateStringUTC(today),
				puzzleData: puzzle.puzzleData,
				difficulty: input.difficulty ?? null,
			}
		}),

	/**
	 * Get archive puzzle (premium only)
	 */
	getArchivePuzzle: protectedProcedure
		.input(
			z.object({
				gameSlug: gameSlugSchema,
				date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
			}),
		)
		.query(async ({ input, ctx }) => {
			const isPremium = await hasPremiumAccess(ctx.user.id)
			if (!isPremium) {
				throw new TRPCError({
					code: 'FORBIDDEN',
					message: 'Archive access requires premium subscription',
				})
			}

			// Validate game exists in registry (SSOT)
			if (!isValidGameSlug(input.gameSlug)) {
				throw new TRPCError({
					code: 'NOT_FOUND',
					message: `Unknown game: ${input.gameSlug}`,
				})
			}

			const archiveDate = new Date(input.date)
			archiveDate.setUTCHours(0, 0, 0, 0)

			const today = getTodayUTC()
			if (archiveDate >= today) {
				throw new TRPCError({
					code: 'BAD_REQUEST',
					message: 'Cannot access future puzzles',
				})
			}

			// Check if already played
			const [existingSession] = await db
				.select()
				.from(gameSessions)
				.where(
					and(
						eq(gameSessions.userId, ctx.user.id),
						eq(gameSessions.gameSlug, input.gameSlug),
						eq(gameSessions.mode, 'archive'),
						eq(gameSessions.archiveDate, archiveDate),
						inArray(gameSessions.status, ['won', 'lost']),
					),
				)
				.limit(1)

			if (existingSession) {
				throw new TRPCError({
					code: 'CONFLICT',
					message: 'Already played this archive puzzle',
				})
			}

			// Get or create puzzle using centralized service
			const { puzzle } = await getOrCreatePuzzle(input.gameSlug, archiveDate)

			return {
				...puzzle,
				solution: null, // Don't expose solution
			}
		}),

	/**
	 * Validate a game guess (generic - delegates to game config)
	 * Rate limited to prevent brute-force attacks on puzzle solutions
	 *
	 * SECURITY: Requires authentication to prevent anonymous brute-force.
	 * Rate limiting by user account is enforceable; rate limiting by IP is not.
	 * Guest users can use client-side validation for immediate feedback.
	 */
	validateGuess: protectedRateLimitedProcedure
		.input(
			z.object({
				puzzleId: z.string().uuid(),
				gameSlug: gameSlugSchema,
				guess: z.unknown(),
			}),
		)
		.mutation(async ({ input }) => {
			const config = getGameConfig(input.gameSlug)

			if (!config?.validateGuess) {
				throw new TRPCError({
					code: 'BAD_REQUEST',
					message: `Game ${input.gameSlug} does not support guess validation`,
				})
			}

			const [puzzle] = await db
				.select()
				.from(dailyPuzzles)
				.where(eq(dailyPuzzles.id, input.puzzleId))
				.limit(1)

			if (!puzzle?.solution) {
				throw new TRPCError({
					code: 'NOT_FOUND',
					message: 'Puzzle not found',
				})
			}

			// Delegate to game-specific validation via registry
			// Each game owns its own validation logic in config.validateGuess
			return config.validateGuess(puzzle.solution, input.guess)
		}),

	/**
	 * Save game result
	 *
	 * SECURITY: Score is calculated server-side, never trusted from client
	 * Client sends submission data, server validates AND calculates score
	 */
	saveResult: protectedRateLimitedProcedure
		.input(gameResultSchema)
		.mutation(async ({ input, ctx }) => {
			const mode = input.mode

			// Validate game exists in registry (SSOT)
			if (!isValidGameSlug(input.gameSlug)) {
				throw new TRPCError({
					code: 'NOT_FOUND',
					message: `Game not found: ${input.gameSlug}`,
				})
			}

			// Server-side validation AND scoring
			const validationResult = await validateAndScoreSubmission(input)
			if (!validationResult.valid) {
				throw new TRPCError({
					code: 'BAD_REQUEST',
					message: validationResult.error || 'Invalid game result',
				})
			}

			// Server determines status and score - not client
			const validatedStatus = validationResult.status
			const serverScore = validationResult.score

			// Determine puzzle date
			let puzzleDate: Date
			let archiveDate: Date | null = null

			if (mode === 'archive' && input.archiveDate) {
				puzzleDate = new Date(`${input.archiveDate}T00:00:00Z`)
				archiveDate = puzzleDate
			} else {
				puzzleDate = getTodayUTC()
			}

			// For games with difficulty support, different difficulties are separate completions
			// Users can complete each difficulty once per day
			const difficulty = input.difficulty as PuzzleDifficulty | undefined

			// Check for existing session
			if (mode === 'daily' || mode === 'archive') {
				const conditions = [
					eq(gameSessions.userId, ctx.user.id),
					eq(gameSessions.gameSlug, input.gameSlug),
					eq(gameSessions.mode, mode),
				]

				if (mode === 'archive' && archiveDate) {
					conditions.push(eq(gameSessions.archiveDate, archiveDate))
				} else {
					conditions.push(eq(gameSessions.puzzleDate, puzzleDate))
				}

				// For games with difficulty, check for existing session at same difficulty
				if (difficulty) {
					conditions.push(eq(gameSessions.difficulty, difficulty))
				} else {
					conditions.push(isNull(gameSessions.difficulty))
				}

				const [existingSession] = await db
					.select()
					.from(gameSessions)
					.where(and(...conditions))
					.limit(1)

				if (existingSession) {
					throw new TRPCError({
						code: 'CONFLICT',
						message:
							mode === 'daily' ? 'Already played today' : 'Already played this archive puzzle',
					})
				}
			}

			// Create session with transaction to prevent race conditions
			const session = await db.transaction(async (tx) => {
				// Double-check for existing session within transaction
				if (mode === 'daily' || mode === 'archive') {
					const conditions = [
						eq(gameSessions.userId, ctx.user.id),
						eq(gameSessions.gameSlug, input.gameSlug),
						eq(gameSessions.mode, mode),
					]

					if (mode === 'archive' && archiveDate) {
						conditions.push(eq(gameSessions.archiveDate, archiveDate))
					} else {
						conditions.push(eq(gameSessions.puzzleDate, puzzleDate))
					}

					// For games with difficulty, check for existing session at same difficulty
					if (difficulty) {
						conditions.push(eq(gameSessions.difficulty, difficulty))
					} else {
						conditions.push(isNull(gameSessions.difficulty))
					}

					const [existingInTx] = await tx
						.select()
						.from(gameSessions)
						.where(and(...conditions))
						.limit(1)

					if (existingInTx) {
						throw new TRPCError({
							code: 'CONFLICT',
							message:
								mode === 'daily'
									? difficulty
										? `Already played ${difficulty} difficulty today`
										: 'Already played today'
									: 'Already played this archive puzzle',
						})
					}
				}

				// Create session with SERVER-CALCULATED score
				const newSession: NewGameSession = {
					userId: ctx.user.id,
					gameSlug: input.gameSlug,
					puzzleId: input.puzzleId,
					puzzleDate,
					difficulty, // Include difficulty in session
					mode,
					archiveDate,
					status: validatedStatus,
					score: serverScore, // SERVER calculated, not client
					attempts: input.attempts,
					timeSpentMs: input.timeSpentMs,
					state: null, // No longer storing client state
					completedAt: new Date(),
				}

				const [newSessionResult] = await tx.insert(gameSessions).values(newSession).returning()

				return newSessionResult
			})

			// Update stats for daily mode (outside transaction for better concurrency)
			if (mode === 'daily') {
				await updateUserStats(ctx.user.id, input.gameSlug, {
					status: validatedStatus,
					score: serverScore, // SERVER calculated
					attempts: input.attempts,
				})
			}

			// Return session with server-calculated score
			return { success: true, session, mode, score: serverScore }
		}),

	/**
	 * Get user's game history
	 */
	getHistory: protectedProcedure
		.input(
			z.object({
				gameSlug: gameSlugSchema,
				limit: z.number().min(1).max(PAGINATION.ADMIN_MAX_LIMIT).default(PAGINATION.DEFAULT_LIMIT),
			}),
		)
		.query(async ({ input, ctx }) => {
			const history = await db
				.select({
					id: gameSessions.id,
					status: gameSessions.status,
					score: gameSessions.score,
					attempts: gameSessions.attempts,
					puzzleDate: gameSessions.puzzleDate,
					completedAt: gameSessions.completedAt,
					mode: gameSessions.mode,
				})
				.from(gameSessions)
				.where(
					and(eq(gameSessions.userId, ctx.user.id), eq(gameSessions.gameSlug, input.gameSlug)),
				)
				.orderBy(desc(gameSessions.completedAt))
				.limit(input.limit)

			return history
		}),

	/**
	 * Get archive dates for a game
	 */
	getArchiveDates: protectedProcedure
		.input(
			z.object({
				gameSlug: gameSlugSchema,
				startDate: z.string(),
				endDate: z.string(),
			}),
		)
		.query(async ({ input, ctx }) => {
			const isPremium = await hasPremiumAccess(ctx.user.id)
			if (!isPremium) {
				throw new TRPCError({
					code: 'FORBIDDEN',
					message: 'Archive access requires premium subscription',
				})
			}

			// Validate game exists in registry (SSOT)
			if (!isValidGameSlug(input.gameSlug)) {
				throw new TRPCError({
					code: 'NOT_FOUND',
					message: `Unknown game: ${input.gameSlug}`,
				})
			}

			const start = new Date(input.startDate)
			const end = new Date(input.endDate)
			const today = getTodayUTC()

			const playedSessions = await db
				.select({ archiveDate: gameSessions.archiveDate })
				.from(gameSessions)
				.where(
					and(
						eq(gameSessions.userId, ctx.user.id),
						eq(gameSessions.gameSlug, input.gameSlug),
						eq(gameSessions.mode, 'archive'),
						inArray(gameSessions.status, ['won', 'lost']),
						gte(gameSessions.archiveDate, start),
					),
				)

			const playedDates = new Set(
				playedSessions
					.filter((s) => s.archiveDate)
					.map((s) => s.archiveDate!.toISOString().split('T')[0]),
			)

			const result: { date: string; played: boolean }[] = []
			const current = new Date(start)
			while (current <= end && current < today) {
				const dateStr = current.toISOString().split('T')[0]
				result.push({
					date: dateStr,
					played: playedDates.has(dateStr),
				})
				current.setDate(current.getDate() + 1)
			}

			return result
		}),
})

// ==========================================
// Internal Validation & Scoring
// ==========================================

/**
 * Validate game submission AND calculate score
 *
 * SECURITY: This is the single source of truth for game results.
 * Client sends moves/final state, server validates and calculates score.
 * Score is NEVER trusted from client.
 *
 * Each game implements validateAndScore() in its config.ts.
 * This function delegates to the appropriate game validator.
 */
async function validateAndScoreSubmission(
	input: z.infer<typeof gameResultSchema>,
): Promise<GameResult> {
	const [puzzle] = await db
		.select()
		.from(dailyPuzzles)
		.where(eq(dailyPuzzles.id, input.puzzleId))
		.limit(1)

	if (!puzzle?.solution || !puzzle?.puzzleData) {
		return { valid: false, error: 'Puzzle not found' }
	}

	// Build submission object for registry validator
	const submission: GameSubmission = {
		status: input.status,
		attempts: input.attempts,
		timeSpentMs: input.timeSpentMs,
		data: input.data,
	}

	// Delegate to per-game validateAndScore via registry
	// This validates the submission AND calculates the score
	return validateAndScore(input.gameSlug, puzzle.solution, puzzle.puzzleData, submission)
}

async function updateUserStats(
	userId: string,
	gameSlug: string,
	result: { status: 'won' | 'lost'; score?: number; attempts: number },
) {
	const won = result.status === 'won'
	const now = new Date()

	// Use transaction to prevent race conditions in concurrent updates
	await db.transaction(async (tx) => {
		const [existing] = await tx
			.select()
			.from(userStats)
			.where(and(eq(userStats.userId, userId), eq(userStats.gameSlug, gameSlug)))
			.limit(1)

		if (existing) {
			const lastPlayed = existing.lastPlayedAt

			// Use UTC date comparison for consistent streak tracking across timezones
			const getUTCDateString = (d: Date) => d.toISOString().split('T')[0]
			const nowUTC = getUTCDateString(now)
			const lastPlayedUTC = lastPlayed ? getUTCDateString(lastPlayed) : null

			// Calculate yesterday's UTC date
			const yesterday = new Date(now)
			yesterday.setUTCDate(yesterday.getUTCDate() - 1)
			const yesterdayUTC = getUTCDateString(yesterday)

			// Streak continues if last played was yesterday UTC and user wins
			// Same day plays don't affect streak (already played today)
			const isSameDay = lastPlayedUTC === nowUTC
			const isConsecutiveDay = lastPlayedUTC === yesterdayUTC

			// Determine if streak would break (loss or gap > 1 day)
			const streakWouldBreak =
				!won || (!isSameDay && !isConsecutiveDay && existing.currentStreak > 0)

			// Check for streak freeze if streak would break and user has a meaningful streak
			// SECURITY: Streak freeze is a premium feature - verify access before consuming
			let usedFreeze = false
			if (streakWouldBreak && existing.currentStreak > 0) {
				// Streak freeze requires premium subscription
				const isPremium = await hasPremiumAccess(userId)
				if (isPremium) {
					// Get user's play streak record to check for available freezes
					const [playStreak] = await tx
						.select()
						.from(userStreaks)
						.where(
							and(
								eq(userStreaks.userId, userId),
								eq(userStreaks.type, 'play'),
								isNull(userStreaks.gameSlug),
							),
						)
						.limit(1)

					// Auto-consume freeze if available and enabled
					if (playStreak?.autoFreezeEnabled && playStreak.freezesAvailable > 0) {
						// Consume the freeze
						await tx
							.update(userStreaks)
							.set({
								freezesAvailable: playStreak.freezesAvailable - 1,
								freezesUsed: playStreak.freezesUsed + 1,
								updatedAt: now,
							})
							.where(eq(userStreaks.id, playStreak.id))

						usedFreeze = true
					}
				}
			}

			// Streak logic:
			// - Used freeze: keep current streak (protected)
			// - Win on consecutive day: streak + 1
			// - Win on same day: keep current streak (already played today)
			// - Win after gap: reset to 1
			// - Loss: reset to 0
			let newStreak: number
			if (usedFreeze) {
				// Freeze protects the streak - keep it as-is
				newStreak = existing.currentStreak
			} else if (won) {
				newStreak = isConsecutiveDay
					? existing.currentStreak + 1
					: isSameDay
						? existing.currentStreak
						: 1
			} else {
				newStreak = 0
			}

			const guessDistribution = (existing.guessDistribution as Record<string, number>) || {}
			if (won && result.attempts) {
				const key = String(result.attempts)
				guessDistribution[key] = (guessDistribution[key] || 0) + 1
			}

			await tx
				.update(userStats)
				.set({
					gamesPlayed: existing.gamesPlayed + 1,
					gamesWon: won ? existing.gamesWon + 1 : existing.gamesWon,
					currentStreak: newStreak,
					maxStreak: Math.max(existing.maxStreak, newStreak),
					totalScore: existing.totalScore + (result.score || 0),
					guessDistribution,
					lastPlayedAt: now,
					updatedAt: now,
				})
				.where(eq(userStats.id, existing.id))
		} else {
			// Use INSERT ... ON CONFLICT to handle concurrent first-time inserts
			await tx
				.insert(userStats)
				.values({
					userId,
					gameSlug,
					gamesPlayed: 1,
					gamesWon: won ? 1 : 0,
					currentStreak: won ? 1 : 0,
					maxStreak: won ? 1 : 0,
					totalScore: result.score || 0,
					guessDistribution: won && result.attempts ? { [result.attempts]: 1 } : {},
					lastPlayedAt: now,
				})
				.onConflictDoNothing({
					target: [userStats.userId, userStats.gameSlug],
				})
		}
	})
}
