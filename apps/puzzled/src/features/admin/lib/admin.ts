import { eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { auth } from '@/features/auth/server'
import { db } from '@/lib/db'
import { sessions, type User, users } from '@/lib/db/schema'
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
	const session = await auth.api.getSession({
		headers: await headers(),
	})
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
	const session = await getSession()
	if (!session?.user?.id) return false

	const user = await db.query.users.findFirst({
		where: eq(users.id, session.user.id),
	})

	return hasAdminRole(user?.role)
}

/**
 * Check if current user is super_admin
 */
export async function isSuperAdmin(): Promise<boolean> {
	const session = await getSession()
	if (!session?.user?.id) return false

	const user = await db.query.users.findFirst({
		where: eq(users.id, session.user.id),
	})

	return hasSuperAdminRole(user?.role)
}

/**
 * Require admin access - throws AdminError with specific codes
 * Per spec: MFA required for admin and super_admin roles
 */
export async function requireAdmin() {
	const session = await getSession()
	if (!session?.user?.id) {
		throw new AdminError('NOT_LOGGED_IN', 'You must be logged in to access this page.')
	}

	// Fetch user with MFA status
	const user = await db.query.users.findFirst({
		where: eq(users.id, session.user.id),
	})

	if (!hasAdminRole(user?.role)) {
		throw new AdminError('NOT_ADMIN', 'You do not have admin privileges.')
	}

	// Per spec: MFA required for admin and super_admin roles
	if (!user?.twoFactorEnabled) {
		throw new AdminError(
			'MFA_NOT_ENABLED',
			'Two-factor authentication must be enabled for admin access. Please set up MFA in your account settings.',
		)
	}

	// Check if current session has verified MFA
	const currentSession = await db.query.sessions.findFirst({
		where: eq(sessions.token, session.session.token),
	})

	if (!currentSession?.twoFactorVerified) {
		throw new AdminError(
			'MFA_NOT_VERIFIED',
			'Please verify your two-factor authentication to access admin features.',
		)
	}

	return { session, user: user! }
}

/**
 * Require super_admin access - throws AdminError with specific codes
 * Per spec: MFA required for super_admin role
 */
export async function requireSuperAdmin() {
	const session = await getSession()
	if (!session?.user?.id) {
		throw new AdminError('NOT_LOGGED_IN', 'You must be logged in to access this page.')
	}

	// Fetch user with MFA status
	const user = await db.query.users.findFirst({
		where: eq(users.id, session.user.id),
	})

	if (!hasSuperAdminRole(user?.role)) {
		throw new AdminError('NOT_ADMIN', 'You do not have super admin privileges.')
	}

	// Per spec: MFA required for super_admin role
	if (!user?.twoFactorEnabled) {
		throw new AdminError(
			'MFA_NOT_ENABLED',
			'Two-factor authentication must be enabled for super admin access.',
		)
	}

	// Check if current session has verified MFA
	const currentSession = await db.query.sessions.findFirst({
		where: eq(sessions.token, session.session.token),
	})

	if (!currentSession?.twoFactorVerified) {
		throw new AdminError(
			'MFA_NOT_VERIFIED',
			'Please verify your two-factor authentication to access super admin features.',
		)
	}

	return { session, user: user! }
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
