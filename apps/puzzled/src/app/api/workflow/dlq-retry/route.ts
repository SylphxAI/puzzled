/**
 * DLQ Retry Scheduler
 *
 * Per spec: Dead-letter handling must include automatic retry with exponential backoff.
 * This workflow processes pending DLQ items that are ready for retry based on backoff timing.
 *
 * Scheduled via QStash cron: Run every 5 minutes
 * QStash Schedule: https://console.upstash.com/qstash
 * Endpoint: /api/workflow/dlq-retry
 * Cron: "0/5 * * * *" (every 5 minutes)
 */

import { Client } from '@upstash/qstash'
import { serve } from '@upstash/workflow/nextjs'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { deadLetterQueue } from '@/lib/db/schema'
import { getItemsReadyForRetry, markDLQFailed, markDLQRetrying } from '@/lib/dlq'
import { getServerBaseUrl } from '@/lib/utils'

export const runtime = 'nodejs'

/**
 * Workflow endpoint registry
 */
const WORKFLOW_ENDPOINTS: Record<string, string> = {
	'daily-reminder': '/api/workflow/daily-reminder',
	'generate-puzzles': '/api/workflow/generate-puzzles',
}

export const { POST } = serve(
	async (context) => {
		// Step 1: Get items ready for retry
		const itemsToRetry = await context.run('get-ready-items', async () => {
			return getItemsReadyForRetry()
		})

		if (itemsToRetry.length === 0) {
			await context.run('log-no-items', () => {
				console.log('[DLQ Scheduler] No items ready for retry')
			})
			return
		}

		await context.run('log-items', () => {
			console.log(`[DLQ Scheduler] Found ${itemsToRetry.length} items ready for retry`)
		})

		// Step 2: Process each item
		const qstashToken = process.env.QSTASH_TOKEN
		if (!qstashToken) {
			await context.run('log-error', () => {
				console.error('[DLQ Scheduler] QSTASH_TOKEN not configured')
			})
			return
		}

		const qstash = new Client({ token: qstashToken })
		const baseUrl = getServerBaseUrl()

		for (const item of itemsToRetry) {
			await context.run(`process-${item.id}`, async () => {
				// Check if max retries exceeded
				if (item.retryCount >= item.maxRetries) {
					console.log(`[DLQ Scheduler] Item ${item.id} exceeded max retries, marking as failed`)
					await markDLQFailed(item.id)
					return
				}

				// Check if we have a handler for this workflow
				const endpoint = WORKFLOW_ENDPOINTS[item.workflowName]
				if (!endpoint) {
					console.error(`[DLQ Scheduler] Unknown workflow: ${item.workflowName}`)
					// Don't fail - leave for manual intervention
					return
				}

				try {
					// Mark as retrying
					await markDLQRetrying(item.id)

					// Trigger the workflow
					const workflowUrl = `${baseUrl}${endpoint}`
					const payload = (item.payload as Record<string, unknown>) || {}

					await qstash.publishJSON({
						url: workflowUrl,
						body: payload,
						headers: {
							'x-dlq-retry': 'true',
							'x-dlq-item-id': item.id,
							'x-dlq-retry-count': String(item.retryCount + 1),
						},
					})

					// Update metadata to track automatic retry
					await db
						.update(deadLetterQueue)
						.set({
							status: 'pending', // Will be updated by workflow result
							metadata: {
								...((item.metadata as Record<string, unknown>) || {}),
								lastAutoRetryAt: new Date().toISOString(),
								autoRetryCount:
									(((item.metadata as Record<string, unknown>)?.autoRetryCount as number) || 0) + 1,
							},
						})
						.where(eq(deadLetterQueue.id, item.id))

					console.log(`[DLQ Scheduler] Triggered retry for ${item.workflowName} (${item.id})`)
				} catch (error) {
					console.error(`[DLQ Scheduler] Failed to trigger retry for ${item.id}:`, error)
					// Reset to pending - will be retried on next schedule
					await db
						.update(deadLetterQueue)
						.set({ status: 'pending' })
						.where(eq(deadLetterQueue.id, item.id))
				}
			})
		}

		await context.run('log-complete', () => {
			console.log(`[DLQ Scheduler] Completed processing ${itemsToRetry.length} items`)
		})
	},
	{
		retries: 1, // Minimal retries for the scheduler itself
	},
)
