/**
 * Jobs Functions
 *
 * Pure functions for background job scheduling.
 *
 * ## Industry-Standard Features
 * - **Idempotency Keys**: Stripe/Inngest pattern for safe retries
 * - **Automatic Retries**: Configurable retry count with exponential backoff
 * - **Cron Scheduling**: Recurring jobs with pause/resume support
 *
 * Types are derived from the OpenAPI spec (generated/api.d.ts).
 * Run `bun run generate:types:local` to regenerate after API changes.
 */

import { type SylphxConfig, callApi } from './config'
import type { components } from './generated/api'

// ============================================================================
// Types (re-exported from generated OpenAPI spec)
// ============================================================================

export type ScheduleJobRequest = components['schemas']['ScheduleJobRequest']
export type ScheduleJobResponse = components['schemas']['ScheduleJobResponse']
export type ScheduleCronRequest = components['schemas']['ScheduleCronRequest']
export type ScheduleCronResponse = components['schemas']['ScheduleCronResponse']
export type Job = components['schemas']['Job']
export type ListJobsResponse = components['schemas']['ListJobsResponse']

// SDK-specific types for convenience
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
	/**
	 * Idempotency key for safe retries (Stripe/Inngest pattern).
	 *
	 * When provided, prevents duplicate job execution if the same
	 * key is used within a 24-hour window. Useful for:
	 * - Network retry safety
	 * - At-most-once delivery guarantee
	 * - Webhook deduplication
	 *
	 * @example
	 * ```typescript
	 * // Use a unique key derived from the operation
	 * await scheduleJob(config, {
	 *   callbackUrl: 'https://myapp.com/api/jobs/send-email',
	 *   payload: { userId: 'user-123', template: 'welcome' },
	 *   idempotencyKey: `welcome-email-user-123-${Date.now()}`,
	 * })
	 * ```
	 */
	idempotencyKey?: string
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
	/**
	 * Idempotency key for safe cron creation (Stripe/Inngest pattern).
	 *
	 * When provided, prevents duplicate cron schedule creation if
	 * the same key is used. Useful for deployment scripts that
	 * may run multiple times.
	 *
	 * @example
	 * ```typescript
	 * await createCron(config, {
	 *   callbackUrl: 'https://myapp.com/api/jobs/daily-report',
	 *   cron: '0 9 * * *',
	 *   name: 'daily-report',
	 *   idempotencyKey: 'daily-report-cron-v1', // Same key = same cron
	 * })
	 * ```
	 */
	idempotencyKey?: string
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
