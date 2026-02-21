import { createWorkflowCronHandler } from "@/lib/api/cron";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Streak-at-risk reminder cron job
 *
 * Triggered by Vercel Cron at 18:00 UTC daily (see vercel.json)
 * Fire-and-forget: triggers Upstash Workflow and returns immediately
 *
 * Architecture:
 * - Vercel Cron triggers this endpoint (< 1s, lightweight)
 * - This endpoint fires the Upstash Workflow (no timeout, retry, DLQ)
 * - Workflow finds users with active streaks who haven't played today
 *   and sends push notifications to warn them
 */
export const GET = createWorkflowCronHandler({
	workflowPath: "/api/workflow/daily-reminder",
	workflowBody: { type: "streak-at-risk" },
	logPrefix: "[StreakAtRisk]",
	successMessage: "Streak-at-risk workflow triggered",
});
