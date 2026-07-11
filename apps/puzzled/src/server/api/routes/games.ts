/**
 * Games Routes
 *
 * All game-related endpoints: puzzles, validation, saving results.
 *
 * ARCHITECTURE (State of the Art):
 * - Game sessions are saved to gameSessions table
 * - Streak recording is done via Platform SDK recordStreakActivity()
 * - Score submission to Platform leaderboards via submitScore()
 * - No separate user_stats aggregation table - computed on demand
 *
 * NOTE: Uses method chaining for proper hc type inference.
 */

import { OpenAPIHono, z } from '@hono/zod-openapi'
import { and, desc, eq, gte, inArray, isNull } from 'drizzle-orm'
import { HTTPException } from 'hono/http-exception'
import { getPuzzleDateStringUTC, getPuzzleNumber, getTodayUTC } from '@/features/daily/server'
import { getGameConfig, isValidGameSlug, validateAndScore } from '@/games/registry'
import type { GameResult, GameSubmission, PuzzleDifficulty } from '@/games/types'
import { hasPremiumAccess } from '@/lib/billing/server'
import { PAGINATION } from '@/lib/config/validation'
import { db } from '@/lib/db'
import {
	dailyPuzzles,
	GAME_MODE_VALUES,
	GAME_RESULT_STATUSES,
	gameSessions,
	type NewGameSession,
	userFreezeData,
} from '@/lib/db/schema'
import { shouldDelegateScoringToRust, validateAndScoreViaRust } from '../../rust-api-client'
import { getOrCreatePuzzle } from '../../services/puzzle'
import { authMiddleware, authRateLimitMiddleware, optionalAuthMiddleware } from '../middleware'
import type { PuzzledAuthEnv } from '../types'

// ==========================================
// Schemas
// ==========================================

const DailyStatusQuerySchema = z.object({
	gameSlug: z.string().min(1).max(50),
	difficulty: z.enum(['easy', 'medium', 'hard', 'expert']).optional(),
})

