import { createWorkflowCronHandler } from '@/lib/api/cron'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Daily puzzle reminder cron job
 *
 * Triggered by Vercel Cron at 08:00 UTC daily (see vercel.json)
 * Fire-and-forget: triggers Upstash Workflow and returns immediately
 *
 * Architecture:
 * - Vercel Cron triggers this endpoint (< 1s, lightweight)
 * - This endpoint fires the Upstash Workflow (no timeout, retry, DLQ)
 * - Workflow sends push notifications to all subscribed users
 */
export const GET = createWorkflowCronHandler({
	workflowPath: '/api/workflow/daily-reminder',
	workflowBody: { type: 'all' },
	logPrefix: '[DailyReminder]',
	successMessage: 'Daily reminder workflow triggered',
})
