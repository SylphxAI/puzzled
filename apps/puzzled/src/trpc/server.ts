/**
 * tRPC Server Caller
 *
 * Creates a server-side caller for use in:
 * - React Server Components (RSC)
 * - Server Actions
 * - API Routes
 *
 * This bypasses HTTP and calls procedures directly for better performance.
 */

import 'server-only'
import { cache } from 'react'
import { createContext } from '@/server/context'
import { appRouter } from '@/server/routers'

/**
 * Create a cached server-side tRPC caller
 *
 * Uses React's cache() to dedupe calls within the same request.
 * Each request gets its own caller with proper context.
 *
 * @example
 * // In a Server Component
 * const caller = await createServerCaller()
 * const stats = await caller.stats.getUserStats()
 *
 * @example
 * // In a Server Action
 * const caller = await createServerCaller()
 * await caller.games.saveResult({ ... })
 */
export const createServerCaller = cache(async () => {
	const context = await createContext()
	return appRouter.createCaller(context)
})

/**
 * Type helper for the server caller
 */
export type ServerCaller = Awaited<ReturnType<typeof createServerCaller>>
