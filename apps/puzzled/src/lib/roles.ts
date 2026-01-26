/**
 * Role Utilities
 *
 * Role definitions and utilities for admin access control.
 * Roles are managed by the platform, we just check them here.
 *
 * ARCHITECTURE:
 * - Roles come from platform SDK (user.role)
 * - Apps don't manage roles, platform does
 * - This file provides utility functions for role checking
 */

/** User role type from platform */
type UserRole = 'user' | 'admin' | 'super_admin'

/** Role hierarchy for comparison (higher = more powerful) */
const ROLE_LEVELS = {
	user: 1,
	admin: 2,
	super_admin: 3,
} as const

/**
 * Check if a role has admin privileges (admin or super_admin)
 */
export function isAdminRole(role: string | null | undefined): boolean {
	if (!role) return false
	return role === 'admin' || role === 'super_admin'
}

/**
 * Check if a role has super_admin privileges
 */
export function isSuperAdminRole(role: string | null | undefined): boolean {
	return role === 'super_admin'
}

/**
 * Check if roleA has at least the same level as roleB
 */
function hasMinimumRole(roleA: string | null | undefined, roleB: UserRole): boolean {
	if (!roleA) return false
	const levelA = ROLE_LEVELS[roleA as UserRole] ?? 0
	const levelB = ROLE_LEVELS[roleB]
	return levelA >= levelB
}

/**
 * Check if roleA has a higher level than roleB
 */
function hasHigherRole(roleA: string | null | undefined, roleB: string | null | undefined): boolean {
	if (!roleA) return false
	if (!roleB) return true
	const levelA = ROLE_LEVELS[roleA as UserRole] ?? 0
	const levelB = ROLE_LEVELS[roleB as UserRole] ?? 0
	return levelA > levelB
}
