import 'server-only'

import { NextResponse } from 'next/server'
import {
	AuthCallError,
	type AuthConfig,
	isNewUser,
	redeemTicket,
	sessionTimes,
} from './client-auth'
import { setSessionCookie } from './server'
import { recordSignupAttribution } from './signup-attribution'

export function authFail(status: number, error: string) {
	return NextResponse.json({ error, authority: 'sylphx-identity' }, { status })
}

export function userAgentOf(request: Request): string {
	return request.headers.get('user-agent')?.trim() || 'puzzled-web'
}

/**
 * Redeem a sign-in ticket into the session cookie. When the account is new,
 * credit the link that brought the player (first-touch tags). Returns the
 * session token, or throws `AuthCallError`.
 */
export async function completeSignIn(
	config: AuthConfig,
	request: Request,
	ticket: string,
): Promise<string> {
	const userAgent = userAgentOf(request)
	const session = await redeemTicket(config, ticket, userAgent)
	await setSessionCookie(session.token)
	try {
		const times =
			typeof session.isNewUser === 'boolean'
				? {}
				: await sessionTimes(config, session.token, userAgent)
		if (isNewUser({ flag: session.isNewUser, ...times, now: Date.now() / 1000 })) {
			await recordSignupAttribution(session.token, request.headers.get('cookie'), userAgent)
		}
	} catch (error) {
		// Attribution never blocks a sign-in.
		if (!(error instanceof AuthCallError)) throw error
	}
	return session.token
}
