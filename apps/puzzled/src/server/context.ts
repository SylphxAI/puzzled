/**
 * tRPC Context
 *
 * Creates the context that is available in all tRPC procedures.
 * Uses Sylphx Platform SDK for authentication.
 */

import { type AuthResult, auth } from '@sylphx/sdk/nextjs'
import type { FetchCreateContextFnOptions } from '@trpc/server/adapters/fetch'
import { headers } from 'next/headers'

/**
 * Platform user (from auth result)
 */
type User = NonNullable<AuthResult['user']>

/**
 * Context available to all procedures
 */
export type Context = {
	user: User | null
	userId: string | null
	accessToken: string | null
	headers: Headers
}

/**
 * Create context for each request
 * Called by tRPC for every incoming request
 */
export async function createContext(_opts?: FetchCreateContextFnOptions): Promise<Context> {
	const headersList = await headers()

	// Get auth from Sylphx Platform SDK
	const { userId, user, accessToken } = await auth()

	return {
		user,
		userId,
		accessToken,
		headers: headersList,
	}
}

/**
 * Helper type for inferring context
 */
type CreateContext = typeof createContext
