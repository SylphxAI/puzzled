/**
 * NON-AUTHORITY residual.
 *
 * Public edge routing for `/api/webhooks/platform-jobs` is owned by the Rust
 * `api` service (`sylphx.toml` path_prefixes + ADR-169). This Next.js route must
 * not reintroduce dual backend authority.
 *
 * Kept only as an explicit 410 marker so local `next dev` without the api
 * service fails closed instead of silently executing a second job runtime.
 */

import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function gone() {
	return NextResponse.json(
		{
			error: 'gone',
			message:
				'platform-jobs webhook authority is puzzled-server (Rust). Configure API_INTERNAL_URL / edge path_prefixes.',
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
