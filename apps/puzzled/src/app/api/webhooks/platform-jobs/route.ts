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
 * Optimization (v2):
 * - Jobs are now executed synchronously within the webhook handler
 * - Eliminates the unnecessary HTTP hop to internal endpoints
 * - Reduces 3-hop to 2-hop: Platform → QStash → App webhook (direct execution)
 */

import { type NextRequest, NextResponse } from 'next/server'
import { env } from '@/lib/env'
import { executeJob, JOB_HANDLERS } from '@/lib/jobs/handlers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes for long-running jobs like puzzle generation

// ==========================================
// Request Verification
// ==========================================

interface PlatformJobPayload {
	appId: string
	userId?: string
	payload?: Record<string, unknown>
	timestamp: string
}

function verifyPlatformRequest(req: NextRequest): {
	valid: boolean
	error?: string
} {
	const secretKey = req.headers.get('x-app-secret')

	// Verify secret key matches our app
	if (!secretKey) {
		return { valid: false, error: 'Missing x-app-secret header' }
	}

	if (secretKey !== env.SYLPHX_SECRET_KEY) {
		return { valid: false, error: 'Invalid secret key' }
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

	// Check if we have a handler for this job
	const handlerFactory = JOB_HANDLERS[cronName]
	if (!handlerFactory) {
		console.error(`${logPrefix} Unknown job: ${cronName}`)
		return NextResponse.json({ error: `Unknown job: ${cronName}` }, { status: 404 })
	}

	console.log(`${logPrefix} Executing job directly`)

	// Execute job synchronously (no HTTP hop)
	const result = await executeJob(cronName, payload?.payload ?? {}, {
		jobId: jobId ?? undefined,
		timestamp: new Date(),
	})

	console.log(`${logPrefix} Job completed: ${result.success ? 'success' : 'failed'}`)

	return NextResponse.json(
		{
			success: result.success,
			job: cronName,
			result: result.data,
			error: result.error,
			timestamp: new Date().toISOString(),
		},
		{ status: result.success ? 200 : 500 },
	)
}
