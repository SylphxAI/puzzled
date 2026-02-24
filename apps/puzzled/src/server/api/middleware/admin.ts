/**
 * Admin Authorization Middleware
 *
 * Verifies user has admin privileges.
 * Combines auth check with role verification.
 */

import { auth } from '@sylphx/sdk/nextjs'
import { createMiddleware } from 'hono/factory'
import { HTTPException } from 'hono/http-exception'
import type { PuzzledAuthEnv } from '../types'

/**
 * Role hierarchy for permission inheritance
 * Higher level = more permissions
 */
const ROLE_HIERARCHY: Record<string, number> = {
	super_admin: 100,
	admin: 80,
	billing: 60,
	analytics: 50,
	developer: 40,
	viewer: 20,
	member: 10,
}

/**
 * Check if user has the required role (with hierarchy support)
 */
function hasRole(userRole: string | undefined, requiredRole: string): boolean {
	if (!userRole) return false
	if (userRole === requiredRole) return true

	// Higher roles inherit lower role access
	const userLevel = ROLE_HIERARCHY[userRole] ?? 0
	const requiredLevel = ROLE_HIERARCHY[requiredRole] ?? 0
	return userLevel >= requiredLevel
}

/**
 * Admin middleware
 *
 * Requires user to be authenticated and have admin or super_admin role.
 */
export const adminMiddleware = createMiddleware<PuzzledAuthEnv>(async (c, next) => {
	const { userId, user, sessionToken } = await auth()

	if (!userId || !user) {
		throw new HTTPException(401, { message: 'You must be logged in' })
	}

	if (!hasRole(user.role, 'admin')) {
		throw new HTTPException(403, {
			message: 'You need admin privileges to perform this action',
		})
	}

	// Set authenticated context
	c.set('user', user)
	c.set('userId', userId)
	c.set('sessionToken', sessionToken)
	c.set('headers', c.get('headers'))

	await next()
})

/**
 * Super admin middleware
 *
 * Requires user to be authenticated and have super_admin role.
 */
export const superAdminMiddleware = createMiddleware<PuzzledAuthEnv>(async (c, next) => {
	const { userId, user, sessionToken } = await auth()

	if (!userId || !user) {
		throw new HTTPException(401, { message: 'You must be logged in' })
	}

	if (!hasRole(user.role, 'super_admin')) {
		throw new HTTPException(403, {
			message: 'You need super admin privileges to perform this action',
		})
	}

	// Set authenticated context
	c.set('user', user)
	c.set('userId', userId)
	c.set('sessionToken', sessionToken)
	c.set('headers', c.get('headers'))

	await next()
})
