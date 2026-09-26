import { NextResponse } from 'next/server'
import { authConfig, googleStartUrl, safeNext } from '@/lib/identity/client-auth'
import { authFail } from '@/lib/identity/sign-in'
import { getRequestSiteOrigin } from '@/lib/site-origin.server'

/**
 * Social sign-in start. Auth's shared Google client runs the provider round
 * trip and returns to `/api/identity/oauth/callback` with a one-time ticket.
 */
export async function POST(request: Request) {
	const config = authConfig()
	if (!config) return authFail(503, 'identity_unconfigured')
	const body = (await request.json().catch(() => null)) as {
		provider?: string
		federationId?: string
		redirectUrl?: string
	} | null
	const provider = (body?.provider ?? body?.federationId ?? '').trim().toLowerCase()
	if (provider !== 'google') return authFail(400, 'oidc_provider_unsupported')
	const next = safeNext(body?.redirectUrl)
	const callback = `${await getRequestSiteOrigin()}/api/identity/oauth/callback?next=${encodeURIComponent(next)}`
	return NextResponse.json({
		authority: 'sylphx-identity',
		authorizationUrl: googleStartUrl(config, callback),
	})
}
