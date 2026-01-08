import { headers } from 'next/headers'
import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/features/auth/server'
import { isValidGameSlug } from '@/games/registry'
import { db } from '@/lib/db'
import { gameSessions } from '@/lib/db/schema'

const guestCompletedGameSchema = z.object({
	gameSlug: z.string().min(1).max(50),
	date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format'),
	status: z.enum(['won', 'lost']),
	attempts: z.number().int().min(1).max(100),
	score: z.number().int().min(0).max(10000).optional(),
	completedAt: z.string().datetime({ message: 'completedAt must be ISO datetime' }),
})

const migrateGuestDataSchema = z.object({
	games: z.array(guestCompletedGameSchema).max(100, 'Too many games to migrate'),
})

/**
 * POST /api/auth/migrate-guest-data
 * Migrates guest game completions from localStorage to the database
 * Called after successful signup to preserve guest progress
 */
export async function POST(request: NextRequest) {
	try {
		// Verify user is authenticated
		const session = await auth.api.getSession({ headers: await headers() })
		if (!session?.user) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		const userId = session.user.id

		// Parse and validate guest data from request body
		let body: unknown
		try {
			body = await request.json()
		} catch {
			return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
		}
		const parsed = migrateGuestDataSchema.safeParse(body)

		if (!parsed.success) {
			// Log validation errors for debugging but don't expose to client
			console.warn('[GuestMigration] Invalid data format:', parsed.error.issues)
			return NextResponse.json({ success: true, migrated: 0 })
		}

		const guestGames = parsed.data.games
		if (guestGames.length === 0) {
			return NextResponse.json({ success: true, migrated: 0 })
		}

		let migratedCount = 0
		const errors: string[] = []

		// Migrate each guest game session
		for (const guestGame of guestGames) {
			try {
				// Validate game exists in registry (SSOT)
				if (!isValidGameSlug(guestGame.gameSlug)) {
					errors.push(`Unknown game: ${guestGame.gameSlug}`)
					continue
				}

				// Parse puzzle date from the date string
				const puzzleDate = new Date(`${guestGame.date}T00:00:00Z`)

				// Check if user already has a session for this game/date (avoid duplicates)
				const existingSession = await db.query.gameSessions.findFirst({
					where: (sessions, { and, eq: eqOp }) =>
						and(
							eqOp(sessions.userId, userId),
							eqOp(sessions.gameSlug, guestGame.gameSlug),
							eqOp(sessions.puzzleDate, puzzleDate),
							eqOp(sessions.mode, 'daily'),
						),
				})

				if (existingSession) {
					// Already has a session for this game/date, skip
					continue
				}

				// Create game session from guest data
				await db.insert(gameSessions).values({
					userId,
					gameSlug: guestGame.gameSlug,
					puzzleDate,
					mode: 'daily',
					status: guestGame.status,
					attempts: guestGame.attempts,
					score: guestGame.score ?? null,
					startedAt: new Date(guestGame.completedAt),
					completedAt: new Date(guestGame.completedAt),
				})

				migratedCount++
			} catch (err) {
				console.error(`[GuestMigration] Error migrating game ${guestGame.gameSlug}:`, err)
				errors.push(`Failed to migrate ${guestGame.gameSlug} from ${guestGame.date}`)
			}
		}

		console.log(
			`[GuestMigration] Migrated ${migratedCount}/${guestGames.length} games for user ${userId}`,
		)

		return NextResponse.json({
			success: true,
			migrated: migratedCount,
			total: guestGames.length,
			errors: errors.length > 0 ? errors : undefined,
		})
	} catch (error) {
		console.error('[GuestMigration] Error:', error)
		return NextResponse.json({ error: 'Migration failed' }, { status: 500 })
	}
}
