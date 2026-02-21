import { createWorkflowCronHandler } from "@/lib/api/cron";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Win-back email cron job
 *
 * Triggered by Vercel Cron at 10:00 UTC daily (see vercel.json)
 * Fire-and-forget: triggers Upstash Workflow and returns immediately
 *
 * Architecture:
 * - Vercel Cron triggers this endpoint (< 1s, lightweight)
 * - This endpoint fires the Upstash Workflow (no timeout, retry, DLQ)
 * - Workflow finds inactive users (7, 14, 30 days) and sends emails
 */
export const GET = createWorkflowCronHandler({
	workflowPath: "/api/workflow/win-back-emails",
	logPrefix: "[WinBackEmails]",
	successMessage: "Win-back emails workflow triggered",
});
