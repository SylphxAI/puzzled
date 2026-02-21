/**
 * DLQ Retry Job Handler
 *
 * Direct execution handler for DLQ retry processing.
 * Extracted from /api/jobs/dlq-retry/route.ts for sync execution.
 */

import { db } from "@/lib/db";
import { deadLetterQueue } from "@/lib/db/schema";
import {
	getItemsReadyForRetry,
	markDLQFailed,
	markDLQRetrying,
} from "@/lib/dlq";
import { eq } from "drizzle-orm";
import type { JobHandler } from "../handlers";

/**
 * DLQ retry handler
 *
 * Note: This handler still uses fire-and-forget for the actual job retries
 * because we need to track each retry independently. The webhook itself
 * is now synchronous.
 */
export const dlqRetryHandler: JobHandler = async (_payload, context) => {
	const items = await getItemsReadyForRetry();

	if (items.length === 0) {
		console.log("[DLQ Scheduler] No items ready for retry");
		return {
			success: true,
			data: { processed: 0, message: "No items ready for retry" },
		};
	}

	console.log(
		`[DLQ Scheduler] Found ${items.length} items ready for retry (jobId: ${context.jobId})`,
	);

	const results: Array<{
		id: string;
		status: "retried" | "failed" | "skipped";
	}> = [];

	// Import job handlers dynamically to avoid circular deps
	const { executeJob } = await import("../handlers");

	for (const item of items) {
		// Check if max retries exceeded
		if (item.retryCount >= item.maxRetries) {
			console.log(
				`[DLQ Scheduler] Item ${item.id} exceeded max retries, marking as failed`,
			);
			await markDLQFailed(item.id);
			results.push({ id: item.id, status: "failed" });
			continue;
		}

		// Map workflow names to cron names
		const cronNameMap: Record<string, string> = {
			"daily-reminder": "daily-reminder",
			"generate-puzzles": "generate-daily-puzzles",
		};

		const cronName = cronNameMap[item.workflowName];
		if (!cronName) {
			console.error(`[DLQ Scheduler] Unknown workflow: ${item.workflowName}`);
			results.push({ id: item.id, status: "skipped" });
			continue;
		}

		try {
			// Mark as retrying
			await markDLQRetrying(item.id);

			// Execute job directly (no HTTP call)
			const payload = (item.payload as Record<string, unknown>) || {};
			const result = await executeJob(cronName, payload, {
				jobId: `dlq-retry-${item.id}`,
				timestamp: new Date(),
			});

			// Update metadata to track retry
			await db
				.update(deadLetterQueue)
				.set({
					status: result.success ? "resolved" : "pending",
					metadata: {
						...((item.metadata as Record<string, unknown>) || {}),
						lastAutoRetryAt: new Date().toISOString(),
						lastRetryResult: result,
						autoRetryCount:
							(((item.metadata as Record<string, unknown>)
								?.autoRetryCount as number) || 0) + 1,
					},
				})
				.where(eq(deadLetterQueue.id, item.id));

			console.log(
				`[DLQ Scheduler] Retry ${result.success ? "succeeded" : "failed"} for ${item.workflowName} (${item.id})`,
			);
			results.push({ id: item.id, status: "retried" });
		} catch (error) {
			console.error(
				`[DLQ Scheduler] Failed to process item ${item.id}:`,
				error,
			);
			await db
				.update(deadLetterQueue)
				.set({ status: "pending" })
				.where(eq(deadLetterQueue.id, item.id));
			results.push({ id: item.id, status: "skipped" });
		}
	}

	const summary = {
		processed: results.length,
		retried: results.filter((r) => r.status === "retried").length,
		failed: results.filter((r) => r.status === "failed").length,
		skipped: results.filter((r) => r.status === "skipped").length,
	};

	console.log(`[DLQ Scheduler] Completed: ${JSON.stringify(summary)}`);

	return { success: true, data: summary };
};
