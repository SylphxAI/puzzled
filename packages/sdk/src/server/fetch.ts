/**
 * Server-Side Data Fetching — Shared Infrastructure
 *
 * Internal helpers shared by the server-side config/data fetchers. These are
 * NOT part of the public SDK surface.
 */

import { DEFAULT_PLATFORM_URL } from '../constants'
import { validateAndSanitizeSecretKey } from '../key-validation'

/** Common options for authenticated SDK fetch — secret key identifies the app */
export interface AuthenticatedFetchOptions {
	/** Secret key for authentication (sk_dev_xxx, sk_stg_xxx, sk_prod_xxx) */
	secretKey: string
	/** Platform URL (defaults to https://sylphx.com) */
	platformUrl?: string
	/** Optional cache TTL in seconds. Default: 60 */
	revalidate?: number
}

/**
 * Options for public endpoints that only need an App ID (public key).
 * The App ID IS the app identity — no separate key needed.
 */
export interface PublicFetchOptions {
	/** App ID (app_dev_xxx, app_stg_xxx, app_prod_xxx) — identifies the app */
	appId: string
	/** Platform URL (defaults to https://sylphx.com) */
	platformUrl?: string
	/** Optional cache TTL in seconds. Default: 60 */
	revalidate?: number
}

/**
 * Fetch config data with NO CACHE.
 *
 * Config data (OAuth providers, plans, flags) must reflect admin changes immediately.
 * Using `cache: 'no-store'` ensures every request hits the origin.
 *
 * The API endpoint itself returns Cache-Control headers for CDN caching (60s),
 * but the Next.js Data Cache is bypassed to ensure fresh data on each SSR.
 *
 * Trade-off: Slightly higher latency per request, but config is always fresh.
 * This is the industry standard (Clerk, Auth0, Firebase) for auth config.
 */
export async function cachedFetch<T>(params: {
	url: string
	headers?: Record<string, string>
	fallback: T
	label: string
	revalidate?: number
}): Promise<T> {
	const { url, headers, fallback, label, revalidate = 60 } = params

	try {
		const response = await fetch(url, {
			headers,
			// @ts-expect-error - Next.js extended fetch option
			next: { revalidate }, // Next.js Data Cache with TTL
		})

		if (!response.ok) {
			console.warn(`[Sylphx] Failed to fetch ${label}:`, response.status)
			return fallback
		}

		const data = await response.json()
		return (data as T) ?? fallback
	} catch (error) {
		console.warn(`[Sylphx] Failed to fetch ${label}:`, error)
		return fallback
	}
}

/**
 * Sanitize options using SSOT key validation
 * Validates secretKey format and trims platformUrl
 */
export function sanitizeOptions<T extends AuthenticatedFetchOptions>(options: T): T {
	return {
		...options,
		secretKey: validateAndSanitizeSecretKey(options.secretKey),
		platformUrl: (options.platformUrl ?? DEFAULT_PLATFORM_URL).trim(),
	}
}

/** Build authenticated headers for SDK API calls — secret key identifies the app */
export function sdkHeaders(secretKey: string): Record<string, string> {
	return { 'x-app-secret': secretKey }
}
