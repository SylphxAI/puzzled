import { eq } from 'drizzle-orm'
import { auth } from '@sylphx/platform-sdk/nextjs'
import { db } from '@/lib/db'
import { type User, users } from '@/lib/db/schema'
import { isAdminRole, isSuperAdminRole } from '@/lib/roles'

// Typed admin errors for proper handling in UI
export type AdminErrorCode = 'NOT_LOGGED_IN' | 'NOT_ADMIN' | 'MFA_NOT_ENABLED' | 'MFA_NOT_VERIFIED'

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
export async function getSession() {
	const session = await auth()
	return session
}

/**
 * Check if a role has admin privileges
 * Re-exports from SSOT for backward compatibility
 */
export function hasAdminRole(role: User['role'] | null | undefined): boolean {
	return isAdminRole(role)
}

/**
 * Check if a role has super_admin privileges
 * Re-exports from SSOT for backward compatibility
 */
export function hasSuperAdminRole(role: User['role'] | null | undefined): boolean {
	return isSuperAdminRole(role)
}

/**
 * Check if current user is admin (admin or super_admin)
 */
export async function isAdmin(): Promise<boolean> {
	const { userId } = await getSession()
	if (!userId) return false

	const user = await db.query.users.findFirst({
		where: eq(users.id, userId),
	})

	return hasAdminRole(user?.role)
}

/**
 * Check if current user is super_admin
 */
export async function isSuperAdmin(): Promise<boolean> {
	const { userId } = await getSession()
	if (!userId) return false

	const user = await db.query.users.findFirst({
		where: eq(users.id, userId),
	})

	return hasSuperAdminRole(user?.role)
}

/**
 * Require admin access - throws AdminError with specific codes
 * Note: MFA is now handled by the platform SDK
 */
export async function requireAdmin() {
	const { userId } = await getSession()
	if (!userId) {
		throw new AdminError('NOT_LOGGED_IN', 'You must be logged in to access this page.')
	}

	// Fetch user
	const user = await db.query.users.findFirst({
		where: eq(users.id, userId),
	})

	if (!hasAdminRole(user?.role)) {
		throw new AdminError('NOT_ADMIN', 'You do not have admin privileges.')
	}

	// TODO: MFA enforcement is now handled by the platform
	// If MFA is required for admin access, the platform SDK should handle it

	return { userId, user: user! }
}

/**
 * Require super_admin access - throws AdminError with specific codes
 * Note: MFA is now handled by the platform SDK
 */
export async function requireSuperAdmin() {
	const { userId } = await getSession()
	if (!userId) {
		throw new AdminError('NOT_LOGGED_IN', 'You must be logged in to access this page.')
	}

	// Fetch user
	const user = await db.query.users.findFirst({
		where: eq(users.id, userId),
	})

	if (!hasSuperAdminRole(user?.role)) {
		throw new AdminError('NOT_ADMIN', 'You do not have super admin privileges.')
	}

	// TODO: MFA enforcement is now handled by the platform
	// If MFA is required for super admin access, the platform SDK should handle it

	return { userId, user: user! }
}

/**
 * Get admin user or null
 */
export async function getAdminUser() {
	try {
		const { user } = await requireAdmin()
		return user
	} catch {
		return null
	}
}
