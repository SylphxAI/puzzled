/**
 * Security Router
 *
 * Security-related procedures including login history, session management,
 * and auth state (SSOT for security permissions).
 */

import { TRPCError } from '@trpc/server'
import { and, count, desc, eq, gt, ne } from 'drizzle-orm'
import { z } from 'zod'
import { PAGINATION } from '@/lib/config/validation'
import {
	canDisable2FA,
	canEnable2FA,
	getAuthState,
	getDisable2FABlockedReason,
	getSecurityScore,
	mustEnable2FA,
} from '@/features/auth/server'
import { createSecurityAlert } from '@/features/settings'
import { db } from '@/lib/db'
import { loginHistory, securityAlerts, sessions } from '@/lib/db/schema'
import { getDeviceDescription, maskIpAddress, parseUserAgent } from '@/lib/user-agent'
import { requireChallenge } from '../lib/challenge'
import { protectedProcedure, protectedRateLimitedProcedure, router } from '../trpc'

/**
 * Session with parsed device info for frontend display
 * Note: Token is intentionally NOT exposed to prevent XSS session hijacking
 */
interface SessionWithDeviceInfo {
	id: string
	ipAddress: string | null
	userAgent: string | null
	createdAt: Date
	updatedAt: Date
	expiresAt: Date
	isCurrent: boolean
	device: {
		type: 'desktop' | 'mobile' | 'tablet' | 'unknown'
		name: string
	}
	browser: {
		name: string
		version: string
	}
	os: {
		name: string
		version: string
	}
	maskedIp: string
	description: string
}

/**
 * Raw session data from database query
 */
interface RawSession {
	id: string
	token: string
	ipAddress: string | null
	userAgent: string | null
	createdAt: Date
	updatedAt: Date
	expiresAt: Date
}

/**
 * Enrich a raw session with parsed device info.
 * Pure function that transforms DB session into frontend-safe display data.
 *
 * @param session - Raw session from database
 * @param currentToken - Current user's session token for isCurrent check
 * @returns Session with device info, IP masked, token NOT exposed
 */
function enrichSession(session: RawSession, currentToken: string): SessionWithDeviceInfo {
	const parsed = parseUserAgent(session.userAgent)
	return {
		id: session.id,
		ipAddress: session.ipAddress,
		userAgent: session.userAgent,
		createdAt: session.createdAt,
		updatedAt: session.updatedAt,
		expiresAt: session.expiresAt,
		isCurrent: session.token === currentToken,
		device: parsed.device,
		browser: parsed.browser,
		os: parsed.os,
		maskedIp: maskIpAddress(session.ipAddress),
		description: getDeviceDescription(parsed),
	}
}

