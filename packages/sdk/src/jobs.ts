/**
 * Jobs Functions
 *
 * Pure functions for background job scheduling.
 */

import { type SylphxConfig, callApi } from './config'

// ============================================================================
// Types
// ============================================================================

export interface JobInput {
	/** Callback URL to call when job executes */
	callbackUrl: string
	/** Job name/type */
	name?: string
	/** Job type for categorization */
	type?: string
	/** Job payload sent to callback */
	payload?: Record<string, unknown>
	/** HTTP method for callback (default: POST) */
	method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
	/** Additional headers for callback */
	headers?: Record<string, string>
	/** Delay before executing (in seconds, max 604800 = 7 days) */
	delay?: number
	/** Schedule for later (ISO timestamp) */
	scheduledFor?: string
	/** Number of retries on failure (0-5, default: 3) */
	retries?: number
	/** Request timeout in seconds (1-300, default: 30) */
	timeout?: number
}

export interface JobResult {
	/** Job ID */
	jobId: string
	/** QStash message ID */
	messageId?: string
	/** Scheduled execution time */
	scheduledFor?: string
}

export interface JobStatus {
	id: string
	name?: string
	status: 'pending' | 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'
	payload?: Record<string, unknown>
	result?: unknown
	error?: string
	createdAt: string
	queuedAt?: string
	startedAt?: string
	completedAt?: string
}

export interface CronInput {
	/** Callback URL to call on each cron trigger */
	callbackUrl: string
	/** Cron expression (e.g., '0 0 * * *' for daily at midnight) */
	cron: string
	/** Job name (required, max 200 chars) */
	name: string
	/** Job type for categorization */
	type?: string
	/** Job payload sent to callback */
	payload?: Record<string, unknown>
	/** HTTP method for callback (default: POST) */
	method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
	/** Additional headers for callback */
	headers?: Record<string, string>
	/** Number of retries on failure (0-5, default: 3) */
	retries?: number
	/** Start in paused state */
	paused?: boolean
}

export interface CronSchedule {
	/** Internal job ID */
	jobId?: string
	/** QStash schedule ID */
	scheduleId: string
	/** Cron expression */
	cron: string
	/** Whether currently paused */
	paused: boolean
}

// ============================================================================
// Functions
// ============================================================================

/**
 * Schedule a one-time job for execution
 *
 * @example
 * ```typescript
 * const job = await scheduleJob(config, {
 *   callbackUrl: 'https://myapp.com/api/jobs/send-email',
 *   name: 'send-email',
 *   payload: { to: 'user@example.com', template: 'welcome' },
 *   delay: 60, // Run in 60 seconds
 * })
 *
 * console.log(`Job scheduled: ${job.jobId}`)
 * ```
 */
export async function scheduleJob(config: SylphxConfig, input: JobInput): Promise<JobResult> {
	return callApi<JobResult>(config, '/jobs/schedule', { method: 'POST', body: input })
}

/**
 * Get a job's status by ID
 *
 * @example
 * ```typescript
 * const job = await getJob(config, 'job-123')
 * console.log(job.status) // 'completed'
 * ```
 */
export async function getJob(config: SylphxConfig, jobId: string): Promise<JobStatus> {
	return callApi<JobStatus>(config, `/jobs/${jobId}`, { method: 'GET' })
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
	const result = await callApi<{ success: boolean }>(config, `/jobs/${jobId}/cancel`, {
		method: 'POST',
	})
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
	options?: { status?: JobStatus['status']; limit?: number; offset?: number }
): Promise<{ jobs: JobStatus[]; total: number }> {
	return callApi(config, '/jobs', {
		method: 'GET',
		query: options as Record<string, string | number | undefined>,
	})
}

/**
 * Create a recurring cron job
 *
 * @example
 * ```typescript
 * const cron = await createCron(config, {
 *   callbackUrl: 'https://myapp.com/api/webhooks/platform-jobs',
 *   cron: '0 9 * * *', // Every day at 9am UTC
 *   name: 'daily-report',
 *   payload: { type: 'daily' },
 * })
 *
 * console.log(`Cron created: ${cron.scheduleId}`)
 * ```
 */
export async function createCron(config: SylphxConfig, input: CronInput): Promise<CronSchedule> {
	return callApi<CronSchedule>(config, '/jobs/cron', { method: 'POST', body: input })
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
	const result = await callApi<{ success: boolean }>(config, `/jobs/cron/${scheduleId}/pause`, {
		method: 'POST',
	})
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
	const result = await callApi<{ success: boolean }>(config, `/jobs/cron/${scheduleId}/resume`, {
		method: 'POST',
	})
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
	const result = await callApi<{ success: boolean }>(config, `/jobs/cron/${scheduleId}`, {
		method: 'DELETE',
	})
	return result.success
}
