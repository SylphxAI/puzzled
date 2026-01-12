/**
 * tRPC Server Configuration
 *
 * This file initializes tRPC and defines reusable procedures with middleware.
 * All routers import from this file.
 *
 * Auth is handled by Sylphx Platform SDK - no local session/user tables.
 */

import { initTRPC, TRPCError } from '@trpc/server'
import superjson from 'superjson'
import { ZodError } from 'zod'
import { ratelimit } from '@/lib/redis'
import type { Context } from './context'

/**
 * Initialize tRPC with context and transformer
 */
const t = initTRPC.context<Context>().create({
	transformer: superjson,
	errorFormatter({ shape, error }) {
		return {
			...shape,
			data: {
				...shape.data,
				zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
			},
		}
	},
})

/**
 * Create router and procedure helpers
 */
export const router = t.router
export const middleware = t.middleware
export const mergeRouters = t.mergeRouters

/**
 * Public procedure - no authentication required
 * Use for public data like leaderboards
 */
export const publicProcedure = t.procedure

/**
 * Logging middleware - logs all requests
 */
const loggerMiddleware = middleware(async ({ path, type, next }) => {
	const start = Date.now()
	const result = await next()
	const duration = Date.now() - start

	// Only log in development to avoid production noise
	// Errors are tracked via Sentry in production
	if (process.env.NODE_ENV === 'development') {
		if (result.ok) {
			console.log(`[tRPC] ${type} ${path} - OK (${duration}ms)`)
		} else {
			console.error(`[tRPC] ${type} ${path} - ERROR (${duration}ms)`)
		}
	}

	return result
})

/**
 * Auth middleware - ensures user is authenticated via Sylphx Platform
 */
const authMiddleware = middleware(async ({ ctx, next }) => {
	if (!ctx.user || !ctx.userId) {
		throw new TRPCError({
			code: 'UNAUTHORIZED',
			message: 'You must be logged in to perform this action',
		})
	}

	return next({
		ctx: {
			...ctx,
			// Narrow types to non-null
			user: ctx.user,
			userId: ctx.userId,
		},
	})
})

/**
 * Rate limiting middleware - prevents abuse
 * Default: 10 requests per 10 seconds
 */
const rateLimitMiddleware = middleware(async ({ ctx, next }) => {
	if (!ctx.userId) {
		// Use IP-based rate limiting for unauthenticated requests
		const ip = ctx.headers.get('x-forwarded-for') ?? 'anonymous'
		const result = await ratelimit.limit(`anon:${ip}`)
		if (!result.success) {
			throw new TRPCError({
				code: 'TOO_MANY_REQUESTS',
				message: 'Too many requests. Please try again later.',
			})
		}
	} else {
		// Use user-based rate limiting for authenticated requests
		const result = await ratelimit.limit(`user:${ctx.userId}`)
		if (!result.success) {
			throw new TRPCError({
				code: 'TOO_MANY_REQUESTS',
				message: 'Too many requests. Please try again later.',
			})
		}
	}

	return next()
})

/**
 * Protected procedure - requires authentication
 * Use for user-specific operations
 */
export const protectedProcedure = t.procedure.use(loggerMiddleware).use(authMiddleware)

/**
 * Rate limited procedure - applies rate limiting
 * Use for operations that should be throttled
 */
export const rateLimitedProcedure = t.procedure.use(loggerMiddleware).use(rateLimitMiddleware)

/**
 * Protected + Rate limited procedure
 * Use for sensitive operations like game submissions
 */
export const protectedRateLimitedProcedure = t.procedure
	.use(loggerMiddleware)
	.use(rateLimitMiddleware)
	.use(authMiddleware)

// Role hierarchy for permission inheritance (matches Platform SDK)
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
 * Admin procedure - requires admin role via Platform
 *
 * Checks user.role against the role hierarchy.
 * admin, super_admin have access.
 */
const adminMiddleware = middleware(async ({ ctx, next }) => {
	if (!ctx.user || !ctx.userId) {
		throw new TRPCError({
			code: 'UNAUTHORIZED',
			message: 'You must be logged in',
		})
	}

	if (!hasRole(ctx.user.role, 'admin')) {
		throw new TRPCError({
			code: 'FORBIDDEN',
			message: 'You need admin privileges to perform this action',
		})
	}

	return next({
		ctx: {
			...ctx,
			user: ctx.user,
			userId: ctx.userId,
		},
	})
})

/**
 * Super admin middleware - requires super_admin role via Platform
 *
 * Only super_admin users have access.
 */
const superAdminMiddleware = middleware(async ({ ctx, next }) => {
	if (!ctx.user || !ctx.userId) {
		throw new TRPCError({
			code: 'UNAUTHORIZED',
			message: 'You must be logged in',
		})
	}

	if (!hasRole(ctx.user.role, 'super_admin')) {
		throw new TRPCError({
			code: 'FORBIDDEN',
			message: 'You need super admin privileges to perform this action',
		})
	}

	return next({
		ctx: {
			...ctx,
			user: ctx.user,
			userId: ctx.userId,
		},
	})
})

export const adminProcedure = t.procedure.use(loggerMiddleware).use(adminMiddleware)
export const superAdminProcedure = t.procedure.use(loggerMiddleware).use(superAdminMiddleware)

/**
 * Type exports for use in routers
 */
export type Router = typeof router
export type Procedure = typeof t.procedure
