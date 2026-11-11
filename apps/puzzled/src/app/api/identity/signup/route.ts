import { NextResponse } from 'next/server'
import { signUpCookieHeader } from '@/lib/identity/after-sign-up'
import { AuthCallError, authConfig, passwordTicket, signUp } from '@/lib/identity/client-auth'
import { admitJsonPost } from '@/lib/identity/http'
import { MIN_PASSWORD_LENGTH } from '@/lib/identity/password-policy'
import { authFail, completeSignIn, userAgentOf } from '@/lib/identity/sign-in'
import { logger } from '@/lib/logger'
import { getRequestSiteOrigin } from '@/lib/site-origin.server'

/**
 * Email sign-up. Auth answers the same whether or not the email already has
 * an account; signing in with the same password then works only for its
 * holder. A completion failure is not evidence that email verification is needed.
 */
export async function POST(request: Request) {
	const refused = await admitJsonPost(request)
	if (refused) return refused
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
	if (password.length < MIN_PASSWORD_LENGTH) return authFail(400, 'password_too_short')
	const userAgent = userAgentOf(request)
	try {
		await signUp(config, {
			email,
			password,
			name: (body?.displayName ?? body?.name ?? '').trim(),
			verifyUrl: `${await getRequestSiteOrigin()}/verify-email`,
			userAgent,
		})
	} catch (error) {
		const status = error instanceof AuthCallError && error.status === 400 ? 400 : 502
		return authFail(status, status === 400 ? 'signup_rejected' : 'identity_unavailable')
	}
	let stage: 'password_ticket' | 'session_completion' = 'password_ticket'
	try {
		const ticket = await passwordTicket(config, { email, password, userAgent })
		stage = 'session_completion'
		const { newAccount } = await completeSignIn(config, request, ticket)
		const response = NextResponse.json({ signedIn: true })
		if (newAccount) response.headers.append('set-cookie', signUpCookieHeader('email'))
		return response
	} catch (error) {
		// Count the failure without recording addresses, credentials, or upstream text/codes.
		logger.warn('signup.signin-failed', {
			stage,
			reason: error instanceof AuthCallError ? 'auth_call_failed' : 'unexpected_error',
			upstreamStatus: error instanceof AuthCallError ? error.status : null,
		})
		return NextResponse.json({ error: 'signup_signin_failed', retrySignIn: true }, { status: 502 })
	}
}
