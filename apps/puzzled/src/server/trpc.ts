/**
 * tRPC Server Configuration
 *
 * This file initializes tRPC and defines reusable procedures with middleware.
 * All routers import from this file.
 */

import { initTRPC, TRPCError } from '@trpc/server'
import { eq } from 'drizzle-orm'
import superjson from 'superjson'
import { ZodError } from 'zod'
import { db } from '@/lib/db'
import { sessions, users } from '@/lib/db/schema'
import { ratelimit } from '@/lib/redis'
import { isAdminRole, isSuperAdminRole } from '@/lib/roles'
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
 * Auth middleware - ensures user is authenticated
 */
const authMiddleware = middleware(async ({ ctx, next }) => {
	if (!ctx.session?.user) {
		throw new TRPCError({
			code: 'UNAUTHORIZED',
			message: 'You must be logged in to perform this action',
		})
	}

	return next({
		ctx: {
			...ctx,
			// Infer user as non-null
			user: ctx.session.user,
			session: ctx.session,
		},
	})
})

/**
 * Rate limiting middleware - prevents abuse
 * Default: 10 requests per 10 seconds
 */
const rateLimitMiddleware = middleware(async ({ ctx, next }) => {
	if (!ctx.session?.user) {
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
		const result = await ratelimit.limit(`user:${ctx.session.user.id}`)
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

/**
 * Admin procedure - requires admin role with MFA enforcement
 * Per spec: MFA required for admin and super_admin roles
 */
const adminMiddleware = middleware(async ({ ctx, next }) => {
	if (!ctx.session?.user) {
		throw new TRPCError({
			code: 'UNAUTHORIZED',
			message: 'You must be logged in',
		})
	}

	// Fetch user's role and MFA status from database
	const [user] = await db
		.select({
			role: users.role,
			twoFactorEnabled: users.twoFactorEnabled,
		})
		.from(users)
		.where(eq(users.id, ctx.session.user.id))
		.limit(1)

	if (!user || !isAdminRole(user.role)) {
		throw new TRPCError({
			code: 'FORBIDDEN',
			message: 'You do not have permission to perform this action',
		})
	}

	// Per spec: MFA required for admin and super_admin roles
	if (!user.twoFactorEnabled) {
		throw new TRPCError({
			code: 'FORBIDDEN',
			message:
				'Two-factor authentication must be enabled for admin access. Please set up MFA in your account settings.',
		})
	}

	// Check if current session has verified MFA
	const [session] = await db
		.select({ twoFactorVerified: sessions.twoFactorVerified })
		.from(sessions)
		.where(eq(sessions.token, ctx.session.session.token))
		.limit(1)

	if (!session?.twoFactorVerified) {
		throw new TRPCError({
			code: 'FORBIDDEN',
			message: 'Please verify your two-factor authentication to access admin features.',
		})
	}

	return next({
		ctx: {
			...ctx,
			user: ctx.session.user,
			userRole: user.role,
		},
	})
})

/**
 * Super admin middleware - requires super_admin role with MFA
 */
const superAdminMiddleware = middleware(async ({ ctx, next }) => {
	if (!ctx.session?.user) {
		throw new TRPCError({
			code: 'UNAUTHORIZED',
			message: 'You must be logged in',
		})
	}

	// Fetch user's role and MFA status
	const [user] = await db
		.select({
			role: users.role,
			twoFactorEnabled: users.twoFactorEnabled,
		})
		.from(users)
		.where(eq(users.id, ctx.session.user.id))
		.limit(1)

	if (!user || !isSuperAdminRole(user.role)) {
		throw new TRPCError({
			code: 'FORBIDDEN',
			message: 'Super admin access required',
		})
	}

	// Per spec: MFA required for super_admin
	if (!user.twoFactorEnabled) {
		throw new TRPCError({
			code: 'FORBIDDEN',
			message: 'Two-factor authentication must be enabled for super admin access.',
		})
	}

	// Check MFA verification
	const [session] = await db
		.select({ twoFactorVerified: sessions.twoFactorVerified })
		.from(sessions)
		.where(eq(sessions.token, ctx.session.session.token))
		.limit(1)

	if (!session?.twoFactorVerified) {
		throw new TRPCError({
			code: 'FORBIDDEN',
			message: 'Please verify your two-factor authentication.',
		})
	}

	return next({
		ctx: {
			...ctx,
			user: ctx.session.user,
			userRole: user.role as 'super_admin',
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