export const securityRouter = router({
	/**
	 * Get login history for the current user
	 * Returns paginated login events with device/location info
	 */
	getLoginHistory: protectedProcedure
		.input(
			z.object({
				limit: z.number().min(1).max(PAGINATION.MAX_LIMIT).default(PAGINATION.DEFAULT_LIMIT),
				offset: z.number().min(0).default(0),
			}),
		)
		.query(async ({ ctx, input }) => {
			const history = await db
				.select({
					id: loginHistory.id,
					ipAddress: loginHistory.ipAddress,
					userAgent: loginHistory.userAgent,
					country: loginHistory.country,
					city: loginHistory.city,
					device: loginHistory.device,
					success: loginHistory.success,
					failureReason: loginHistory.failureReason,
					createdAt: loginHistory.createdAt,
				})
				.from(loginHistory)
				.where(eq(loginHistory.userId, ctx.user.id))
				.orderBy(desc(loginHistory.createdAt))
				.limit(input.limit)
				.offset(input.offset)

			// Get total count for pagination
			const [{ total }] = await db
				.select({ total: count() })
				.from(loginHistory)
				.where(eq(loginHistory.userId, ctx.user.id))

			const page = Math.floor(input.offset / input.limit) + 1
			const hasMore = input.offset + history.length < total

			return {
				history,
				total,
				page,
				hasMore,
				limit: input.limit,
				offset: input.offset,
			}
		}),

	/**
	 * Get all active sessions for the current user
	 * Returns sessions with parsed device/browser info
	 */
	getActiveSessions: protectedProcedure.query(async ({ ctx }): Promise<SessionWithDeviceInfo[]> => {
		const currentToken = ctx.session.session.token
		const now = new Date()

		// Get all non-expired sessions for the user
		const userSessions = await db
			.select({
				id: sessions.id,
				token: sessions.token,
				ipAddress: sessions.ipAddress,
				userAgent: sessions.userAgent,
				createdAt: sessions.createdAt,
				updatedAt: sessions.updatedAt,
				expiresAt: sessions.expiresAt,
			})
			.from(sessions)
			.where(and(eq(sessions.userId, ctx.user.id), gt(sessions.expiresAt, now)))
			.orderBy(desc(sessions.updatedAt))

		// Enrich each session with device info (token NOT exposed to client)
		return userSessions.map((session) => enrichSession(session, currentToken))
	}),

	/**
	 * Revoke a specific session (sign out from that device)
	 * Requires identity challenge for security
	 */
	revokeSession: protectedRateLimitedProcedure
		.input(
			z.object({
				sessionId: z.string().uuid(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const currentToken = ctx.session.session.token

			// Require identity verification for security-sensitive operation
			await requireChallenge(currentToken, 'identity')

			// First verify the session belongs to the user and get details for alert
			const [session] = await db
				.select({
					id: sessions.id,
					token: sessions.token,
					userAgent: sessions.userAgent,
					ipAddress: sessions.ipAddress,
				})
				.from(sessions)
				.where(and(eq(sessions.id, input.sessionId), eq(sessions.userId, ctx.user.id)))
				.limit(1)

			if (!session) {
				throw new TRPCError({
					code: 'NOT_FOUND',
					message: 'Session not found',
				})
			}

			// Prevent revoking current session through this endpoint
			if (session.token === currentToken) {
				throw new TRPCError({
					code: 'BAD_REQUEST',
					message: 'Cannot revoke current session. Use sign out instead.',
				})
			}

			// Delete the session
			await db.delete(sessions).where(eq(sessions.id, input.sessionId))

			// Create security alert for session revocation
			const parsed = parseUserAgent(session.userAgent)
			const device = getDeviceDescription(parsed)
			await createSecurityAlert(ctx.user.id, 'session_revoked', {
				sessionId: input.sessionId,
				ipAddress: session.ipAddress ?? undefined,
				device,
			})

			return { success: true }
		}),

	/**
	 * Revoke all sessions except the current one (sign out all other devices)
	 * Requires identity challenge for security
	 */
	revokeAllOtherSessions: protectedRateLimitedProcedure.mutation(async ({ ctx }) => {
		const currentToken = ctx.session.session.token

		// Require identity verification for security-sensitive operation
		await requireChallenge(currentToken, 'identity')

		// Delete all sessions for the user except the current one
		const result = await db
			.delete(sessions)
			.where(and(eq(sessions.userId, ctx.user.id), ne(sessions.token, currentToken)))

		// Get count of deleted sessions (if supported by driver)
		const deletedCount = result.rowCount ?? 0

		// Create security alert for bulk session revocation
		if (deletedCount > 0) {
			await createSecurityAlert(ctx.user.id, 'all_sessions_revoked', {
				revokedCount: deletedCount,
			})
		}

		return {
			success: true,
			revokedCount: deletedCount,
		}
	}),

	// ==================
	// Security Alerts
	// ==================

	/**
	 * Get paginated security alert history
	 */
	getAlertHistory: protectedProcedure
		.input(
			z.object({
				limit: z
					.number()
					.min(1)
					.max(PAGINATION.MAX_LIMIT)
					.default(PAGINATION.DEFAULT_LIMIT * 2),
				offset: z.number().min(0).default(0),
			}),
		)
		.query(async ({ ctx, input }) => {
			const alerts = await db
				.select()
				.from(securityAlerts)
				.where(eq(securityAlerts.userId, ctx.user.id))
				.orderBy(desc(securityAlerts.createdAt))
				.limit(input.limit)
				.offset(input.offset)

			const [{ total }] = await db
				.select({ total: count() })
				.from(securityAlerts)
				.where(eq(securityAlerts.userId, ctx.user.id))

			return {
				alerts,
				total,
			}
		}),

	/**
	 * Mark a single alert as read
	 * Rate limited to prevent abuse
	 */
	markAlertAsRead: protectedRateLimitedProcedure
		.input(z.object({ alertId: z.string().uuid() }))
		.mutation(async ({ ctx, input }) => {
			const [updated] = await db
				.update(securityAlerts)
				.set({ read: true })
				.where(and(eq(securityAlerts.id, input.alertId), eq(securityAlerts.userId, ctx.user.id)))
				.returning()

			return updated ?? null
		}),

	// ==================
	// Auth State (SSOT for UI permission checks)
	// ==================

	/**
	 * Get current user's auth state and security permissions
	 *
	 * This is the SSOT for what security operations the user can perform.
	 * UI components should use this to determine button states/visibility.
	 */
	getAuthState: protectedProcedure.query(async ({ ctx }) => {
		const authState = await getAuthState(ctx.user.id)

		return {
			// Auth methods
			hasPassword: authState.hasCredential,
			oauthProviders: authState.oauthProviders,
			twoFactorEnabled: authState.twoFactorEnabled,

			// 2FA permissions
			canEnable2FA: canEnable2FA(authState),
			canDisable2FA: canDisable2FA(authState),
			mustEnable2FA: mustEnable2FA(authState),
			disable2FABlockedReason: getDisable2FABlockedReason(authState),

			// Security metrics
			securityScore: getSecurityScore(authState),

			// Role info
			role: authState.role,
			emailVerified: authState.emailVerified,
		}
	}),

	// Note: Recovery codes are shown during MFA setup (captured from twoFactor.enable() response)
	// and can be regenerated via the client-side twoFactor.generateBackupCodes() function.
	// This matches the security pattern used by Google, GitHub, and other major services.
	//
	// Security alerts for 2FA changes are handled directly in two-factor.ts router
	// using createSecurityAlert, which ensures proper email notifications for critical events.
})
