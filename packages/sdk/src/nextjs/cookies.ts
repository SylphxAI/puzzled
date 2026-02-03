/**
 * Cookie Management for Next.js — Single Source of Truth
 *
 * Architecture: Cookie-Centric Auth (Clerk Pattern)
 * ================================================
 *
 * ALL auth state lives in cookies. Zero localStorage for auth.
 *
 * Cookie Structure:
 * - __sylphx_{namespace}_session  — HttpOnly JWT, 5 min (access token)
 * - __sylphx_{namespace}_refresh  — HttpOnly, 30 days (refresh token)
 * - __sylphx_{namespace}_user     — JS-readable, 5 min (user data for client hydration)
 *
 * Benefits:
 * 1. Single Source of Truth — no server/client state divergence
 * 2. XSS-safe — tokens never accessible to JavaScript
 * 3. Cross-tab sync — cookies shared across tabs automatically
 * 4. SSR works — auth() in Server Components reads cookies directly
 *
 * Security:
 * - Short token lifetime (5 min) like Clerk
 * - Server-side refresh in middleware
 * - SameSite=Lax for CSRF protection
 */

import { cookies } from 'next/headers'
import type { TokenResponse, User, UserCookieData } from '../types'
import {
	SESSION_TOKEN_LIFETIME_SECONDS,
	REFRESH_TOKEN_LIFETIME_SECONDS,
	TOKEN_EXPIRY_BUFFER_MS,
} from '../constants'

// Re-export UserCookieData for consumers of this module
export type { UserCookieData }

// =============================================================================
// Cookie Name Generator
// =============================================================================

/**
 * Get cookie names for a given namespace
 *
 * Namespace is derived from the secret key environment (dev/stg/prod).
 * This prevents cookies from different environments colliding.
 *
 * @example
 * getCookieNames('sylphx_prod')
 * // Returns:
 * // {
 * //   SESSION: '__sylphx_prod_session',
 * //   REFRESH: '__sylphx_prod_refresh',
 * //   USER: '__sylphx_prod_user',
 * // }
 */
export function getCookieNames(namespace: string) {
	return {
		/** HttpOnly JWT access token (5 min) */
		SESSION: `__${namespace}_session`,
		/** HttpOnly refresh token (30 days) */
		REFRESH: `__${namespace}_refresh`,
		/** JS-readable user data for client hydration (5 min) */
		USER: `__${namespace}_user`,
	}
}

// =============================================================================
// Cookie Options
// =============================================================================

/**
 * Session token lifetime (5 minutes like Clerk)
 */
export const SESSION_TOKEN_LIFETIME = SESSION_TOKEN_LIFETIME_SECONDS

/**
 * Refresh token lifetime (30 days)
 */
export const REFRESH_TOKEN_LIFETIME = REFRESH_TOKEN_LIFETIME_SECONDS

/**
 * Cookie options for HttpOnly tokens (session, refresh)
 *
 * Security features:
 * - httpOnly: true — Not accessible via JavaScript (XSS protection)
 * - secure: true in production — Only sent over HTTPS
 * - sameSite: 'lax' — CSRF protection while allowing navigation
 */
export const SECURE_COOKIE_OPTIONS = {
	httpOnly: true,
	secure: process.env.NODE_ENV === 'production',
	sameSite: 'lax' as const,
	path: '/',
}

/**
 * Cookie options for JS-readable user cookie
 *
 * This cookie contains only user info (no tokens) and enables:
 * - Client-side hydration without loading states
 * - Cross-tab sync via cookie visibility
 */
export const USER_COOKIE_OPTIONS = {
	httpOnly: false, // Readable by client JS for hydration
	secure: process.env.NODE_ENV === 'production',
	sameSite: 'lax' as const,
	path: '/',
}

// =============================================================================
// Types
// =============================================================================

/**
 * Auth cookies data returned by getAuthCookies
 */
export interface AuthCookiesData {
	/** Access token from SESSION cookie (HttpOnly) */
	sessionToken: string | null
	/** Refresh token from REFRESH cookie (HttpOnly) */
	refreshToken: string | null
	/** User data from USER cookie (JS-readable) */
	user: User | null
	/** Expiry timestamp from USER cookie */
	expiresAt: number | null
}

// =============================================================================
// Cookie Operations
// =============================================================================

/**
 * Get auth cookies from the request
 *
 * Used by auth() to read current auth state.
 */
export async function getAuthCookies(namespace: string): Promise<AuthCookiesData> {
	const cookieStore = await cookies()
	const names = getCookieNames(namespace)

	const sessionToken = cookieStore.get(names.SESSION)?.value || null
	const refreshToken = cookieStore.get(names.REFRESH)?.value || null
	const userCookieValue = cookieStore.get(names.USER)?.value || null

	let user: User | null = null
	let expiresAt: number | null = null

	if (userCookieValue) {
		try {
			const parsed: UserCookieData = JSON.parse(userCookieValue)
			user = parsed.user
			expiresAt = parsed.expiresAt
		} catch {
			// Invalid JSON, treat as no user
			user = null
			expiresAt = null
		}
	}

	return { sessionToken, refreshToken, user, expiresAt }
}

