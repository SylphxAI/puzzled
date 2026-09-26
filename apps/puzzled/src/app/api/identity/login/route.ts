import { NextResponse } from 'next/server'
import { AuthCallError, authConfig, passwordTicket } from '@/lib/identity/client-auth'
import { authFail, completeSignIn, userAgentOf } from '@/lib/identity/sign-in'

/** Email + password sign-in through the Auth client API (server mode). */
export async function POST(request: Request) {
	const config = authConfig()
	if (!config) return authFail(503, 'identity_unconfigured')
	const body = (await request.json().catch(() => null)) as {
		email?: string
		password?: string
	} | null
	const email = body?.email?.trim()
	const password = body?.password ?? ''
	if (!email || !password) return authFail(400, 'invalid_login')
	try {
		const ticket = await passwordTicket(config, {
			email,
			password,
			userAgent: userAgentOf(request),
		})
		await completeSignIn(config, request, ticket)
		return NextResponse.json({ authority: 'sylphx-identity' })
	} catch (error) {
		if (error instanceof AuthCallError && error.status === 429) {
			return authFail(429, 'locked_out')
		}
		if (error instanceof AuthCallError && error.code === 'mfa_required') {
			return authFail(401, 'mfa_required')
		}
		return authFail(401, 'identity_rejected')
	}
}
