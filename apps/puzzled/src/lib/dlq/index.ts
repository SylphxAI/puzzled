/**
 * Dead Letter Queue (DLQ) Utility
 *
 * Per spec: Workflows must have dead-letter handling for failures that
 * persist after retries. This module provides:
 * - Storage of failed workflow executions
 * - Retry tracking with exponential backoff
 * - Admin interface for reviewing/retrying failed jobs
 */

import { and, eq, lte } from 'drizzle-orm'
import { HOUR_MS, MINUTE_MS } from '@/lib/constants/time'
import { db } from '@/lib/db'
import { deadLetterQueue } from '@/lib/db/schema'
import { captureMessage } from '@/lib/monitoring'

type DLQEntry = {
	workflowName: string
	workflowRunId?: string | null
	payload?: Record<string, unknown>
	error: string
	errorStack?: string
	metadata?: Record<string, unknown>
	maxRetries?: number
}

/**
 * Add a failed workflow execution to the dead letter queue
 */
async function addToDLQ(entry: DLQEntry): Promise<string> {
	const [inserted] = await db
		.insert(deadLetterQueue)
		.values({
			workflowName: entry.workflowName,
			workflowRunId: entry.workflowRunId ?? null,
			payload: entry.payload ?? {},
			error: entry.error,
			errorStack: entry.errorStack ?? null,
			metadata: entry.metadata ?? {},
			maxRetries: entry.maxRetries ?? 3,
		})
		.returning({ id: deadLetterQueue.id })

	// Also report to platform monitoring for visibility
	captureMessage(`Workflow added to DLQ: ${entry.workflowName}`, {
		level: 'error',
		tags: {
			workflow: entry.workflowName,
			dlq_entry_id: inserted.id,
		},
		extra: {
			payload: entry.payload,
			error: entry.error,
		},
	})

	console.error(`[DLQ] Added to dead letter queue: ${entry.workflowName}`, {
		id: inserted.id,
		error: entry.error,
	})

	return inserted.id
}

/**
 * Get pending items in the DLQ for a specific workflow (or all)
 */
async function getDLQItems(workflowName?: string) {
	if (workflowName) {
		return db.query.deadLetterQueue.findMany({
			where: and(
				eq(deadLetterQueue.workflowName, workflowName),
				eq(deadLetterQueue.status, 'pending'),
			),
			orderBy: (dlq, { desc }) => [desc(dlq.createdAt)],
		})
	}

	return db.query.deadLetterQueue.findMany({
		where: eq(deadLetterQueue.status, 'pending'),
		orderBy: (dlq, { desc }) => [desc(dlq.createdAt)],
	})
}

/**
 * Get all DLQ items with filtering
 */
export async function getAllDLQItems(
	options: {
		workflowName?: string
		status?: 'pending' | 'retrying' | 'resolved' | 'failed'
		limit?: number
		offset?: number
	} = {},
) {
	const { workflowName, status, limit = 50, offset = 0 } = options

	const conditions = []
	if (workflowName) conditions.push(eq(deadLetterQueue.workflowName, workflowName))
	if (status) conditions.push(eq(deadLetterQueue.status, status))

	return db.query.deadLetterQueue.findMany({
		where: conditions.length > 0 ? and(...conditions) : undefined,
		orderBy: (dlq, { desc }) => [desc(dlq.createdAt)],
		limit,
		offset,
	})
}

/**
 * Mark DLQ item as retrying
 */
export async function markDLQRetrying(id: string): Promise<void> {
	// First get current item to increment retry count
	const item = await db.query.deadLetterQueue.findFirst({
		where: eq(deadLetterQueue.id, id),
	})

	if (!item) return

	await db
		.update(deadLetterQueue)
		.set({
			status: 'retrying',
			lastRetryAt: new Date(),
			retryCount: item.retryCount + 1,
		})
		.where(eq(deadLetterQueue.id, id))
}

/**
 * Increment retry count and update last retry time
 */
