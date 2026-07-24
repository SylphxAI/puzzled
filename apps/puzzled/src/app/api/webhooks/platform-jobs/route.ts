/**
 * POST /api/webhooks/platform-jobs
 *
 * Terminal Platform job worker authority (ADR-170).
 *
 * - Platform cron callbacks (register-crons) target this webhook.
 * - Full job effects (LLM generation, DB writes, email/push, DLQ) execute via
 *   `src/lib/jobs/**` handlers.
 * - Rust owns product API + pure seed plan/execute only — not this webhook.
 */

import { type NextRequest, NextResponse } from 'next/server'
import { env } from '@/lib/env'
import { executeJob, JOB_HANDLERS } from '@/lib/jobs/handlers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

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
	if (!secretKey) {
		return { valid: false, error: 'Missing x-app-secret header' }
	}
	if (secretKey !== env.SYLPHX_SECRET_KEY) {
		return { valid: false, error: 'Invalid secret key' }
	}
	return { valid: true }
}

export async function POST(req: NextRequest) {
	const logPrefix = '[PlatformJobs]'

	const verification = verifyPlatformRequest(req)
	if (!verification.valid) {
		console.error(`${logPrefix} Verification failed: ${verification.error}`)
		return NextResponse.json({ error: verification.error }, { status: 401 })
	}

	const cronName = req.headers.get('x-sylphx-cron-name')
	const jobId = req.headers.get('x-sylphx-job-id')
	if (!cronName) {
		console.error(`${logPrefix} Missing cron name`)
		return NextResponse.json({ error: 'Missing X-Sylphx-Cron-Name header' }, { status: 400 })
	}

	console.log(`${logPrefix} Received job: ${cronName} (jobId: ${jobId})`)

	let payload: PlatformJobPayload | null = null
	try {
		payload = await req.json()
	} catch {
		// optional body
	}

	if (!JOB_HANDLERS[cronName]) {
		console.error(`${logPrefix} Unknown job: ${cronName}`)
		return NextResponse.json({ error: `Unknown job: ${cronName}` }, { status: 404 })
	}

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
			authority: 'web-platform-job-worker',
		},
		{ status: result.success ? 200 : 500 },
	)
}
