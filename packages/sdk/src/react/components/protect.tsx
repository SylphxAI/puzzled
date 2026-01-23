/**
 * Protect Component
 *
 * Role-based access control wrapper (similar to Clerk's <Protect>).
 * Renders children only if user meets the required conditions.
 *
 * Usage:
 * ```tsx
 * // Require signed in
 * <Protect>
 *   <ProtectedContent />
 * </Protect>
 *
 * // Require specific role
 * <Protect role="admin">
 *   <AdminPanel />
 * </Protect>
 *
 * // Require any of multiple roles
 * <Protect roles={['admin', 'billing']}>
 *   <BillingDashboard />
 * </Protect>
 *
 * // Require premium subscription
 * <Protect premium>
 *   <PremiumFeature />
 * </Protect>
 *
 * // Custom permission check
 * <Protect permission="manage:users">
 *   <UserManagement />
 * </Protect>
 *
 * // Custom condition
 * <Protect condition={(user) => user.email?.endsWith('@company.com')}>
 *   <InternalTool />
 * </Protect>
 *
 * // With fallback
 * <Protect role="admin" fallback={<NoAccess />}>
 *   <AdminPanel />
 * </Protect>
 * ```
 */

'use client'

import { type ReactNode, useContext } from 'react'
import { useSafeAuth, useSafeUser, useSdkReady } from '../hooks'
import { PlatformContext } from '../platform-context'
import type { User } from '../../types'

/**
 * Internal hook to get platform context for Protect component (safe version)
 */
function useSafePlatformContext() {
	const context = useContext(PlatformContext)
	return context // Returns null if not configured, doesn't throw
}

// Standard role types (can be extended via platform admin)
export type StandardRole =
	| 'super_admin'
	| 'admin'
	| 'billing'
	| 'analytics'
	| 'developer'
	| 'viewer'
	| 'member'

export interface ProtectProps {
	children: ReactNode

	/**
	 * Fallback content when access is denied (default: null)
	 */
	fallback?: ReactNode

	/**
	 * Require user to be signed in (default: true)
	 */
	signedIn?: boolean

	/**
	 * Require user to have a specific role
	 */
	role?: StandardRole | string

	/**
	 * Require user to have any of the specified roles
	 */
	roles?: (StandardRole | string)[]

	/**
	 * Require user to have a specific permission
	 * Permissions are checked against the user's role
	 */
	permission?: string

	/**
	 * Require user to have premium/paid subscription
	 */
	premium?: boolean

	/**
	 * Custom condition function
	 * Return true to allow access, false to deny
	 */
	condition?: (user: User) => boolean

	/**
	 * Loading component while auth state is loading
	 */
	loading?: ReactNode
}

// Role hierarchy for inheritance checks
const ROLE_HIERARCHY: Record<string, number> = {
	super_admin: 100,
	admin: 80,
	billing: 60,
	analytics: 50,
	developer: 40,
	viewer: 20,
	member: 10,
}

// Permission mappings per role
const ROLE_PERMISSIONS: Record<string, string[]> = {
	super_admin: ['*'], // All permissions
	admin: ['manage:apps', 'manage:users', 'view:analytics', 'view:billing', 'manage:settings'],
	billing: ['view:billing', 'manage:billing'],
	analytics: ['view:analytics', 'export:analytics'],
	developer: ['manage:apps', 'view:analytics'],
	viewer: ['view:analytics'],
	member: [],
}

/**
 * Check if a role has a specific permission
 */
function roleHasPermission(role: string, permission: string): boolean {
	const permissions = ROLE_PERMISSIONS[role] || []
	// Super admin has all permissions
	if (permissions.includes('*')) return true
	// Check exact match
	if (permissions.includes(permission)) return true
	// Check wildcard match (e.g., "manage:*" matches "manage:users")
	const [action, resource] = permission.split(':')
	if (permissions.includes(`${action}:*`)) return true
	if (permissions.includes(`*:${resource}`)) return true
	return false
}

/**
 * Check if user has required role
 */
