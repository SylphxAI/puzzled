/**
 * Cookie Management for Next.js
 *
 * Secure cookie helpers for storing auth tokens.
 * Cookie names are namespaced by environment prefix to prevent collisions.
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
	}
}

// Cookie options
const COOKIE_OPTIONS = {
	httpOnly: true,
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
 * Set auth cookies from token response
 */
export async function setAuthCookies(appId: string, response: TokenResponse): Promise<void> {
	const cookieStore = await cookies()
	const names = getCookieNames(appId)
	const expiresAt = Date.now() + response.expiresIn * 1000

	// Access token - shorter expiry
	cookieStore.set(names.ACCESS_TOKEN, response.accessToken, {
		...COOKIE_OPTIONS,
		maxAge: response.expiresIn,
	})

	// Refresh token - longer expiry (30 days)
	cookieStore.set(names.REFRESH_TOKEN, response.refreshToken, {
		...COOKIE_OPTIONS,
		maxAge: 30 * 24 * 60 * 60, // 30 days
	})

	// User data - match refresh token expiry
	cookieStore.set(names.USER, JSON.stringify(response.user), {
		...COOKIE_OPTIONS,
		maxAge: 30 * 24 * 60 * 60,
	})

	// Expiry timestamp
	cookieStore.set(names.EXPIRES_AT, expiresAt.toString(), {
		...COOKIE_OPTIONS,
		maxAge: response.expiresIn,
	})
}

/**
 * Clear all auth cookies
 */
export async function clearAuthCookies(appId: string): Promise<void> {
	const cookieStore = await cookies()
	const names = getCookieNames(appId)

	cookieStore.delete(names.ACCESS_TOKEN)
	cookieStore.delete(names.REFRESH_TOKEN)
	cookieStore.delete(names.USER)
	cookieStore.delete(names.EXPIRES_AT)
}

/**
 * Check if auth cookies are expired
 */
export async function isAuthExpired(appId: string): Promise<boolean> {
	const { expiresAt } = await getAuthCookies(appId)
	if (!expiresAt) return true
	return expiresAt < Date.now()
}
