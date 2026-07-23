/**
 * ADR-169 residual: internal/job residual path; platform webhook uses lib/jobs handlers directly.
 */

/**
 * DLQ Retry Processor
 *
 * Per spec: Dead-letter handling must include automatic retry with exponential backoff.
 * This job processes pending DLQ items that are ready for retry based on backoff timing.
 *
 * Triggered via Vercel Cron or manual call.
 */

import { eq } from 'drizzle-orm'
import { type NextRequest, NextResponse } from 'next/server'
import { verifyCronAuth } from '@/lib/api/cron'
import { db } from '@/lib/db'
import { deadLetterQueue } from '@/lib/db/schema'
import { getItemsReadyForRetry, markDLQFailed, markDLQRetrying } from '@/lib/dlq'
import { getServerBaseUrl } from '@/lib/utils'

export const runtime = 'nodejs'

/**
 * Job endpoint registry - maps workflow names to their job endpoints
 */
const JOB_ENDPOINTS: Record<string, string> = {
	'daily-reminder': '/api/jobs/daily-reminder',
	'generate-puzzles': '/api/jobs/generate-puzzles',
}

/**
 * POST /api/jobs/dlq-retry
 *
 * Processes DLQ items ready for retry based on exponential backoff.
 */
export async function POST(request: NextRequest) {
	// Auth check - allow cron auth or internal calls
	const authError = verifyCronAuth(request, '[DLQ]')
	const isInternalCall = request.headers.get('x-internal-call') === 'true'

	if (authError && !isInternalCall) {
		return authError
	}

	// Get items ready for retry
	const itemsToRetry = await getItemsReadyForRetry()

	if (itemsToRetry.length === 0) {
		console.log('[DLQ Scheduler] No items ready for retry')
		return NextResponse.json({
			processed: 0,
			message: 'No items ready for retry',
		})
	}

	console.log(`[DLQ Scheduler] Found ${itemsToRetry.length} items ready for retry`)

	const baseUrl = getServerBaseUrl()
	const results: Array<{
		id: string
		status: 'retried' | 'failed' | 'skipped'
	}> = []

	for (const item of itemsToRetry) {
		// Check if max retries exceeded
		if (item.retryCount >= item.maxRetries) {
			console.log(`[DLQ Scheduler] Item ${item.id} exceeded max retries, marking as failed`)
			await markDLQFailed(item.id)
			results.push({ id: item.id, status: 'failed' })
			continue
		}

		// Check if we have a handler for this workflow
		const endpoint = JOB_ENDPOINTS[item.workflowName]
		if (!endpoint) {
			console.error(`[DLQ Scheduler] Unknown workflow: ${item.workflowName}`)
			results.push({ id: item.id, status: 'skipped' })
			continue
		}

		try {
			// Mark as retrying
			await markDLQRetrying(item.id)

			// Trigger the job endpoint directly
			const jobUrl = `${baseUrl}${endpoint}`
			const payload = (item.payload as Record<string, unknown>) || {}

			// Fire-and-forget - don't await the job
			fetch(jobUrl, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'x-internal-call': 'true',
					'x-dlq-retry': 'true',
					'x-dlq-item-id': item.id,
					'x-dlq-retry-count': String(item.retryCount + 1),
				},
				body: JSON.stringify(payload),
			}).catch((error) => {
				console.error(`[DLQ Scheduler] Failed to trigger retry for ${item.id}:`, error)
			})

			// Update metadata to track automatic retry
			await db
				.update(deadLetterQueue)
				.set({
					status: 'pending', // Will be updated by job result
					metadata: {
						...((item.metadata as Record<string, unknown>) || {}),
						lastAutoRetryAt: new Date().toISOString(),
						autoRetryCount:
							(((item.metadata as Record<string, unknown>)?.autoRetryCount as number) || 0) + 1,
					},
				})
				.where(eq(deadLetterQueue.id, item.id))

			console.log(`[DLQ Scheduler] Triggered retry for ${item.workflowName} (${item.id})`)
			results.push({ id: item.id, status: 'retried' })
		} catch (error) {
			console.error(`[DLQ Scheduler] Failed to process item ${item.id}:`, error)
			// Reset to pending - will be retried on next schedule
			await db
				.update(deadLetterQueue)
				.set({ status: 'pending' })
				.where(eq(deadLetterQueue.id, item.id))
			results.push({ id: item.id, status: 'skipped' })
		}
	}

	const summary = {
		processed: results.length,
		retried: results.filter((r) => r.status === 'retried').length,
		failed: results.filter((r) => r.status === 'failed').length,
		skipped: results.filter((r) => r.status === 'skipped').length,
	}

	console.log(`[DLQ Scheduler] Completed: ${JSON.stringify(summary)}`)

	return NextResponse.json(summary)
}
