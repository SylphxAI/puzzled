import { getServerBaseUrl } from "@/lib/utils";
import { NextResponse } from "next/server";

/**
 * Cron Job Utilities (SSOT)
 *
 * Centralized helpers for all cron endpoints.
 * Reduces duplication and ensures consistent security patterns.
 */

/**
 * Verify cron authorization from Vercel Cron or QStash
 *
 * Returns null if authorized, otherwise returns an error Response.
 *
 * @example
 * const authError = verifyCronAuth(request)
 * if (authError) return authError
 */
export function verifyCronAuth(
	request: Request,
	logPrefix = "[Cron]",
): Response | null {
	const authHeader = request.headers.get("authorization");
	const cronSecret = process.env.CRON_SECRET;

	if (!cronSecret) {
		console.error(`${logPrefix} CRON_SECRET not configured`);
		return NextResponse.json({ error: "Cron not configured" }, { status: 500 });
	}

	if (authHeader !== `Bearer ${cronSecret}`) {
		console.error(`${logPrefix} Invalid authorization`);
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	return null;
}

/**
 * Trigger an Upstash Workflow (fire-and-forget)
 *
 * Does not await the response - workflow handles its own retry/DLQ.
 *
 * @example
 * triggerWorkflow('/api/workflow/daily-reminder', { type: 'all' }, '[Cron]')
 */
function triggerWorkflow(
	workflowPath: string,
	body: Record<string, unknown> = {},
	logPrefix = "[Cron]",
): void {
	const baseUrl = getServerBaseUrl();
	const workflowUrl = `${baseUrl}${workflowPath}`;

	console.log(
		`${logPrefix} Triggering workflow: ${workflowPath} (fire-and-forget)`,
	);

	fetch(workflowUrl, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	}).catch((error) => {
		console.error(
			`${logPrefix} Failed to trigger workflow ${workflowPath}:`,
			error,
		);
	});
}

/**
 * Create a standard cron success response
 */
export function cronSuccess(
	message: string,
	extra: Record<string, unknown> = {},
): Response {
	return NextResponse.json({
		success: true,
		message,
		timestamp: new Date().toISOString(),
		...extra,
	});
}

/**
 * Create a standard cron error response
 */
function _cronError(message: string, status = 500): Response {
	return NextResponse.json(
		{
			success: false,
			error: message,
			timestamp: new Date().toISOString(),
		},
		{ status },
	);
}

/**
 * Create a fire-and-forget cron handler that triggers a workflow
 *
 * This is the most common pattern for cron jobs that trigger Upstash Workflows.
 *
 * @example
 * export const GET = createWorkflowCronHandler({
 *   workflowPath: '/api/workflow/daily-reminder',
 *   workflowBody: { type: 'all' },
 *   logPrefix: '[DailyReminder]',
 *   successMessage: 'Daily reminder workflow triggered',
 * })
 */
export function createWorkflowCronHandler(options: {
	workflowPath: string;
	workflowBody?: Record<string, unknown>;
	logPrefix?: string;
	successMessage: string;
}): (request: Request) => Response {
	const {
		workflowPath,
		workflowBody = {},
		logPrefix = "[Cron]",
		successMessage,
	} = options;

	return (request: Request) => {
		const authError = verifyCronAuth(request, logPrefix);
		if (authError) return authError;

		triggerWorkflow(workflowPath, workflowBody, logPrefix);

		return cronSuccess(successMessage);
	};
}
