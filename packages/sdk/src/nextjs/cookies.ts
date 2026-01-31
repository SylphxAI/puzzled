/**
 * Cookie Management for Next.js
 *
 * Secure cookie helpers for storing auth tokens.
 * Cookie names are namespaced by environment prefix to prevent collisions.
 *
 * Architecture:
 * - HTTP-only cookies store sensitive tokens (access_token, refresh_token)
 * - A JS-readable session cookie stores user info for client hydration
 * - This allows SSR auth via cookies AND client-side state sync
 */

import { cookies } from 'next/headers'
import type { TokenResponse, User } from '../types'

// Cookie name generator (namespaced by environment prefix)
export function getCookieNames(namespace: string) {
	return {
		ACCESS_TOKEN: `${namespace}_access_token`,
		REFRESH_TOKEN: `${namespace}_refresh_token`,
		USER: `${namespace}_user`,
		EXPIRES_AT: `${namespace}_expires_at`,
		// JS-readable session cookie for client hydration
		SESSION: `${namespace}_session`,
	}
}

// Cookie options for HTTP-only tokens
const SECURE_COOKIE_OPTIONS = {
	httpOnly: true,
	secure: process.env.NODE_ENV === 'production',
	sameSite: 'lax' as const,
	path: '/',
}

// Cookie options for JS-readable session (for client hydration)
const SESSION_COOKIE_OPTIONS = {
	httpOnly: false, // Readable by client JS
	secure: process.env.NODE_ENV === 'production',
	sameSite: 'lax' as const,
	path: '/',
}

/**
 * Get auth tokens from cookies
 */
export async function getAuthCookies(appId: string): Promise<{
	accessToken: string | null
	refreshToken: string | null
	user: User | null
	expiresAt: number | null
}> {
	const cookieStore = await cookies()
	const names = getCookieNames(appId)

	const accessToken = cookieStore.get(names.ACCESS_TOKEN)?.value || null
	const refreshToken = cookieStore.get(names.REFRESH_TOKEN)?.value || null
	const userJson = cookieStore.get(names.USER)?.value || null
	const expiresAtStr = cookieStore.get(names.EXPIRES_AT)?.value || null

	let user: User | null = null
	if (userJson) {
		try {
			user = JSON.parse(userJson)
		} catch {
			user = null
		}
	}

	const expiresAt = expiresAtStr ? parseInt(expiresAtStr, 10) : null

	return { accessToken, refreshToken, user, expiresAt }
}

/**
 * Session data stored in JS-readable cookie for client hydration
 */
interface SessionCookie {
	user: User
	expiresAt: number
	// Note: tokens are NOT included - stored separately in HTTP-only cookies
}

/**
 * Set auth cookies from token response
 *
 * Sets both:
 * - HTTP-only cookies for tokens (secure, server-only access)
 * - JS-readable session cookie for client hydration
 */
export async function setAuthCookies(appId: string, response: TokenResponse): Promise<void> {
	const cookieStore = await cookies()
	const names = getCookieNames(appId)
	const expiresAt = Date.now() + response.expiresIn * 1000

	// Access token - shorter expiry (HTTP-only)
	cookieStore.set(names.ACCESS_TOKEN, response.accessToken, {
		...SECURE_COOKIE_OPTIONS,
		maxAge: response.expiresIn,
	})

	// Refresh token - longer expiry (HTTP-only)
	cookieStore.set(names.REFRESH_TOKEN, response.refreshToken, {
		...SECURE_COOKIE_OPTIONS,
		maxAge: 30 * 24 * 60 * 60, // 30 days
	})

	// User data (HTTP-only for server-side use)
	cookieStore.set(names.USER, JSON.stringify(response.user), {
		...SECURE_COOKIE_OPTIONS,
		maxAge: 30 * 24 * 60 * 60,
	})

	// Expiry timestamp (HTTP-only)
	cookieStore.set(names.EXPIRES_AT, expiresAt.toString(), {
		...SECURE_COOKIE_OPTIONS,
		maxAge: response.expiresIn,
	})

	// Session cookie - JS-readable for client hydration
	// Contains user info but NOT tokens (those stay HTTP-only)
	const sessionData: SessionCookie = {
		user: response.user,
		expiresAt,
	}
	cookieStore.set(names.SESSION, JSON.stringify(sessionData), {
		...SESSION_COOKIE_OPTIONS,
		maxAge: response.expiresIn,
	})
}

/**
 * Clear all auth cookies (including session cookie)
 */
export async function clearAuthCookies(appId: string): Promise<void> {
	const cookieStore = await cookies()
	const names = getCookieNames(appId)

	cookieStore.delete(names.ACCESS_TOKEN)
	cookieStore.delete(names.REFRESH_TOKEN)
	cookieStore.delete(names.USER)
	cookieStore.delete(names.EXPIRES_AT)
	cookieStore.delete(names.SESSION)
}

/**
 * Check if auth cookies are expired
 */
export async function isAuthExpired(appId: string): Promise<boolean> {
	const { expiresAt } = await getAuthCookies(appId)
	if (!expiresAt) return true
	return expiresAt < Date.now()
}
