/**
 * Admin Utilities
 *
 * Server-side utilities for admin access control.
 *
 * ARCHITECTURE:
 * - User data (including role) comes from platform SDK
 * - No local users table - platform is source of truth
 */

import { getServerIsAdmin } from '@/lib/api/server'
import { auth } from '@/lib/identity/server'

/** Admin error codes */
export type AdminErrorCode = 'NOT_LOGGED_IN' | 'NOT_ADMIN' | 'FORBIDDEN'

/** Admin error class */
export class AdminError extends Error {
	constructor(
		public code: AdminErrorCode,
		message: string,
	) {
		super(message)
		this.name = 'AdminError'
	}
}

/**
 * Get current session (server-side)
 */
async function getSession() {
	return auth()
}

/**
 * Require admin access - throws AdminError if not admin
 */
export async function requireAdmin() {
	const { userId, user } = await getSession()

	if (!userId || !user) {
		throw new AdminError('NOT_LOGGED_IN', 'You must be logged in to access this page.')
	}

	// The api decides admin (its is_admin), the same source as every admin RPC.
	if (!(await getServerIsAdmin())) {
		throw new AdminError('NOT_ADMIN', 'You do not have admin privileges.')
	}

	return { userId, user }
}
