import { NextResponse } from 'next/server'
import { AuthCallError, authConfig, passwordTicket, signUp } from '@/lib/identity/client-auth'
import { authFail, completeSignIn, userAgentOf } from '@/lib/identity/sign-in'
import { getRequestSiteOrigin } from '@/lib/site-origin.server'

/**
 * Email sign-up. Auth answers the same whether or not the email already has
 * an account; signing in with the same password then works only for its
 * holder, so an existing address gets the neutral "check your email" answer.
 */
export async function POST(request: Request) {
	const config = authConfig()
	if (!config) return authFail(503, 'identity_unconfigured')
	const body = (await request.json().catch(() => null)) as {
		email?: string
		password?: string
		name?: string
		displayName?: string
	} | null
	const email = body?.email?.trim()
	const password = body?.password ?? ''
	if (!email || !password) return authFail(400, 'invalid_signup')
	if (password.length < 12) return authFail(400, 'password_too_short')
	const userAgent = userAgentOf(request)
	try {
		await signUp(config, {
			email,
			password,
			name: (body?.displayName ?? body?.name ?? '').trim(),
			verifyUrl: `${await getRequestSiteOrigin()}/`,
			userAgent,
		})
	} catch (error) {
		const status = error instanceof AuthCallError && error.status === 400 ? 400 : 502
		return authFail(status, status === 400 ? 'signup_rejected' : 'identity_unavailable')
	}
	try {
		const ticket = await passwordTicket(config, { email, password, userAgent })
		await completeSignIn(config, request, ticket)
		return NextResponse.json({ authority: 'sylphx-identity', signedIn: true })
	} catch {
		return NextResponse.json({ authority: 'sylphx-identity', signedIn: false })
	}
}
