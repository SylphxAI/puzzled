import { createWorkflowCronHandler } from '@/lib/api/cron'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Daily puzzle generation cron job
 *
 * Triggered by Vercel Cron at 23:00 UTC daily (see vercel.json)
 * Fire-and-forget: triggers Upstash Workflow and returns immediately
 *
 * Architecture:
 * - Vercel Cron triggers this endpoint (< 1s, lightweight)
 * - This endpoint fires the Upstash Workflow (no timeout, retry, DLQ)
 * - Workflow generates puzzles for all 17 games for tomorrow
 */
export const GET = createWorkflowCronHandler({
	workflowPath: '/api/workflow/generate-puzzles',
	logPrefix: '[PuzzleGeneration]',
	successMessage: 'Puzzle generation workflow triggered',
})
