/**
 * Server-side Error Tracking
 *
 * Uses Sylphx Platform SDK for self-hosted error tracking.
 * This replaces Sentry for server-side error capture.
 *
 * For client-side React components, use:
 * - useErrorTracking from '@sylphx/platform-sdk/react'
 * - ErrorBoundary from '@sylphx/platform-sdk/react'
 */

import { createServerClient } from '@sylphx/platform-sdk/server'

// Singleton instance (lazy initialized)
let client: ReturnType<typeof createServerClient> | null = null

/**
 * Get the monitoring client
 * Returns null if SDK is not configured (dev without credentials)
 */
function getClient(): ReturnType<typeof createServerClient> | null {
	if (client) return client

	const appId = process.env.SYLPHX_APP_ID || process.env.NEXT_PUBLIC_SYLPHX_APP_ID
	const appSecret = process.env.SYLPHX_SECRET_KEY

	if (!appId || !appSecret) {
		// SDK not configured - silently skip in development
		if (process.env.NODE_ENV === 'development') {
			return null
		}
		console.warn('[Monitoring] Missing SYLPHX_APP_ID or SYLPHX_APP_SECRET')
		return null
	}

	client = createServerClient({
		appId,
		appSecret,
		platformUrl: process.env.NEXT_PUBLIC_SYLPHX_URL || 'https://sylphx.com',
	})

	return client
}

/**
 * Capture an error with context
 *
 * @example
 * ```typescript
 * try {
 *   await riskyOperation()
 * } catch (error) {
 *   captureError(error, {
 *     tags: { feature: 'checkout' },
 *     extra: { orderId: '123' },
 *   })
 * }
 * ```
 */
export async function captureError(
	error: Error | string,
	context?: {
		tags?: Record<string, string>
		extra?: Record<string, unknown>
		level?: 'fatal' | 'error' | 'warning' | 'info'
		route?: string
	}
): Promise<string | null> {
	const monitoring = getClient()
	if (!monitoring) {
		// Log to console in development
		console.error('[Monitoring] Error:', error, context)
		return null
	}

	try {
		const err = typeof error === 'string' ? new Error(error) : error

		const result = await monitoring.monitoring.captureException(err, {
			level: context?.level ?? 'error',
			tags: context?.tags,
			extra: context?.extra,
			route: context?.route,
		})

		return result.eventId
	} catch (e) {
		// Don't throw on monitoring failure - just log
		console.error('[Monitoring] Failed to capture error:', e)
		return null
	}
}

/**
 * Capture a message (log entry)
 *
 * @example
 * ```typescript
 * captureMessage('Payment retry scheduled', {
 *   level: 'warning',
 *   tags: { service: 'billing' },
 * })
 * ```
 */
export async function captureMessage(
	message: string,
	options?: {
		level?: 'fatal' | 'error' | 'warning' | 'info'
		tags?: Record<string, string>
		extra?: Record<string, unknown>
		route?: string
	}
): Promise<string | null> {
	const monitoring = getClient()
	if (!monitoring) {
		// Log to console in development
		console.log(`[Monitoring] ${options?.level ?? 'info'}: ${message}`, options?.extra)
		return null
	}

	try {
		const result = await monitoring.monitoring.captureMessage(message, {
			level: options?.level ?? 'info',
			tags: options?.tags,
			extra: options?.extra,
			route: options?.route,
		})

		return result.eventId
	} catch (e) {
		// Don't throw on monitoring failure - just log
		console.error('[Monitoring] Failed to capture message:', e)
		return null
	}
}

/**
 * Capture error in request handler (convenience wrapper)
 */
export async function captureRequestError(
	error: Error,
	request: Request,
	context?: {
		tags?: Record<string, string>
		extra?: Record<string, unknown>
	}
): Promise<string | null> {
	return captureError(error, {
		...context,
		route: new URL(request.url).pathname,
		tags: {
			...context?.tags,
			method: request.method,
		},
		extra: {
			...context?.extra,
			url: request.url,
			headers: Object.fromEntries(
				['user-agent', 'referer', 'accept-language'].map((h) => [h, request.headers.get(h)])
			),
		},
	})
}
