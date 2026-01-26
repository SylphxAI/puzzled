/**
 * Server-side Error Tracking
 *
 * Logs errors to console for now. Platform monitoring endpoint not yet available.
 *
 * For client-side React components, use:
 * - useErrorTracking from '@sylphx/sdk/react'
 * - ErrorBoundary from '@sylphx/sdk/react'
 */

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
	},
): Promise<string | null> {
	// Log to console - platform monitoring endpoint not yet available
	console.error('[Monitoring] Error:', error, context)
	return null
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
	},
): Promise<string | null> {
	// Log to console - platform monitoring endpoint not yet available
	console.log(`[Monitoring] ${options?.level ?? 'info'}: ${message}`, options?.extra)
	return null
}

/**
 * Capture error in request handler (convenience wrapper)
 */
async function captureRequestError(
	error: Error,
	request: Request,
	context?: {
		tags?: Record<string, string>
		extra?: Record<string, unknown>
	},
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
				['user-agent', 'referer', 'accept-language'].map((h) => [h, request.headers.get(h)]),
			),
		},
	})
}