/**
 * Set auth cookies from token response
 *
 * Sets all three cookies:
 * - SESSION: HttpOnly access token (5 min)
 * - REFRESH: HttpOnly refresh token (30 days)
 * - USER: JS-readable user data (5 min)
 *
 * @param namespace - Cookie namespace (e.g., 'sylphx_prod')
 * @param response - Token response from auth endpoint
 * @param options - Optional: custom expiresIn override
 */
export async function setAuthCookies(
	namespace: string,
	response: TokenResponse,
	options?: { sessionLifetime?: number }
): Promise<void> {
	const cookieStore = await cookies()
	const names = getCookieNames(namespace)

	// Use custom session lifetime or default (5 min)
	const sessionLifetime = options?.sessionLifetime ?? SESSION_TOKEN_LIFETIME
	const expiresAt = Date.now() + sessionLifetime * 1000

	// SESSION cookie - HttpOnly access token
	cookieStore.set(names.SESSION, response.accessToken, {
		...SECURE_COOKIE_OPTIONS,
		maxAge: sessionLifetime,
	})

	// REFRESH cookie - HttpOnly refresh token (30 days)
	cookieStore.set(names.REFRESH, response.refreshToken, {
		...SECURE_COOKIE_OPTIONS,
		maxAge: REFRESH_TOKEN_LIFETIME,
	})

	// USER cookie - JS-readable for client hydration
	const userData: UserCookieData = {
		user: response.user,
		expiresAt,
	}
	cookieStore.set(names.USER, JSON.stringify(userData), {
		...USER_COOKIE_OPTIONS,
		maxAge: sessionLifetime,
	})
}

/**
 * Clear all auth cookies
 *
 * Call on sign out to remove all auth state.
 */
export async function clearAuthCookies(namespace: string): Promise<void> {
	const cookieStore = await cookies()
	const names = getCookieNames(namespace)

	cookieStore.delete(names.SESSION)
	cookieStore.delete(names.REFRESH)
	cookieStore.delete(names.USER)
}

/**
 * Check if session is expired
 *
 * Uses a 30 second buffer to account for network latency.
 */
export async function isSessionExpired(namespace: string): Promise<boolean> {
	const { expiresAt } = await getAuthCookies(namespace)
	if (!expiresAt) return true
	// 30 second buffer
	return expiresAt < Date.now() + TOKEN_EXPIRY_BUFFER_MS
}

/**
 * Check if we have a refresh token (can potentially refresh)
 */
export async function hasRefreshToken(namespace: string): Promise<boolean> {
	const { refreshToken } = await getAuthCookies(namespace)
	return !!refreshToken
}

// =============================================================================
// Middleware Cookie Helpers (for NextResponse)
// =============================================================================
// Middleware uses NextResponse.cookies, not next/headers cookies()

import type { NextResponse } from 'next/server'

/**
 * Set auth cookies on a NextResponse (for middleware use)
 *
 * Unlike setAuthCookies() which uses next/headers, this works with NextResponse.
 * Use this in middleware where you need to modify cookies on the response.
 */
export function setAuthCookiesMiddleware(
	response: NextResponse,
	namespace: string,
	tokens: TokenResponse,
): void {
	const names = getCookieNames(namespace)
	const expiresAt = Date.now() + SESSION_TOKEN_LIFETIME * 1000

	// SESSION cookie - HttpOnly access token
	response.cookies.set(names.SESSION, tokens.accessToken, {
		...SECURE_COOKIE_OPTIONS,
		maxAge: SESSION_TOKEN_LIFETIME,
	})

	// REFRESH cookie - HttpOnly refresh token
	response.cookies.set(names.REFRESH, tokens.refreshToken, {
		...SECURE_COOKIE_OPTIONS,
		maxAge: REFRESH_TOKEN_LIFETIME,
	})

	// USER cookie - JS-readable for client hydration
	const userData: UserCookieData = {
		user: tokens.user,
		expiresAt,
	}
	response.cookies.set(names.USER, JSON.stringify(userData), {
		...USER_COOKIE_OPTIONS,
		maxAge: SESSION_TOKEN_LIFETIME,
	})
}

/**
 * Clear auth cookies on a NextResponse (for middleware use)
 */
export function clearAuthCookiesMiddleware(
	response: NextResponse,
	namespace: string,
): void {
	const names = getCookieNames(namespace)
	response.cookies.delete(names.SESSION)
	response.cookies.delete(names.REFRESH)
	response.cookies.delete(names.USER)
}

/**
 * Parse user cookie value (for client-side use)
 */
export function parseUserCookie(value: string): UserCookieData | null {
	try {
		return JSON.parse(value) as UserCookieData
	} catch {
		return null
	}
}
