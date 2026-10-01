import { NextResponse } from 'next/server'
import { signUpCookieHeader } from '@/lib/identity/after-sign-up'
import { authConfig, safeNext } from '@/lib/identity/client-auth'
import { completeSignIn } from '@/lib/identity/sign-in'
import { getRequestSiteOrigin } from '@/lib/site-origin.server'

/**
 * Where Auth returns after a social sign-in, with `sylphx_ticket`. The ticket
 * is redeemed here (server mode) into the session cookie; a new account is
 * credited to the link that brought the player.
 */
export async function GET(request: Request) {
	const url = new URL(request.url)
	const origin = await getRequestSiteOrigin()
	const next = safeNext(url.searchParams.get('next'))
	const ticket = url.searchParams.get('sylphx_ticket')?.trim()
	const config = authConfig()
	if (!config || !ticket) {
		return NextResponse.redirect(`${origin}/login?error=oauth_failed`, 303)
	}
	try {
		const { newAccount } = await completeSignIn(config, request, ticket)
		const response = NextResponse.redirect(`${origin}${next}`, 303)
		// Only Auth's own new-account answer sets the one-shot sign_up cookie.
		if (newAccount) response.headers.append('set-cookie', signUpCookieHeader('oauth'))
		return response
	} catch {
		return NextResponse.redirect(`${origin}/login?error=oauth_failed`, 303)
	}
}
