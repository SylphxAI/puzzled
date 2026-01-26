/**
 * Register Cron Jobs with Platform SDK
 *
 * This utility registers all Puzzled cron jobs with the Sylphx Platform.
 * Platform handles scheduling via QStash and calls our webhook endpoint.
 *
 * Run this:
 * - Once on initial deployment
 * - When cron schedules change
 * - Via: bun run register-crons
 *
 * The webhook endpoint `/api/webhooks/platform-jobs` receives callbacks
 * and routes to the appropriate job handler.
 */

import { type CronSchedule, createCron, deleteCron } from '@sylphx/sdk'
import { getSdkConfig } from '@/lib/sdk-server'

// ==========================================
// Cron Job Definitions
// ==========================================

interface CronJobDefinition {
	/** Unique job name */
	name: string
	/** Cron expression (UTC) */
	cron: string
	/** Description for logging */
	description: string
	/** Optional payload to send */
	payload?: Record<string, unknown>
}

/**
 * All cron jobs for Puzzled app
 *
 * Times are in UTC:
 * - 23:00 UTC = Generate puzzles for next day
 * - 08:00 UTC = Morning notification blast
 * - 10:00 UTC = Win-back emails
 * - 18:00 UTC = Evening streak reminder
 * - Hourly = DLQ retry
 */
export const CRON_JOBS: CronJobDefinition[] = [
	{
		name: 'generate-daily-puzzles',
		cron: '0 23 * * *',
		description: 'Generate daily puzzles at 23:00 UTC',
	},
	{
		name: 'daily-reminder',
		cron: '0 8 * * *',
		description: 'Daily reminder notifications at 08:00 UTC',
	},
	{
		name: 'streak-at-risk',
		cron: '0 18 * * *',
		description: 'Streak-at-risk reminders at 18:00 UTC',
	},
	{
		name: 'win-back-emails',
		cron: '0 10 * * *',
		description: 'Win-back email campaign at 10:00 UTC',
	},
	{
		name: 'dlq-retry',
		cron: '0 * * * *',
		description: 'DLQ retry hourly',
	},
]

// ==========================================
// Registration Functions
// ==========================================

/**
 * Get the webhook callback URL for this environment
 */
function getCallbackUrl(): string {
	// Use environment-specific base URL
	const baseUrl = process.env.VERCEL_URL
		? `https://${process.env.VERCEL_URL}`
		: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

	return `${baseUrl}/api/webhooks/platform-jobs`
}

/**
 * Register a single cron job with Platform
 */
async function registerCronJob(job: CronJobDefinition): Promise<CronSchedule | null> {
	const config = getSdkConfig()
	const callbackUrl = getCallbackUrl()

	try {
		const result = await createCron(config, {
			callbackUrl,
			cron: job.cron,
			name: job.name,
			payload: job.payload,
			method: 'POST',
			retries: 3,
		})

		console.log(`✅ Registered: ${job.name} (${job.cron}) → ${result.scheduleId}`)
		return result
	} catch (error) {
		console.error(`❌ Failed to register ${job.name}:`, error)
		return null
	}
}

/**
 * Register all cron jobs with Platform
 *
 * This is idempotent - can be called multiple times safely.
 * Existing schedules with the same name will be replaced.
 */
export async function registerAllCronJobs(): Promise<{
	success: boolean
	registered: string[]
	failed: string[]
}> {
	console.log('🔄 Registering cron jobs with Platform...')
	console.log(`📍 Callback URL: ${getCallbackUrl()}`)
	console.log('')

	const registered: string[] = []
	const failed: string[] = []

	for (const job of CRON_JOBS) {
		const result = await registerCronJob(job)
		if (result) {
			registered.push(job.name)
		} else {
			failed.push(job.name)
		}
	}

	console.log('')
	console.log('📊 Summary:')
	console.log(`   Registered: ${registered.length}`)
	console.log(`   Failed: ${failed.length}`)

	return {
		success: failed.length === 0,
		registered,
		failed,
	}
}

/**
 * Delete a cron schedule by ID
 */
export async function deleteCronSchedule(scheduleId: string): Promise<boolean> {
	const config = getSdkConfig()

	try {
		await deleteCron(config, scheduleId)
		console.log(`🗑️ Deleted schedule: ${scheduleId}`)
		return true
	} catch (error) {
		console.error(`❌ Failed to delete ${scheduleId}:`, error)
		return false
	}
}

// ==========================================
// CLI Entry Point
// ==========================================

// Run if executed directly
if (require.main === module || process.argv[1]?.endsWith('register-crons.ts')) {
	registerAllCronJobs()
		.then((result) => {
			process.exit(result.success ? 0 : 1)
		})
		.catch((error) => {
			console.error('Fatal error:', error)
			process.exit(1)
		})
}