function hasRole(userRole: string | undefined, requiredRole: string): boolean {
	if (!userRole) return false
	if (userRole === requiredRole) return true

	// Check role hierarchy - higher roles inherit lower role access
	const userLevel = ROLE_HIERARCHY[userRole] ?? 0
	const requiredLevel = ROLE_HIERARCHY[requiredRole] ?? 0

	return userLevel >= requiredLevel
}

/**
 * Check if user has any of the required roles
 */
function hasAnyRole(userRole: string | undefined, requiredRoles: string[]): boolean {
	if (!userRole) return false
	return requiredRoles.some((role) => hasRole(userRole, role))
}

export function Protect({
	children,
	fallback = null,
	signedIn = true,
	role,
	roles,
	permission,
	premium,
	condition,
	loading = null,
}: ProtectProps) {
	// SDK readiness check - silent fallback if not configured
	const { isReady } = useSdkReady({
		services: ['auth', 'user'],
		componentType: 'protect',
		fallback: 'null', // Silent - just render fallback if not configured
	})

	const { isSignedIn } = useSafeAuth()
	const { user, isLoaded } = useSafeUser()
	const platformContext = useSafePlatformContext()
	const subscription = platformContext?.subscription

	// If SDK not ready, render fallback (silent behavior)
	if (!isReady) {
		return <>{fallback}</>
	}

	// Show loading while auth state is being determined
	if (!isLoaded) {
		return <>{loading}</>
	}

	// Check signed in requirement
	if (signedIn && !isSignedIn) {
		return <>{fallback}</>
	}

	// If not requiring sign in and user is not signed in, allow access
	if (!signedIn && !isSignedIn) {
		return <>{children}</>
	}

	// At this point, user should be signed in
	if (!user) {
		return <>{fallback}</>
	}

	// Check role requirement
	if (role && !hasRole(user.role, role)) {
		return <>{fallback}</>
	}

	// Check roles (any of) requirement
	if (roles && roles.length > 0 && !hasAnyRole(user.role, roles)) {
		return <>{fallback}</>
	}

	// Check permission requirement
	if (permission && !roleHasPermission(user.role || 'member', permission)) {
		return <>{fallback}</>
	}

	// Check premium requirement
	if (premium) {
		const isPremium =
			subscription?.status === 'active' || subscription?.status === 'trialing'
		if (!isPremium) {
			return <>{fallback}</>
		}
	}

	// Check custom condition
	if (condition && !condition(user)) {
		return <>{fallback}</>
	}

	// All checks passed - render children
	return <>{children}</>
}

// Convenience components for common patterns
export function SignedIn({ children }: { children: ReactNode }) {
	return <Protect signedIn>{children}</Protect>
}

export function SignedOut({ children }: { children: ReactNode }) {
	return <Protect signedIn={false}>{children}</Protect>
}

export function AdminOnly({
	children,
	fallback,
}: {
	children: ReactNode
	fallback?: ReactNode
}) {
	return (
		<Protect role="admin" fallback={fallback}>
			{children}
		</Protect>
	)
}

export function PremiumOnly({
	children,
	fallback,
}: {
	children: ReactNode
	fallback?: ReactNode
}) {
	return (
		<Protect premium fallback={fallback}>
			{children}
		</Protect>
	)
}

// Hook for programmatic access checks
export function useProtect() {
	const { isSignedIn } = useSafeAuth()
	const { user, isLoaded, isConfigured } = useSafeUser()
	const platformContext = useSafePlatformContext()
	const subscription = platformContext?.subscription

	return {
		isLoaded,
		isSignedIn,
		isConfigured, // SDK configuration status
		user,

		/**
		 * Check if user has a specific role
		 */
		hasRole: (requiredRole: string) => hasRole(user?.role, requiredRole),

		/**
		 * Check if user has any of the specified roles
		 */
		hasAnyRole: (requiredRoles: string[]) => hasAnyRole(user?.role, requiredRoles),

		/**
		 * Check if user has a specific permission
		 */
		hasPermission: (requiredPermission: string) =>
			roleHasPermission(user?.role || 'member', requiredPermission),

		/**
		 * Check if user has premium subscription
		 */
		isPremium:
			subscription?.status === 'active' || subscription?.status === 'trialing',

		/**
		 * Check custom condition
		 */
		check: (condition: (user: User | null) => boolean) => condition(user),
	}
}
