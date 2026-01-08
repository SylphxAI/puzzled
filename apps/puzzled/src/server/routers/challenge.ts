/**
 * Unified Challenge Router
 *
 * Single API for all authentication challenges.
 * Handles both identity verification (password/email) and MFA verification (TOTP/backup).
 *
 * Replaces the fragmented reauth + two-factor routers for verification purposes.
 */

import { timingSafeEqual } from 'node:crypto'
import { TRPCError } from '@trpc/server'
import { Ratelimit } from '@upstash/ratelimit'
import { verifyPassword as betterAuthVerifyPassword } from 'better-auth/crypto'
import { symmetricEncrypt } from 'better-auth/crypto'
import { and, eq, gt, isNull, lt, sql } from 'drizzle-orm'
import { authenticator } from 'otplib'
import { z } from 'zod'
import { CREDENTIAL_PROVIDER_ID } from '@/features/auth/server'
import { createSecurityAlert } from '@/features/settings'
import { db } from '@/lib/db'
import { accounts, sessions, twoFactors, users, verificationCodes } from '@/lib/db/schema'
import { redis } from '@/lib/redis'
import { captureError } from '@/lib/sentry'
import {
	type ChallengeStatus,
	EMAIL_CODE_EXPIRY_MINUTES,
	IDENTITY_CHALLENGE_TTL_MINUTES,
	MAX_FAILED_ATTEMPTS,
	isIdentityVerified,
	isMfaVerified,
	markIdentityVerified,
	markMfaVerified,
} from '../lib/challenge'
import { decryptBackupCodes, decryptTotpSecret, getEncryptionKey } from '../lib/crypto'
import { protectedProcedure, router } from '../trpc'

// ==================
// Rate Limiters
// ==================

/** Rate limiter for email code requests: 1 per minute per user */
const emailCodeRatelimit = new Ratelimit({
	redis,
	limiter: Ratelimit.slidingWindow(1, '60 s'),
	prefix: 'puzzled:challenge:email-code',
})

/** Rate limiter for verification attempts: 5 per 15 minutes per user */
const verifyAttemptRatelimit = new Ratelimit({
	redis,
	limiter: Ratelimit.slidingWindow(5, '15 m'),
	prefix: 'puzzled:challenge:verify-attempt',
})

// ==================
// Helpers
// ==================

/**
 * Generate a cryptographically secure 6-digit code
 * Uses rejection sampling to eliminate modulo bias (OWASP ASVS 2.7.6)
 */
function generateVerificationCode(): string {
	const MAX_UNBIASED = 4294000000
	let value: number
	do {
		const array = new Uint32Array(1)
		crypto.getRandomValues(array)
		value = array[0]
	} while (value >= MAX_UNBIASED)
	return String(value % 1000000).padStart(6, '0')
}

/**
 * Check if user has a password account
 */
async function hasPasswordAccount(userId: string): Promise<boolean> {
	const account = await db.query.accounts.findFirst({
		where: and(eq(accounts.userId, userId), eq(accounts.providerId, CREDENTIAL_PROVIDER_ID)),
	})
	return !!account?.password
}

/**
 * Verify user's password with constant-time behavior
 */
async function verifyPassword(userId: string, password: string): Promise<boolean> {
	const account = await db.query.accounts.findFirst({
		where: and(eq(accounts.userId, userId), eq(accounts.providerId, CREDENTIAL_PROVIDER_ID)),
	})

	// Dummy hash for constant-time behavior when no account exists
	const DUMMY_HASH = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy'
	const hashToVerify = account?.password ?? DUMMY_HASH

	const result = await betterAuthVerifyPassword({ password, hash: hashToVerify })
	return !!account?.password && result
}


/**
 * Clean up expired verification codes for a user
 */
async function cleanupExpiredCodes(userId: string): Promise<void> {
	await db
		.delete(verificationCodes)
		.where(and(eq(verificationCodes.userId, userId), lt(verificationCodes.expiresAt, new Date())))
}

// ==================
// Router
// ==================

