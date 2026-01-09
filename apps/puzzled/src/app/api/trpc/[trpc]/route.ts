/**
 * tRPC API Route Handler
 *
 * Handles all tRPC requests via the fetch adapter.
 * Supports both GET (queries) and POST (mutations) requests.
 */

// Node.js runtime for tRPC context
export const runtime = 'nodejs'

import * as Sentry from '@sentry/nextjs'
import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { createContext } from '@/server/context'
import { appRouter } from '@/server/routers'

/**
 * Request handler configuration
 */
const handler = (req: Request) =>
	fetchRequestHandler({
		endpoint: '/api/trpc',
		req,
		router: appRouter,
		createContext,
		onError: ({ path, error, type, ctx }) => {
			// Always log in development
			if (process.env.NODE_ENV === 'development') {
				console.error(`❌ tRPC failed on ${path ?? '<no-path>'}: ${error.message}`)
			}

			// Report to Sentry in production (skip expected client errors)
			if (process.env.NODE_ENV === 'production') {
				// Don't report expected auth errors (401/403) or not found (404)
				const isExpectedError = ['UNAUTHORIZED', 'FORBIDDEN', 'NOT_FOUND'].includes(error.code)
				if (!isExpectedError) {
					Sentry.captureException(error, {
						tags: {
							trpc_path: path ?? 'unknown',
							trpc_type: type,
							error_code: error.code,
						},
						extra: {
							// Include user context if available (without PII)
							userId: ctx?.userId,
						},
					})
				}
			}
		},
	})

export { handler as GET, handler as POST }
