/**
 * Logging Middleware
 *
 * Logs all requests in development for debugging.
 * Minimal overhead in production.
 */

import { createMiddleware } from 'hono/factory'
import type { PuzzledEnv } from '../types'

/**
 * Request logging middleware
 *
 * Logs request method, path, and duration.
 * Only active in development to avoid production noise.
 */
export const loggerMiddleware = createMiddleware<PuzzledEnv>(async (c, next) => {
	// Skip logging in production
	if (process.env.NODE_ENV !== 'development') {
		return next()
	}

	const start = Date.now()
	const method = c.req.method
	const path = c.req.path

	await next()

	const duration = Date.now() - start
	const status = c.res.status

	// Color-coded output based on status
	const statusColor = status >= 500 ? '\x1b[31m' : status >= 400 ? '\x1b[33m' : '\x1b[32m'
	const reset = '\x1b[0m'

	console.log(`[API] ${method} ${path} - ${statusColor}${status}${reset} (${duration}ms)`)
})
