/**
 * OAuth Callback Route
 *
 * Handles OAuth callback from Sylphx Platform.
 * Exchanges auth code for tokens (server-side) and sets cookies for SSR.
 *
 * This route is called when:
 * - User completes OAuth (Google, GitHub, etc.)
 * - Platform redirects back with ?code=xxx
 *
 * Flow:
 * 1. Platform redirects to puzzled.gg/api/auth/callback?code=xxx
 * 2. This route exchanges code for tokens (server-side with secret key)
 * 3. Cookies are set for SSR auth
 * 4. User is redirected to the intended destination
 */

import { handleCallback } from '@sylphx/sdk/nextjs'
import { type NextRequest, NextResponse } from 'next/server'

// Force dynamic - no caching for auth callbacks
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
	const { searchParams } = request.nextUrl
	const code = searchParams.get('code')
	const error = searchParams.get('error')
	const errorDescription = searchParams.get('error_description')
	const redirectTo = searchParams.get('redirect_to') || '/'

	// Handle OAuth errors
	if (error) {
		const errorUrl = new URL('/login', request.url)
		errorUrl.searchParams.set('error', error)
		if (errorDescription) {
			errorUrl.searchParams.set('error_description', errorDescription)
		}
		return NextResponse.redirect(errorUrl)
	}

	// Missing code
	if (!code) {
		const errorUrl = new URL('/login', request.url)
		errorUrl.searchParams.set('error', 'missing_code')
		errorUrl.searchParams.set('error_description', 'No authorization code received')
		return NextResponse.redirect(errorUrl)
	}

	try {
		// Exchange code for tokens (server-side) and set cookies
		await handleCallback(code)

		// Redirect to intended destination
		return NextResponse.redirect(new URL(redirectTo, request.url))
	} catch (err) {
		console.error('[Auth Callback] Failed to exchange code:', err)

		const errorUrl = new URL('/login', request.url)
		errorUrl.searchParams.set('error', 'token_exchange_failed')
		errorUrl.searchParams.set(
			'error_description',
			err instanceof Error ? err.message : 'Failed to complete authentication',
		)
		return NextResponse.redirect(errorUrl)
	}
}
