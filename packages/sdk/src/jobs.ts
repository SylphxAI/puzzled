/**
 * Jobs Functions
 *
 * Pure functions for background job scheduling.
 */

import { type SylphxConfig, callTrpc } from './config'

// ============================================================================
// Types
// ============================================================================

export interface JobInput {
	/** Job name/type */
	name: string
	/** Job payload */
	payload?: Record<string, unknown>
	/** Delay before executing (in seconds) */
	delay?: number
	/** Schedule for later (ISO timestamp) */
	runAt?: string
}

export interface JobResult {
	id: string
	name: string
	status: 'pending' | 'running' | 'completed' | 'failed'
	payload?: Record<string, unknown>
	result?: unknown
	error?: string
	createdAt: string
	startedAt?: string
	completedAt?: string
}

export interface CronInput {
	/** Job name */
	name: string
	/** Cron expression (e.g., '0 0 * * *' for daily at midnight) */
	schedule: string
	/** Job payload */
	payload?: Record<string, unknown>
	/** Timezone (e.g., 'America/New_York') */
	timezone?: string
}

export interface CronSchedule {
	id: string
	name: string
	schedule: string
	timezone: string
	payload?: Record<string, unknown>
	isPaused: boolean
	lastRunAt?: string
	nextRunAt?: string
}

// ============================================================================
// Functions
// ============================================================================

/**
 * Schedule a job for execution
 *
 * @example
 * ```typescript
 * const job = await scheduleJob(config, {
 *   name: 'send-email',
 *   payload: { to: 'user@example.com', template: 'welcome' },
 *   delay: 60, // Run in 60 seconds
 * })
 *
 * console.log(`Job scheduled: ${job.id}`)
 * ```
 */
export async function scheduleJob(config: SylphxConfig, input: JobInput): Promise<JobResult> {
	return callTrpc<JobInput, JobResult>(config, 'jobs.schedule', input, 'mutation')
}

/**
 * Get a job by ID
 *
 * @example
 * ```typescript
 * const job = await getJob(config, 'job-123')
 * console.log(job.status) // 'completed'
 * ```
 */
export async function getJob(config: SylphxConfig, jobId: string): Promise<JobResult> {
	return callTrpc<{ jobId: string }, JobResult>(config, 'jobs.get', { jobId }, 'query')
}

/**
 * Cancel a pending job
 *
 * @example
 * ```typescript
 * await cancelJob(config, 'job-123')
 * ```
 */
export async function cancelJob(config: SylphxConfig, jobId: string): Promise<boolean> {
	const result = await callTrpc<{ jobId: string }, { success: boolean }>(
		config,
		'jobs.cancel',
		{ jobId },
		'mutation'
	)
	return result.success
}

/**
 * List jobs
 *
 * @example
 * ```typescript
 * const jobs = await listJobs(config, { status: 'pending', limit: 10 })
 * ```
 */
export async function listJobs(
	config: SylphxConfig,
	options?: { status?: JobResult['status']; limit?: number; offset?: number }
): Promise<{ jobs: JobResult[]; total: number }> {
	return callTrpc(config, 'jobs.list', options ?? {}, 'query')
}

/**
 * Create a cron schedule
 *
 * @example
 * ```typescript
 * const cron = await createCron(config, {
 *   name: 'daily-report',
 *   schedule: '0 9 * * *', // Every day at 9am
 *   timezone: 'America/New_York',
 *   payload: { type: 'daily' },
 * })
 * ```
 */
export async function createCron(config: SylphxConfig, input: CronInput): Promise<CronSchedule> {
	return callTrpc<CronInput, CronSchedule>(config, 'jobs.createCron', input, 'mutation')
}

/**
 * Pause a cron schedule
 *
 * @example
 * ```typescript
 * await pauseCron(config, 'schedule-123')
 * ```
 */
export async function pauseCron(config: SylphxConfig, scheduleId: string): Promise<boolean> {
	const result = await callTrpc<{ scheduleId: string }, { success: boolean }>(
		config,
		'jobs.pauseCron',
		{ scheduleId },
		'mutation'
	)
	return result.success
}

/**
 * Resume a cron schedule
 *
 * @example
 * ```typescript
 * await resumeCron(config, 'schedule-123')
 * ```
 */
export async function resumeCron(config: SylphxConfig, scheduleId: string): Promise<boolean> {
	const result = await callTrpc<{ scheduleId: string }, { success: boolean }>(
		config,
		'jobs.resumeCron',
		{ scheduleId },
		'mutation'
	)
	return result.success
}

/**
 * Delete a cron schedule
 *
 * @example
 * ```typescript
 * await deleteCron(config, 'schedule-123')
 * ```
 */
export async function deleteCron(config: SylphxConfig, scheduleId: string): Promise<boolean> {
	const result = await callTrpc<{ scheduleId: string }, { success: boolean }>(
		config,
		'jobs.deleteCron',
		{ scheduleId },
		'mutation'
	)
	return result.success
}