async function incrementDLQRetry(id: string): Promise<number> {
	// First get current item to increment retry count
	const item = await db.query.deadLetterQueue.findFirst({
		where: eq(deadLetterQueue.id, id),
	})

	if (!item) return 0

	const newRetryCount = item.retryCount + 1

	await db
		.update(deadLetterQueue)
		.set({
			retryCount: newRetryCount,
			lastRetryAt: new Date(),
		})
		.where(eq(deadLetterQueue.id, id))

	return newRetryCount
}

/**
 * Mark DLQ item as resolved (successful retry)
 */
export async function markDLQResolved(id: string): Promise<void> {
	await db
		.update(deadLetterQueue)
		.set({
			status: 'resolved',
			resolvedAt: new Date(),
		})
		.where(eq(deadLetterQueue.id, id))

	console.log(`[DLQ] Marked as resolved: ${id}`)
}

/**
 * Mark DLQ item as permanently failed
 */
export async function markDLQFailed(id: string): Promise<void> {
	await db.update(deadLetterQueue).set({ status: 'failed' }).where(eq(deadLetterQueue.id, id))

	// Report permanent failure to platform monitoring
	captureMessage(`DLQ item permanently failed: ${id}`, {
		level: 'fatal',
		tags: { dlq_entry_id: id },
	})

	console.error(`[DLQ] Marked as permanently failed: ${id}`)
}

/**
 * Calculate exponential backoff delay in milliseconds
 * Base: 1 minute, max: 1 hour
 */
export function calculateBackoffDelay(retryCount: number): number {
	const baseDelay = MINUTE_MS
	const maxDelay = HOUR_MS
	const delay = Math.min(baseDelay * 2 ** retryCount, maxDelay)
	// Add jitter (0-10% of delay)
	const jitter = delay * Math.random() * 0.1
	return Math.floor(delay + jitter)
}

/**
 * Check if a DLQ item is ready for retry based on exponential backoff
 */
export async function getItemsReadyForRetry(): Promise<(typeof deadLetterQueue.$inferSelect)[]> {
	const now = new Date()

	// Get all pending items
	const pending = await db.query.deadLetterQueue.findMany({
		where: and(
			eq(deadLetterQueue.status, 'pending'),
			lte(deadLetterQueue.retryCount, deadLetterQueue.maxRetries),
		),
	})

	// Filter by backoff timing
	return pending.filter((item) => {
		if (!item.lastRetryAt) return true // Never retried, ready immediately

		const backoffMs = calculateBackoffDelay(item.retryCount)
		const nextRetryTime = new Date(item.lastRetryAt.getTime() + backoffMs)
		return now >= nextRetryTime
	})
}

/**
 * Get DLQ statistics
 */
export async function getDLQStats() {
	const all = await db.query.deadLetterQueue.findMany()

	const stats = {
		total: all.length,
		pending: all.filter((i) => i.status === 'pending').length,
		retrying: all.filter((i) => i.status === 'retrying').length,
		resolved: all.filter((i) => i.status === 'resolved').length,
		failed: all.filter((i) => i.status === 'failed').length,
		byWorkflow: {} as Record<string, number>,
	}

	for (const item of all) {
		stats.byWorkflow[item.workflowName] = (stats.byWorkflow[item.workflowName] || 0) + 1
	}

	return stats
}

/**
 * Helper for workflow failureFunction handlers
 * Per spec: All workflows must use DLQ for failure handling
 */
export async function handleWorkflowFailure(
	workflowName: string,
	payload: Record<string, unknown>,
	failResponse: unknown,
	workflowRunId?: string,
): Promise<string> {
	const error = failResponse instanceof Error ? failResponse.message : String(failResponse)
	const errorStack = failResponse instanceof Error ? failResponse.stack : undefined

	return addToDLQ({
		workflowName,
		workflowRunId,
		payload,
		error,
		errorStack,
		metadata: {
			failedAt: new Date().toISOString(),
		},
	})
}
