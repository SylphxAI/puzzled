/**
 * Authentication Middleware
 *
 * Verifies user authentication via Sylphx Platform SDK.
 * Sets user context for downstream handlers.
 */

import { auth } from '@sylphx/sdk/nextjs'
import { createMiddleware } from 'hono/factory'
import { HTTPException } from 'hono/http-exception'
import type { PuzzledAuthEnv } from '../types'

/**
 * Authentication middleware
 *
 * Requires user to be authenticated via Sylphx SDK.
 * Throws 401 if not authenticated.
 */
export const authMiddleware = createMiddleware<PuzzledAuthEnv>(async (c, next) => {
	const { userId, user, sessionToken } = await auth()

	if (!userId || !user) {
		throw new HTTPException(401, {
			message: 'You must be logged in to perform this action',
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
 * Optional auth middleware
 *
 * Attempts to get user context but doesn't require authentication.
 * Useful for endpoints that behave differently for authenticated users.
 */
export const optionalAuthMiddleware = createMiddleware<PuzzledAuthEnv>(async (c, next) => {
	try {
		const { userId, user, sessionToken } = await auth()

		if (userId && user) {
			c.set('user', user)
			c.set('userId', userId)
			c.set('sessionToken', sessionToken)
		}
	} catch {
		// Auth failed, continue without user context
	}

	await next()
})
