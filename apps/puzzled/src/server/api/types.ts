/**
 * Puzzled Hono App Types
 *
 * Type definitions for the Puzzled API context and environment.
 * Auth is handled by Sylphx Platform SDK (100% dogfooding).
 */

import type { AuthResult } from '@sylphx/sdk/nextjs'

/**
 * Platform user from SDK auth result
 */
export type User = NonNullable<AuthResult['user']>

/**
 * User role types (matches Platform SDK)
 */
export type UserRole =
	| 'super_admin'
	| 'admin'
	| 'billing'
	| 'analytics'
	| 'developer'
	| 'viewer'
	| 'member'

/**
 * Hono environment for public routes (no auth required)
 */
export type PuzzledEnv = {
	Variables: {
		/** Request headers */
		headers: Headers
	}
}

/**
 * Hono environment for authenticated routes
 */
export type PuzzledAuthEnv = {
	Variables: {
		/** Authenticated platform user */
		user: User
		/** User ID shortcut */
		userId: string
		/** Session token for SDK API calls */
		sessionToken: string | null
		/** Request headers */
		headers: Headers
	}
}

/**
 * Hono environment for admin-only routes
 * Requires admin or super_admin role
 */
export type PuzzledAdminEnv = PuzzledAuthEnv
