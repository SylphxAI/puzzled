/**
 * Email Router
 *
 * Email change functionality with verification.
 * Uses identity challenge for security - works for both OAuth and password users.
 */

import { randomBytes, timingSafeEqual } from 'node:crypto'
import { TRPCError } from '@trpc/server'
import { Ratelimit } from '@upstash/ratelimit'
import { and, eq, gt } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/lib/db'
import { emailChangeRequests, users } from '@/lib/db/schema'
import { redis } from '@/lib/redis'
import { captureError } from '@/lib/sentry'
import { requireChallenge } from '../lib/challenge'
import { protectedProcedure, protectedRateLimitedProcedure, router } from '../trpc'

// Token expires in 24 hours
const TOKEN_EXPIRY_HOURS = 24

// Rate limiter for email change requests
// 3 attempts per hour per user
const emailChangeRatelimit = new Ratelimit({
	redis,
	limiter: Ratelimit.slidingWindow(3, '1 h'),
	prefix: 'puzzled:email-change',
})

/**
 * Generate a secure random token
 */
function generateToken(): string {
	return randomBytes(32).toString('hex')
}

export const emailRouter = router({
	/**
	 * Get pending email change for the current user
	 */
	getPendingEmailChange: protectedProcedure.query(async ({ ctx }) => {
		const pendingRequest = await db.query.emailChangeRequests.findFirst({
			where: and(
				eq(emailChangeRequests.userId, ctx.user.id),
				gt(emailChangeRequests.expiresAt, new Date()),
			),
		})

		if (!pendingRequest) {
			return null
		}

		return {
			newEmail: pendingRequest.newEmail,
			expiresAt: pendingRequest.expiresAt,
			createdAt: pendingRequest.createdAt,
		}
	}),

	/**
	 * Request an email change
	 * Requires identity challenge for security
	 */
	requestEmailChange: protectedProcedure
		.input(
			z.object({
				newEmail: z.string().email(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const { newEmail } = input
			const sessionToken = ctx.session.session.token

			// Require identity verification for security
			await requireChallenge(sessionToken, 'identity')

			// Rate limit by user ID
			const { success: rateLimitPassed } = await emailChangeRatelimit.limit(ctx.user.id)
			if (!rateLimitPassed) {
				throw new TRPCError({
					code: 'TOO_MANY_REQUESTS',
					message: 'Too many email change attempts. Please try again later.',
				})
			}

			// Check if new email is different from current
			if (newEmail.toLowerCase() === ctx.user.email.toLowerCase()) {
				throw new TRPCError({
					code: 'BAD_REQUEST',
					message: 'New email must be different from your current email',
				})
			}

			// Check if email is already in use
			const existingUser = await db.query.users.findFirst({
				where: eq(users.email, newEmail.toLowerCase()),
			})

			if (existingUser) {
				throw new TRPCError({
					code: 'CONFLICT',
					message: 'This email is already in use',
				})
			}

			// Create new email change request
			const token = generateToken()
			const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000)

			// ATOMIC TRANSACTION: Delete old requests and insert new one together
			// This prevents inconsistent state if one operation fails
			await db.transaction(async (tx) => {
				// Delete any existing pending requests for this user
				await tx.delete(emailChangeRequests).where(eq(emailChangeRequests.userId, ctx.user.id))

				// Insert new request
				await tx.insert(emailChangeRequests).values({
					userId: ctx.user.id,
					newEmail: newEmail.toLowerCase(),
					token,
					expiresAt,
				})
			})

			// Send verification email to new address
			try {
				const { sendEmailChangeVerification } = await import('@/features/notifications/server')
				await sendEmailChangeVerification({
					email: newEmail.toLowerCase(),
					token,
					currentEmail: ctx.user.email,
				})
			} catch (err) {
				captureError(err instanceof Error ? err : new Error(String(err)), {
					tags: { operation: 'email-change', step: 'send-verification' },
					extra: { userId: ctx.user.id },
				})
				// Delete the request if email fails
				await db.delete(emailChangeRequests).where(eq(emailChangeRequests.userId, ctx.user.id))
				throw new TRPCError({
					code: 'INTERNAL_SERVER_ERROR',
					message: 'Failed to send verification email. Please try again.',
				})
			}

			return { success: true }
		}),

	/**
	 * Verify email change using token
	 * Called when user clicks the verification link
	 * Rate limited to prevent brute force token guessing
	 *
	 * Security: Uses timing-safe token comparison to prevent timing attacks
	 */
	verifyEmailChange: protectedRateLimitedProcedure
		.input(
			z.object({
				token: z.string(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const { token } = input

			// Security: Look up by user ID first, then use timing-safe comparison
			// This prevents timing attacks that could leak token information
			const pendingRequest = await db.query.emailChangeRequests.findFirst({
				where: and(
					eq(emailChangeRequests.userId, ctx.user.id),
					gt(emailChangeRequests.expiresAt, new Date()),
				),
				with: {
					user: true,
				},
			})

			// Use timing-safe comparison for token to prevent timing attacks
			const tokenMatches =
				pendingRequest &&
				token.length === pendingRequest.token.length &&
				timingSafeEqual(Buffer.from(token), Buffer.from(pendingRequest.token))

			if (!pendingRequest || !tokenMatches) {
				throw new TRPCError({
					code: 'NOT_FOUND',
					message: 'Invalid or expired verification link',
				})
			}

			const request = pendingRequest

			// Double check the new email isn't taken (race condition protection)
			const existingUser = await db.query.users.findFirst({
				where: eq(users.email, request.newEmail),
			})

			if (existingUser) {
				// Clean up the request
				await db.delete(emailChangeRequests).where(eq(emailChangeRequests.id, request.id))
				throw new TRPCError({
					code: 'CONFLICT',
					message: 'This email is no longer available',
				})
			}

			const oldEmail = request.user.email

			// ATOMIC TRANSACTION: Update email and delete request together
			// This prevents inconsistent state if one operation fails
			await db.transaction(async (tx) => {
				// Update the user's email
				await tx
					.update(users)
					.set({
						email: request.newEmail,
						emailVerified: true,
						updatedAt: new Date(),
					})
					.where(eq(users.id, request.userId))

				// Delete the request
				await tx.delete(emailChangeRequests).where(eq(emailChangeRequests.id, request.id))
			})

			// Create security alert for email change (critical security event)
			try {
				const { createSecurityAlert } = await import('@/features/settings')
				await createSecurityAlert(request.userId, 'email_changed', {
					oldEmail,
					newEmail: request.newEmail,
				})
			} catch (err) {
				// Non-critical - log but don't fail
				captureError(err instanceof Error ? err : new Error(String(err)), {
					tags: { operation: 'email-change', step: 'create-security-alert' },
					level: 'warning',
				})
			}

			// Notify old email about the change
			try {
				const { sendEmailChangeNotification } = await import('@/features/notifications/server')
				await sendEmailChangeNotification({
					oldEmail,
					newEmail: request.newEmail,
				})
			} catch (err) {
				// Non-critical - log but don't fail
				captureError(err instanceof Error ? err : new Error(String(err)), {
					tags: { operation: 'email-change', step: 'send-notification' },
					level: 'warning',
				})
			}

			return { success: true, newEmail: request.newEmail }
		}),

	/**
	 * Cancel a pending email change
	 * Rate limited to prevent abuse
	 */
	cancelEmailChange: protectedRateLimitedProcedure.mutation(async ({ ctx }) => {
		const deleted = await db
			.delete(emailChangeRequests)
			.where(eq(emailChangeRequests.userId, ctx.user.id))
			.returning()

		if (deleted.length === 0) {
			throw new TRPCError({
				code: 'NOT_FOUND',
				message: 'No pending email change found',
			})
		}

		return { success: true }
	}),
})
