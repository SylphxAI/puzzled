/**
 * Admin Utilities
 *
 * Server-side utilities for admin access control.
 *
 * ARCHITECTURE:
 * - User data (including role) comes from platform SDK
 * - No local users table - platform is source of truth
 */

import { auth } from '@sylphx/sdk/nextjs'
import { isAdminRole, isSuperAdminRole } from '@/lib/roles'

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
 * Check if a role has admin privileges
 */
function hasAdminRole(role: string | null | undefined): boolean {
	return isAdminRole(role)
}

/**
 * Check if a role has super_admin privileges
 */
function hasSuperAdminRole(role: string | null | undefined): boolean {
	return isSuperAdminRole(role)
}

/**
 * Require admin access - throws AdminError if not admin
 */
export async function requireAdmin() {
	const { userId, user } = await getSession()

	if (!userId || !user) {
		throw new AdminError('NOT_LOGGED_IN', 'You must be logged in to access this page.')
	}

	if (!hasAdminRole(user.role)) {
		throw new AdminError('NOT_ADMIN', 'You do not have admin privileges.')
	}

	return { userId, user }
}

/**
 * Get admin user or null
 */
async function getAdminUser() {
	try {
		const { user } = await requireAdmin()
		return user
	} catch {
		return null
	}
}
