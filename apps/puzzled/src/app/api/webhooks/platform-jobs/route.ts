/**
 * POST /api/webhooks/platform-jobs
 *
 * Webhook handler for Platform SDK Jobs.
 * Platform calls this endpoint when scheduled jobs (cron or one-time) fire.
 *
 * Architecture:
 * - Platform manages cron schedules via QStash
 * - When job fires, Platform calls this webhook with:
 *   - X-Sylphx-App-Id: App identifier
 *   - X-Sylphx-Cron-Name: Cron job name (for cron jobs)
 *   - X-Sylphx-Job-Id: Job ID (for tracking)
 *   - Body: { appId, userId, payload, timestamp }
 *
 * This centralizes job scheduling through Platform for unified billing.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerBaseUrl } from '@/lib/utils'
import { env } from '@/lib/env'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ==========================================
// Job Handlers Registry
// ==========================================

/**
 * Map of cron job names to their handlers
 * Each handler returns the internal endpoint to trigger
 */
const JOB_HANDLERS: Record<string, () => { endpoint: string; body?: Record<string, unknown> }> = {
	// Puzzle generation - daily at 23:00 UTC
	'generate-daily-puzzles': () => ({
		endpoint: '/api/jobs/generate-puzzles',
	}),

	// Daily reminder notifications - daily at 08:00 UTC
	'daily-reminder': () => ({
		endpoint: '/api/workflow/daily-reminder',
		body: { type: 'all' },
	}),

	// Streak-at-risk notifications - daily at 18:00 UTC
	'streak-at-risk': () => ({
		endpoint: '/api/workflow/daily-reminder',
		body: { type: 'streak-at-risk' },
	}),

	// Win-back emails - daily at 10:00 UTC
	'win-back-emails': () => ({
		endpoint: '/api/workflow/win-back-emails',
	}),

	// DLQ retry - hourly
	'dlq-retry': () => ({
		endpoint: '/api/jobs/dlq-retry',
	}),
}

// ==========================================
// Request Verification
// ==========================================

interface PlatformJobPayload {
	appId: string
	userId?: string
	payload?: Record<string, unknown>
	timestamp: string
}

function verifyPlatformRequest(req: NextRequest): { valid: boolean; error?: string } {
	const appId = req.headers.get('x-sylphx-app-id')

	// Verify app ID matches our app
	if (!appId) {
		return { valid: false, error: 'Missing X-Sylphx-App-Id header' }
	}

	if (appId !== env.SYLPHX_APP_ID) {
		return { valid: false, error: 'Invalid app ID' }
	}

	return { valid: true }
}

// ==========================================
// Handler
// ==========================================

export async function POST(req: NextRequest) {
	const logPrefix = '[PlatformJobs]'

	// Verify request is from Platform
	const verification = verifyPlatformRequest(req)
	if (!verification.valid) {
		console.error(`${logPrefix} Verification failed: ${verification.error}`)
		return NextResponse.json({ error: verification.error }, { status: 401 })
	}

	// Extract job info from headers
	const cronName = req.headers.get('x-sylphx-cron-name')
	const jobId = req.headers.get('x-sylphx-job-id')

	if (!cronName) {
		console.error(`${logPrefix} Missing cron name`)
		return NextResponse.json({ error: 'Missing X-Sylphx-Cron-Name header' }, { status: 400 })
	}

	console.log(`${logPrefix} Received job: ${cronName} (jobId: ${jobId})`)

	// Parse body for payload
	let payload: PlatformJobPayload | null = null
	try {
		payload = await req.json()
	} catch {
		// Body is optional
	}

	// Find handler for this job
	const handler = JOB_HANDLERS[cronName]
	if (!handler) {
		console.error(`${logPrefix} Unknown job: ${cronName}`)
		return NextResponse.json({ error: `Unknown job: ${cronName}` }, { status: 404 })
	}

	// Get endpoint config
	const config = handler()
	const baseUrl = getServerBaseUrl()
	const targetUrl = `${baseUrl}${config.endpoint}`

	console.log(`${logPrefix} Triggering: ${config.endpoint}`)

	// Fire-and-forget - trigger the internal endpoint
	fetch(targetUrl, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'x-internal-call': 'true',
		},
		body: JSON.stringify({
			...config.body,
			...payload?.payload,
			_platformJobId: jobId,
		}),
	}).catch((error) => {
		console.error(`${logPrefix} Failed to trigger ${config.endpoint}:`, error)
	})

	return NextResponse.json({
		success: true,
		job: cronName,
		triggered: config.endpoint,
		timestamp: new Date().toISOString(),
	})
}