const ArchivePuzzleQuerySchema = z.object({
	gameSlug: z.string().min(1).max(50),
	date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

const ValidateGuessBodySchema = z.object({
	puzzleId: z.string().uuid(),
	gameSlug: z.string().min(1).max(50),
	guess: z.unknown(),
})

const SaveResultBodySchema = z.object({
	gameSlug: z.string().min(1).max(50),
	status: z.enum(GAME_RESULT_STATUSES),
	attempts: z.number(),
	timeSpentMs: z.number(),
	mode: z.enum(GAME_MODE_VALUES).default('daily'),
	archiveDate: z.string().optional(),
	puzzleId: z.string().uuid(),
	difficulty: z.enum(['easy', 'medium', 'hard', 'expert']).optional(),
	data: z.unknown(),
})

const HistoryQuerySchema = z.object({
	gameSlug: z.string().min(1).max(50),
	limit: z.coerce.number().min(1).max(PAGINATION.ADMIN_MAX_LIMIT).default(PAGINATION.DEFAULT_LIMIT),
})

const ArchiveDatesQuerySchema = z.object({
	gameSlug: z.string().min(1).max(50),
	startDate: z.string(),
	endDate: z.string(),
})

// ==========================================
// Internal Functions
// ==========================================

async function validateAndScoreSubmission(input: {
	gameSlug: string
	status: 'won' | 'lost' | 'abandoned'
	attempts: number
	timeSpentMs: number
	puzzleId: string
	data: unknown
}): Promise<GameResult> {
	// 'abandoned' status cannot be validated - only 'won' or 'lost' are valid submissions
	if (input.status === 'abandoned') {
		return { valid: false, error: 'Cannot validate abandoned game' }
	}

	const [puzzle] = await db
		.select()
		.from(dailyPuzzles)
		.where(eq(dailyPuzzles.id, input.puzzleId))
		.limit(1)

	if (!puzzle?.solution || !puzzle?.puzzleData) {
		return { valid: false, error: 'Puzzle not found' }
	}

	const submission: GameSubmission = {
		status: input.status,
		attempts: input.attempts,
		timeSpentMs: input.timeSpentMs,
		data: input.data,
	}

	if (shouldDelegateScoringToRust()) {
		return validateAndScoreViaRust({
			gameSlug: input.gameSlug,
			solution: puzzle.solution,
			puzzleData: puzzle.puzzleData,
			submission,
		})
	}

	return validateAndScore(input.gameSlug, puzzle.solution, puzzle.puzzleData, submission)
}

/**
 * Check if user can use auto-freeze to preserve streak
 * This is a premium feature stored in userFreezeData table
 */
async function tryAutoFreeze(userId: string): Promise<boolean> {
	const isPremium = await hasPremiumAccess(userId)
	if (!isPremium) return false

	const freezeData = await db.query.userFreezeData.findFirst({
		where: eq(userFreezeData.userId, userId),
	})

	if (!freezeData?.autoFreezeEnabled || freezeData.freezesAvailable <= 0) {
		return false
	}

	// Use a freeze
	await db
		.update(userFreezeData)
		.set({
			freezesAvailable: freezeData.freezesAvailable - 1,
			freezesUsed: freezeData.freezesUsed + 1,
			updatedAt: new Date(),
		})
		.where(eq(userFreezeData.id, freezeData.id))

	return true
}

// ==========================================
// Router (Method Chaining for hc type inference)
// ==========================================

const gamesRoutes = new OpenAPIHono<PuzzledAuthEnv>()
	// GET /daily-status - optional auth (shows completion for authenticated users)
	.get('/daily-status', optionalAuthMiddleware, async (c) => {
		const query = c.req.query()
		const parsed = DailyStatusQuerySchema.safeParse(query)
		if (!parsed.success) {
			throw new HTTPException(400, { message: 'Invalid query parameters' })
		}
		const { gameSlug, difficulty } = parsed.data
		const user = c.get('user')

		const today = getTodayUTC()
		const puzzleDateString = getPuzzleDateStringUTC(today)

		if (!isValidGameSlug(gameSlug)) {
			throw new HTTPException(404, { message: `Unknown game: ${gameSlug}` })
		}

		const { puzzle } = await getOrCreatePuzzle(gameSlug, today, difficulty as PuzzleDifficulty)

		let completedSession = null
		if (user) {
			const conditions: ReturnType<typeof eq>[] = [
				eq(gameSessions.userId, user.id),
				eq(gameSessions.gameSlug, gameSlug),
				eq(gameSessions.puzzleDate, today),
				eq(gameSessions.mode, 'daily'),
				inArray(gameSessions.status, ['won', 'lost']),
			]

			if (difficulty && difficulty !== 'expert') {
				conditions.push(eq(gameSessions.difficulty, difficulty as 'easy' | 'medium' | 'hard'))
			} else if (!difficulty) {
				conditions.push(isNull(gameSessions.difficulty))
			}

			const [session] = await db
				.select()
				.from(gameSessions)
				.where(and(...conditions))
				.limit(1)

			if (session) completedSession = session
		}

		const puzzleNumber = getPuzzleNumber(gameSlug, today)

		return c.json({
			hasCompleted: !!completedSession,
			completedSession,
			puzzle: {
				id: puzzle.id,
				puzzleNumber,
				puzzleDate: puzzleDateString,
				puzzleData: puzzle.puzzleData,
				difficulty: difficulty ?? null,
			},
			canPlay: !completedSession,
			mode: 'daily' as const,
		})
	})

	// GET /todays-puzzle - public
	.get('/todays-puzzle', async (c) => {
		const query = c.req.query()
		const parsed = DailyStatusQuerySchema.safeParse(query)
		if (!parsed.success) {
			return c.json(null)
		}
		const { gameSlug, difficulty } = parsed.data

		const today = getTodayUTC()

		if (!isValidGameSlug(gameSlug)) {
			return c.json(null)
		}

		const { puzzle } = await getOrCreatePuzzle(gameSlug, today, difficulty as PuzzleDifficulty)

		return c.json({
			puzzleId: puzzle.id,
			puzzleNumber: getPuzzleNumber(gameSlug, today),
			puzzleDate: getPuzzleDateStringUTC(today),
			puzzleData: puzzle.puzzleData,
			difficulty: difficulty ?? null,
		})
	})

	// GET /archive-puzzle - authenticated
	.get('/archive-puzzle', authMiddleware, async (c) => {
		const query = c.req.query()
		const parsed = ArchivePuzzleQuerySchema.safeParse(query)
		if (!parsed.success) {
			throw new HTTPException(400, { message: 'Invalid query parameters' })
		}
		const { gameSlug, date } = parsed.data
		const user = c.get('user')

		const isPremium = await hasPremiumAccess(user.id)
		if (!isPremium) {
			throw new HTTPException(403, {
				message: 'Archive access requires premium subscription',
			})
		}

		if (!isValidGameSlug(gameSlug)) {
			throw new HTTPException(404, { message: `Unknown game: ${gameSlug}` })
		}

		const archiveDate = new Date(date)
		archiveDate.setUTCHours(0, 0, 0, 0)

		const today = getTodayUTC()
		if (archiveDate >= today) {
			throw new HTTPException(400, { message: 'Cannot access future puzzles' })
		}

		const [existingSession] = await db
			.select()
			.from(gameSessions)
			.where(
				and(
					eq(gameSessions.userId, user.id),
					eq(gameSessions.gameSlug, gameSlug),
					eq(gameSessions.mode, 'archive'),
					eq(gameSessions.archiveDate, archiveDate),
					inArray(gameSessions.status, ['won', 'lost']),
				),
			)
			.limit(1)

		if (existingSession) {
			throw new HTTPException(409, {
				message: 'Already played this archive puzzle',
			})
		}

		const { puzzle } = await getOrCreatePuzzle(gameSlug, archiveDate)

		return c.json({
			...puzzle,
			solution: null,
		})
	})

	// POST /validate-guess - authenticated + rate limited
	.post('/validate-guess', authRateLimitMiddleware, async (c) => {
		const body = await c.req.json()
		const parsed = ValidateGuessBodySchema.safeParse(body)
		if (!parsed.success) {
			throw new HTTPException(400, { message: 'Invalid request body' })
		}
		const { puzzleId, gameSlug, guess } = parsed.data

		const config = getGameConfig(gameSlug)

		if (!config?.validateGuess) {
			throw new HTTPException(400, {
				message: `Game ${gameSlug} does not support guess validation`,
			})
		}

		const [puzzle] = await db
			.select()
			.from(dailyPuzzles)
			.where(eq(dailyPuzzles.id, puzzleId))
			.limit(1)

		if (!puzzle?.solution) {
			throw new HTTPException(404, { message: 'Puzzle not found' })
		}

		return c.json(config.validateGuess(puzzle.solution, guess))
	})

	// POST /save-result - authenticated + rate limited
	// NOTE: After saving, client should call Platform SDK recordStreakActivity() and submitScore()
	.post('/save-result', authRateLimitMiddleware, async (c) => {
		const body = await c.req.json()
		const parsed = SaveResultBodySchema.safeParse(body)
		if (!parsed.success) {
			throw new HTTPException(400, { message: 'Invalid request body' })
		}
		const input = parsed.data
		const user = c.get('user')

		const mode = input.mode

		if (!isValidGameSlug(input.gameSlug)) {
			throw new HTTPException(404, {
				message: `Game not found: ${input.gameSlug}`,
			})
		}

		const validationResult = await validateAndScoreSubmission(input)
		if (!validationResult.valid) {
			throw new HTTPException(400, {
				message: validationResult.error || 'Invalid game result',
			})
		}

		const validatedStatus = validationResult.status
		const serverScore = validationResult.score

		let puzzleDate: Date
		let archiveDate: Date | null = null

		if (mode === 'archive' && input.archiveDate) {
			puzzleDate = new Date(`${input.archiveDate}T00:00:00Z`)
			archiveDate = puzzleDate
		} else {
			puzzleDate = getTodayUTC()
		}

		// Map difficulty - 'expert' is treated as null for DB
		const difficulty =
			input.difficulty && input.difficulty !== 'expert'
				? (input.difficulty as 'easy' | 'medium' | 'hard')
				: undefined

		if (mode === 'daily' || mode === 'archive') {
			const conditions: ReturnType<typeof eq>[] = [
				eq(gameSessions.userId, user.id),
				eq(gameSessions.gameSlug, input.gameSlug),
				eq(gameSessions.mode, mode),
			]

			if (mode === 'archive' && archiveDate) {
				conditions.push(eq(gameSessions.archiveDate, archiveDate))
			} else {
				conditions.push(eq(gameSessions.puzzleDate, puzzleDate))
			}

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
				throw new HTTPException(409, {
					message: mode === 'daily' ? 'Already played today' : 'Already played this archive puzzle',
				})
			}
		}

		const session = await db.transaction(async (tx) => {
			if (mode === 'daily' || mode === 'archive') {
				const conditions: ReturnType<typeof eq>[] = [
					eq(gameSessions.userId, user.id),
					eq(gameSessions.gameSlug, input.gameSlug),
					eq(gameSessions.mode, mode),
				]

				if (mode === 'archive' && archiveDate) {
					conditions.push(eq(gameSessions.archiveDate, archiveDate))
				} else {
					conditions.push(eq(gameSessions.puzzleDate, puzzleDate))
				}

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
					throw new HTTPException(409, {
						message:
							mode === 'daily'
								? difficulty
									? `Already played ${difficulty} difficulty today`
									: 'Already played today'
								: 'Already played this archive puzzle',
					})
				}
			}

			const newSession: NewGameSession = {
				userId: user.id,
				gameSlug: input.gameSlug,
				puzzleId: input.puzzleId,
				puzzleDate,
				difficulty,
				mode,
				archiveDate,
				status: validatedStatus,
				score: serverScore,
				attempts: input.attempts,
				timeSpentMs: input.timeSpentMs,
				state: null,
				completedAt: new Date(),
			}

			const [newSessionResult] = await tx.insert(gameSessions).values(newSession).returning()

			return newSessionResult
		})

		// NOTE: Streak tracking and leaderboard updates are now handled by Platform SDK
		// Client should call:
		// - recordStreakActivity('puzzled-daily-play') after completing any game
		// - submitScore('puzzled-{gameSlug}-score', score) after winning
		// This ensures all engagement data is managed centrally by the Platform

		// Check if auto-freeze was used (for premium users with streak about to break)
		let usedFreeze = false
		if (mode === 'daily' && validatedStatus === 'lost') {
			usedFreeze = await tryAutoFreeze(user.id)
		}

		return c.json({
			success: true,
			session,
			mode,
			score: serverScore,
			usedFreeze,
		})
	})

	// GET /history - authenticated
	.get('/history', authMiddleware, async (c) => {
		const query = c.req.query()
		const parsed = HistoryQuerySchema.safeParse(query)
		if (!parsed.success) {
			throw new HTTPException(400, { message: 'Invalid query parameters' })
		}
		const { gameSlug, limit } = parsed.data
		const user = c.get('user')

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
			.where(and(eq(gameSessions.userId, user.id), eq(gameSessions.gameSlug, gameSlug)))
			.orderBy(desc(gameSessions.completedAt))
			.limit(limit)

		return c.json(history)
	})

	// GET /archive-dates - authenticated
	.get('/archive-dates', authMiddleware, async (c) => {
		const query = c.req.query()
		const parsed = ArchiveDatesQuerySchema.safeParse(query)
		if (!parsed.success) {
			throw new HTTPException(400, { message: 'Invalid query parameters' })
		}
		const { gameSlug, startDate, endDate } = parsed.data
		const user = c.get('user')

		const isPremium = await hasPremiumAccess(user.id)
		if (!isPremium) {
			throw new HTTPException(403, {
				message: 'Archive access requires premium subscription',
			})
		}

		if (!isValidGameSlug(gameSlug)) {
			throw new HTTPException(404, { message: `Unknown game: ${gameSlug}` })
		}

		const start = new Date(startDate)
		const end = new Date(endDate)
		const today = getTodayUTC()

		const playedSessions = await db
			.select({ archiveDate: gameSessions.archiveDate })
			.from(gameSessions)
			.where(
				and(
					eq(gameSessions.userId, user.id),
					eq(gameSessions.gameSlug, gameSlug),
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

		return c.json(result)
	})

export { gamesRoutes }
export type GamesRoutes = typeof gamesRoutes