export const challengeRouter = router({
	/**
	 * Get current challenge status and available methods
	 */
	getStatus: protectedProcedure.query(async ({ ctx }): Promise<ChallengeStatus> => {
		const sessionToken = ctx.session.session.token
		const userId = ctx.user.id

		// Check verification states
		const [identityVerified, mfaVerified] = await Promise.all([
			isIdentityVerified(sessionToken),
			isMfaVerified(sessionToken),
		])

		// Check user capabilities
		const [userHasPassword, user, twoFactor] = await Promise.all([
			hasPasswordAccount(userId),
			db.query.users.findFirst({
				where: eq(users.id, userId),
				columns: { twoFactorEnabled: true },
			}),
			db.query.twoFactors.findFirst({
				where: eq(twoFactors.userId, userId),
				columns: { id: true },
			}),
		])

		const userHas2FA = user?.twoFactorEnabled ?? false

		// Calculate expiry times
		let identityExpiresAt: Date | null = null
		if (identityVerified) {
			const [session] = await db
				.select({ verifiedAt: sessions.verifiedAt })
				.from(sessions)
				.where(eq(sessions.token, sessionToken))
				.limit(1)

			if (session?.verifiedAt) {
				identityExpiresAt = new Date(
					new Date(session.verifiedAt).getTime() + IDENTITY_CHALLENGE_TTL_MINUTES * 60 * 1000,
				)
			}
		}

		// Build available methods
		const availableIdentityMethods: ChallengeStatus['availableIdentityMethods'] = ['email']
		if (userHasPassword) {
			availableIdentityMethods.unshift('password') // Password first if available
		}

		const availableMfaMethods: ChallengeStatus['availableMfaMethods'] = []
		if (userHas2FA && twoFactor) {
			availableMfaMethods.push('totp', 'backup')
		}

		return {
			identityVerified,
			identityExpiresAt,
			identityMethod: null, // Could track this in session if needed
			mfaVerified,
			mfaExpiresAt: null, // Session lifetime
			mfaMethod: null,
			availableIdentityMethods,
			availableMfaMethods,
			userHas2FA,
			userHasPassword,
		}
	}),

	/**
	 * Request email verification code
	 */
	requestEmailCode: protectedProcedure.mutation(async ({ ctx }) => {
		const userId = ctx.user.id
		const userEmail = ctx.user.email

		// Rate limit check
		const { success: rateLimitPassed } = await emailCodeRatelimit.limit(userId)
		if (!rateLimitPassed) {
			throw new TRPCError({
				code: 'TOO_MANY_REQUESTS',
				message: 'Please wait before requesting another code',
			})
		}

		// Clean up expired codes
		await cleanupExpiredCodes(userId)

		// Check for existing valid code
		const existingCode = await db.query.verificationCodes.findFirst({
			where: and(
				eq(verificationCodes.userId, userId),
				eq(verificationCodes.type, 'reauth'),
				gt(verificationCodes.expiresAt, new Date()),
			),
		})

		if (existingCode) {
			const createdAt = new Date(existingCode.createdAt)
			const age = Date.now() - createdAt.getTime()
			if (age < 60 * 1000) {
				return {
					sent: true,
					expiresInSeconds: Math.floor(
						(new Date(existingCode.expiresAt).getTime() - Date.now()) / 1000,
					),
				}
			}
			await db.delete(verificationCodes).where(eq(verificationCodes.id, existingCode.id))
		}

		// Generate new code
		const code = generateVerificationCode()
		const expiresAt = new Date(Date.now() + EMAIL_CODE_EXPIRY_MINUTES * 60 * 1000)

		await db.insert(verificationCodes).values({
			userId,
			code,
			type: 'reauth',
			expiresAt,
		})

		// Send email
		try {
			const { sendIdentityVerificationCode } = await import('@/features/notifications/server')
			await sendIdentityVerificationCode({
				email: userEmail,
				code,
				operation: 'reauth', // DB enum value - kept for compatibility
			})
		} catch (err) {
			captureError(err instanceof Error ? err : new Error(String(err)), {
				tags: { operation: 'challenge', step: 'send-email-code' },
				extra: { userId },
			})
			await db
				.delete(verificationCodes)
				.where(and(eq(verificationCodes.userId, userId), eq(verificationCodes.code, code)))
			throw new TRPCError({
				code: 'INTERNAL_SERVER_ERROR',
				message: 'Failed to send verification email. Please try again.',
			})
		}

		return {
			sent: true,
			expiresInSeconds: EMAIL_CODE_EXPIRY_MINUTES * 60,
		}
	}),

	/**
	 * Verify identity using password or email code
	 */
	verifyIdentity: protectedProcedure
		.input(
			z.object({
				method: z.enum(['password', 'email']),
				credential: z.string().min(1),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.user.id
			const sessionToken = ctx.session.session.token

			// Rate limit check
			const { success: rateLimitPassed } = await verifyAttemptRatelimit.limit(userId)
			if (!rateLimitPassed) {
				throw new TRPCError({
					code: 'TOO_MANY_REQUESTS',
					message: 'Too many verification attempts. Please try again in 15 minutes.',
				})
			}

			if (input.method === 'password') {
				// Verify password
				const hasPassword = await hasPasswordAccount(userId)
				if (!hasPassword) {
					throw new TRPCError({
						code: 'BAD_REQUEST',
						message: 'Password verification not available for this account',
					})
				}

				const isValid = await verifyPassword(userId, input.credential)
				if (!isValid) {
					throw new TRPCError({
						code: 'UNAUTHORIZED',
						message: 'Invalid password',
					})
				}

				await markIdentityVerified(sessionToken)

				await createSecurityAlert(userId, 'new_login', { method: 'password_challenge' })

				return {
					verified: true,
					expiresInSeconds: IDENTITY_CHALLENGE_TTL_MINUTES * 60,
				}
			}

			// Verify email code
			const GENERIC_ERROR = 'Invalid or expired code'

			const validCode = await db.query.verificationCodes.findFirst({
				where: and(
					eq(verificationCodes.userId, userId),
					eq(verificationCodes.type, 'reauth'),
					gt(verificationCodes.expiresAt, new Date()),
					isNull(verificationCodes.usedAt),
				),
			})

			if (!validCode) {
				throw new TRPCError({ code: 'BAD_REQUEST', message: GENERIC_ERROR })
			}

			// Check lockout
			if (validCode.attempts >= MAX_FAILED_ATTEMPTS) {
				throw new TRPCError({
					code: 'TOO_MANY_REQUESTS',
					message: 'Too many failed attempts. Please request a new code.',
				})
			}

			// Constant-time comparison
			const storedBuffer = Buffer.from(validCode.code, 'utf8')
			const inputBuffer = Buffer.from(input.credential, 'utf8')
			const codesMatch =
				storedBuffer.length === inputBuffer.length && timingSafeEqual(storedBuffer, inputBuffer)

			if (!codesMatch) {
				await db
					.update(verificationCodes)
					.set({ attempts: sql`${verificationCodes.attempts} + 1` })
					.where(eq(verificationCodes.id, validCode.id))

				throw new TRPCError({ code: 'BAD_REQUEST', message: GENERIC_ERROR })
			}

			// Mark code as used atomically
			const [markedCode] = await db
				.update(verificationCodes)
				.set({ usedAt: new Date() })
				.where(and(eq(verificationCodes.id, validCode.id), isNull(verificationCodes.usedAt)))
				.returning({ id: verificationCodes.id })

			if (!markedCode) {
				throw new TRPCError({ code: 'BAD_REQUEST', message: GENERIC_ERROR })
			}

			await markIdentityVerified(sessionToken)

			// Clean up codes
			await db
				.delete(verificationCodes)
				.where(and(eq(verificationCodes.userId, userId), eq(verificationCodes.type, 'reauth')))

			await createSecurityAlert(userId, 'new_login', { method: 'email_challenge' })

			return {
				verified: true,
				expiresInSeconds: IDENTITY_CHALLENGE_TTL_MINUTES * 60,
			}
		}),

	/**
	 * Verify MFA using TOTP or backup code
	 * Automatically detects code type based on format
	 */
	verifyMfa: protectedProcedure
		.input(
			z.object({
				code: z
					.string()
					.min(6)
					.max(11)
					.regex(/^[\dA-Z-]+$/i, 'Invalid code format'),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.user.id
			const sessionToken = ctx.session.session.token

			// Rate limit check
			const { success: rateLimitPassed } = await verifyAttemptRatelimit.limit(userId)
			if (!rateLimitPassed) {
				throw new TRPCError({
					code: 'TOO_MANY_REQUESTS',
					message: 'Too many verification attempts. Please try again in 15 minutes.',
				})
			}

			// Check if user has 2FA enabled
			const user = await db.query.users.findFirst({
				where: eq(users.id, userId),
				columns: { twoFactorEnabled: true },
			})

			if (!user?.twoFactorEnabled) {
				throw new TRPCError({
					code: 'BAD_REQUEST',
					message: 'Two-factor authentication is not enabled',
				})
			}

			// Get 2FA configuration
			const twoFactor = await db.query.twoFactors.findFirst({
				where: eq(twoFactors.userId, userId),
			})

			if (!twoFactor) {
				throw new TRPCError({
					code: 'NOT_FOUND',
					message: '2FA configuration not found',
				})
			}

			const key = getEncryptionKey()
			const code = input.code.toUpperCase().trim()

			// Detect code type: TOTP (6 digits) vs Backup (XXXXX-XXXXX)
			const isBackupCode = code.includes('-') || code.length > 6

			if (isBackupCode) {
				// Verify backup code
				const backupCodes = await decryptBackupCodes(twoFactor.backupCodes, key)
				const codeIndex = backupCodes.indexOf(code)

				if (codeIndex === -1) {
					throw new TRPCError({
						code: 'BAD_REQUEST',
						message: 'Invalid backup code',
					})
				}

				// Remove used backup code (one-time use)
				const updatedCodes = backupCodes.filter((_, i) => i !== codeIndex)
				const encryptedBackupCodes = await symmetricEncrypt({
					data: JSON.stringify(updatedCodes),
					key,
				})

				// Atomic update
				await db.transaction(async (tx) => {
					await tx
						.update(twoFactors)
						.set({ backupCodes: encryptedBackupCodes, updatedAt: new Date() })
						.where(eq(twoFactors.userId, userId))

					await tx
						.update(sessions)
						.set({ twoFactorVerified: true, updatedAt: new Date() })
						.where(eq(sessions.token, sessionToken))
				})

				return {
					verified: true,
					method: 'backup' as const,
					remainingBackupCodes: updatedCodes.length,
				}
			}

			// Verify TOTP code
			const secret = await decryptTotpSecret(twoFactor.secret, key)
			const isValid = authenticator.verify({ token: code, secret })

			if (!isValid) {
				throw new TRPCError({
					code: 'BAD_REQUEST',
					message: 'Invalid verification code',
				})
			}

			await markMfaVerified(sessionToken)

			return {
				verified: true,
				method: 'totp' as const,
			}
		}),

	/**
	 * Check if a specific challenge requirement is satisfied
	 */
	checkRequirement: protectedProcedure
		.input(
			z.object({
				requirement: z.enum(['identity', 'mfa', 'both']),
			}),
		)
		.query(async ({ ctx, input }) => {
			const sessionToken = ctx.session.session.token

			const [identityVerified, mfaVerified] = await Promise.all([
				isIdentityVerified(sessionToken),
				isMfaVerified(sessionToken),
			])

			let satisfied = false
			switch (input.requirement) {
				case 'identity':
					satisfied = identityVerified
					break
				case 'mfa':
					satisfied = mfaVerified
					break
				case 'both':
					satisfied = identityVerified && mfaVerified
					break
			}

			return {
				requirement: input.requirement,
				satisfied,
				identityVerified,
				mfaVerified,
			}
		}),
})
