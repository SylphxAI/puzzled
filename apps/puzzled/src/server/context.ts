/**
 * tRPC Context
 *
 * Creates the context that is available in all tRPC procedures.
 * Includes auth session and database access.
 */

import type { FetchCreateContextFnOptions } from '@trpc/server/adapters/fetch'
import { headers } from 'next/headers'
import { auth } from '@/features/auth/server'

/**
 * Context available to all procedures
 */
export type Context = {
	session: Awaited<ReturnType<typeof auth.api.getSession>> | null
	headers: Headers
}

/**
 * Create context for each request
 * Called by tRPC for every incoming request
 */
export async function createContext(_opts?: FetchCreateContextFnOptions): Promise<Context> {
	const headersList = await headers()

	// Get session from better-auth
	const session = await auth.api.getSession({
		headers: headersList,
	})

	return {
		session,
		headers: headersList,
	}
}

/**
 * Helper type for inferring context
 */
export type CreateContext = typeof createContext
