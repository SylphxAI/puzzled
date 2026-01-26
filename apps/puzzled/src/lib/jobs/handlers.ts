/**
 * Job Handlers
 *
 * Direct function exports for job execution.
 * Used by the Platform Jobs webhook handler to execute jobs synchronously
 * without making additional HTTP calls.
 *
 * This reduces the 3-hop architecture (Platform → QStash → App webhook → internal HTTP)
 * to 2 hops (Platform → QStash → App webhook → direct execution).
 */

import 'server-only'

// ==========================================
// Handler Types
// ==========================================

export interface JobResult {
	success: boolean
	data?: unknown
	error?: string
}

export type JobHandler = (
	payload: Record<string, unknown>,
	context: JobContext,
) => Promise<JobResult>

export interface JobContext {
	jobId?: string
	cronName: string
	timestamp: Date
}

// ==========================================
// Handler Registry
// ==========================================

/**
 * Registry of job handlers.
 * Import handlers lazily to avoid loading all dependencies on every request.
 */
export const JOB_HANDLERS: Record<string, () => Promise<JobHandler>> = {
	// Puzzle generation - daily at 23:00 UTC
	'generate-daily-puzzles': () =>
		import('./handlers/generate-puzzles').then((m) => m.generatePuzzlesHandler),

	// DLQ retry - hourly
	'dlq-retry': () =>
		import('./handlers/dlq-retry').then((m) => m.dlqRetryHandler),

	// Notification jobs - send push/email notifications via Platform SDK
	'daily-reminder': () =>
		import('./handlers/notifications').then((m) => m.dailyReminderHandler),

	'streak-at-risk': () =>
		import('./handlers/notifications').then((m) => m.streakAtRiskHandler),

	'win-back-emails': () =>
		import('./handlers/notifications').then((m) => m.winBackEmailsHandler),
}

// ==========================================
// Executor
// ==========================================

/**
 * Execute a job handler directly
 */
export async function executeJob(
	cronName: string,
	payload: Record<string, unknown>,
	context: Omit<JobContext, 'cronName'>,
): Promise<JobResult> {
	const handlerFactory = JOB_HANDLERS[cronName]
	if (!handlerFactory) {
		return {
			success: false,
			error: `Unknown job: ${cronName}`,
		}
	}

	try {
		const handler = await handlerFactory()
		return await handler(payload, { ...context, cronName })
	} catch (error) {
		console.error(`[JobExecutor] Failed to execute ${cronName}:`, error)
		return {
			success: false,
			error: error instanceof Error ? error.message : String(error),
		}
	}
}
