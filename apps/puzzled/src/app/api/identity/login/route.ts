import { IdentityClient } from '@sylphx/identity'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { IDENTITY_API_ORIGIN } from '@/lib/identity/server'

export async function POST(request: Request) {
	const body = (await request.json().catch(() => null)) as {
		email?: string
		password?: string
	} | null
	if (!body?.email || !body.password) {
		return NextResponse.json({ error: 'invalid_login' }, { status: 400 })
	}
	const binding = process.env.SYLPHX_PROJECT_BINDING
	if (!binding) {
		return NextResponse.json({ error: 'identity_binding_required' }, { status: 503 })
	}
	const client = new IdentityClient(IDENTITY_API_ORIGIN, { projectBinding: binding })
	const begun = await client.identityAuthenticationBegin({
		principalHint: body.email,
	} as never)
	const completed = await client.identityAuthenticationComplete({
		challengeId: (begun as { challengeId?: string }).challengeId ?? '',
		secret: body.password,
	} as never)
	const token = completed.session?.accessToken
	if (!token) {
		return NextResponse.json({ error: 'identity_rejected' }, { status: 401 })
	}
	const jar = await cookies()
	jar.set('sylphx_identity_session', token, {
		httpOnly: true,
		sameSite: 'lax',
		path: '/',
		secure: process.env.NODE_ENV === 'production',
	})
	return NextResponse.json({ authority: 'sylphx-identity' })
}
