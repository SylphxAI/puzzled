/**
 * Role-Based Access Control (RBAC)
 *
 * Defines roles and permissions for the application.
 * UserRole type is derived from schema (SSOT).
 */

import type { UserRole } from '@/lib/db/schema'

// Re-export UserRole from schema (SSOT)
export type { UserRole }

// Role constants
export const ROLE_USER = 'user' as const
export const ROLE_ADMIN = 'admin' as const
export const ROLE_SUPER_ADMIN = 'super_admin' as const

// Admin roles that require elevated privileges
export const ADMIN_ROLES = [ROLE_ADMIN, ROLE_SUPER_ADMIN] as const
export type AdminRole = (typeof ADMIN_ROLES)[number]

// All roles in the system
export const ALL_ROLES = [ROLE_USER, ROLE_ADMIN, ROLE_SUPER_ADMIN] as const

/**
 * Check if a role has admin privileges (admin or super_admin)
 */
export function isAdminRole(role: string | null | undefined): role is AdminRole {
	return role != null && ADMIN_ROLES.includes(role as AdminRole)
}

/**
 * Check if a role is super_admin
 */
export function isSuperAdminRole(role: string | null | undefined): boolean {
	return role === ROLE_SUPER_ADMIN
}

/**
 * Role hierarchy for permission checks
 */
export const ROLE_HIERARCHY = {
	super_admin: 3,
	admin: 2,
	user: 1,
} as const

/**
 * Check if user role has at least the required level
 */
export function hasRoleAtLeast(
	userRole: string | null | undefined,
	requiredRole: UserRole
): boolean {
	if (!userRole) return false
	const userLevel = ROLE_HIERARCHY[userRole as UserRole] ?? 0
	const requiredLevel = ROLE_HIERARCHY[requiredRole] ?? 0
	return userLevel >= requiredLevel
}
