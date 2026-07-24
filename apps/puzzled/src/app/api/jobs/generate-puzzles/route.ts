/**
 * ADR-170 terminal retirement.
 *
 * Dual public entry retired. Platform job worker authority is:
 *   POST /api/webhooks/platform-jobs
 * (web service; register-crons callbackUrl).
 *
 * Legacy public job HTTP dual entry; webhook calls lib handlers directly.
 */

import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function gone() {
	return NextResponse.json(
		{
			error: 'gone',
			authority: 'web:/api/webhooks/platform-jobs',
			message: 'This dual HTTP entry is retired (ADR-170). Use the Platform job worker webhook.',
		},
		{ status: 410 },
	)
}

export function GET() {
	return gone()
}

export function POST() {
	return gone()
}
