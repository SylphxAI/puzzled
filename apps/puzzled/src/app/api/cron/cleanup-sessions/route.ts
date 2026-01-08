import { lt } from 'drizzle-orm'
import { db } from '@/lib/db'
import { sessions } from '@/lib/db/schema'
import { captureError, captureMessage } from '@/lib/sentry'
import { cronError, cronSuccess, verifyCronAuth } from '@/lib/api/cron'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Cron job to clean up expired sessions from the database
 *
 * This prevents database bloat from accumulating expired session records
 * and ensures GDPR compliance by removing stale session data.
 *
 * Schedule: Run daily at 3 AM UTC (off-peak hours)
 */
export async function GET(request: Request) {
	const authError = verifyCronAuth(request, '[SessionCleanup]')
	if (authError) return authError

	console.log('[SessionCleanup] Starting expired session cleanup...')

	try {
		const now = new Date()

		// Delete all sessions that have expired
		const result = await db.delete(sessions).where(lt(sessions.expiresAt, now))

		const deletedCount = result.rowCount ?? 0

		console.log(`[SessionCleanup] Deleted ${deletedCount} expired sessions`)

		// Log to Sentry for monitoring if significant cleanup occurred
		if (deletedCount > 100) {
			captureMessage(`Session cleanup removed ${deletedCount} expired sessions`, 'info', {
				deleted_count: deletedCount,
				cleanup_time: now.toISOString(),
			})
		}

		return cronSuccess(`Cleaned up ${deletedCount} expired sessions`, { deletedCount })
	} catch (error) {
		console.error('[SessionCleanup] Error cleaning up sessions:', error)

		captureError(error instanceof Error ? error : new Error(String(error)), {
			level: 'error',
			tags: {
				category: 'auth',
				type: 'session_cleanup_error',
			},
		})

		return cronError('Failed to clean up sessions')
	}
}
