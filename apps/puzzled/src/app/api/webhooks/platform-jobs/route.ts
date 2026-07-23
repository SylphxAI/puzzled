/**
 * POST /api/webhooks/platform-jobs
 *
 * Residual web-service job executor (ADR-169 transitional).
 *
 * Authority model:
 * - Platform cron callbacks target this webhook (register-crons callbackUrl).
 * - Full job I/O (LLM generation, DB writes, email/push, DLQ) still lives in
 *   Next.js handlers under `src/lib/jobs/**`.
 * - Rust owns pure plan/seed surfaces at `/api/v1/jobs/*` and must not claim
 *   full job completion until adapters persist effects.
 *
 * Edge note: `sylphx.toml` api path_prefixes intentionally omit this path so
 * the web service remains the residual executor (not a dual public backend).
 */

import { type NextRequest, NextResponse } from 'next/server'
import { env } from '@/lib/env'
import { executeJob, JOB_HANDLERS } from '@/lib/jobs/handlers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes for long-running jobs like puzzle generation

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
		// Body is optional
	}

	const handlerFactory = JOB_HANDLERS[cronName]
	if (!handlerFactory) {
		console.error(`${logPrefix} Unknown job: ${cronName}`)
		return NextResponse.json({ error: `Unknown job: ${cronName}` }, { status: 404 })
	}

	console.log(`${logPrefix} Executing residual web job handler`)

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
			authority: 'web-residual-job-executor',
		},
		{ status: result.success ? 200 : 500 },
	)
}
