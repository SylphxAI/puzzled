/**
 * Two-Factor Authentication Management Router
 *
 * Handles 2FA setup, activation, and management operations.
 * Uses unified challenge system for identity verification.
 *
 * Note: MFA verification for step-up auth is in challenge router.
 */

import { randomBytes } from 'node:crypto'
import { TRPCError } from '@trpc/server'
import { symmetricEncrypt } from 'better-auth/crypto'
import { eq } from 'drizzle-orm'
import { authenticator } from 'otplib'
import { z } from 'zod'
import { canDisable2FA, getAuthState, getDisable2FABlockedReason } from '@/features/auth/server'
import { createSecurityAlert } from '@/features/settings'
import { APP_NAME } from '@/lib/config/app'
import { db } from '@/lib/db'
import { sessions, twoFactors, users } from '@/lib/db/schema'
import { requireChallenge } from '../lib/challenge'
import { decryptBackupCodes, decryptTotpSecret, getEncryptionKey } from '../lib/crypto'
import { protectedProcedure, protectedRateLimitedProcedure, router } from '../trpc'

// ==================
// Constants
// ==================

/** App name for TOTP issuer (matches better-auth config) */
const TOTP_ISSUER = APP_NAME

// ==================
// Helpers
// ==================

/**
 * Generate TOTP URI for authenticator apps
 */
function generateTotpUri(email: string, secret: string): string {
	return authenticator.keyuri(email, TOTP_ISSUER, secret)
}

/**
 * Generate a random alphanumeric string
 */
function generateRandomString(length: number): string {
	const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
	const bytes = randomBytes(length)
	let result = ''
	for (let i = 0; i < length; i++) {
		result += chars[bytes[i] % chars.length]
	}
	return result
}

/**
 * Generate backup codes (10 codes, format: XXXXX-XXXXX)
 * Returns both plain codes (for display) and encrypted version (for storage)
 */
async function generateBackupCodes(encryptionKey: string): Promise<{
	backupCodes: string[]
	encryptedBackupCodes: string
}> {
	const backupCodes = Array.from({ length: 10 }).map(() => {
		const code = generateRandomString(10)
		return `${code.slice(0, 5)}-${code.slice(5)}`
	})

	const encryptedBackupCodes = await symmetricEncrypt({
		data: JSON.stringify(backupCodes),
		key: encryptionKey,
	})

	return { backupCodes, encryptedBackupCodes }
}


// ==================
// Router
// ==================

export const twoFactorRouter = router({
	/**
	 * Get 2FA status for current user
	 */
	getStatus: protectedProcedure.query(async ({ ctx }) => {
		const user = await db.query.users.findFirst({
			where: eq(users.id, ctx.user.id),
		})

		// Check if user has 2FA set up
		const existingTwoFactor = await db.query.twoFactors.findFirst({
			where: eq(twoFactors.userId, ctx.user.id),
		})

		return {
			enabled: user?.twoFactorEnabled ?? false,
			hasSecret: !!existingTwoFactor,
		}
	}),

	/**
	 * Start 2FA setup - generates TOTP secret and backup codes
	 * Requires identity challenge (password or email verification)
	 * Rate limited to prevent abuse
	 */
	startSetup: protectedRateLimitedProcedure.mutation(async ({ ctx }) => {
		const sessionToken = ctx.session.session.token

		// Require identity verification for security
		await requireChallenge(sessionToken, 'identity')

		// Check if already enabled
		const user = await db.query.users.findFirst({
			where: eq(users.id, ctx.user.id),
		})

		if (user?.twoFactorEnabled) {
			throw new TRPCError({
				code: 'BAD_REQUEST',
				message: 'Two-factor authentication is already enabled',
			})
		}

		// Check for existing setup (in case user abandoned previous attempt)
		const existingTwoFactor = await db.query.twoFactors.findFirst({
			where: eq(twoFactors.userId, ctx.user.id),
		})

		if (existingTwoFactor) {
			// Delete old setup to start fresh
			await db.delete(twoFactors).where(eq(twoFactors.userId, ctx.user.id))
		}

		// Generate new TOTP secret
		const secret = authenticator.generateSecret()
		const key = getEncryptionKey()

		// Encrypt secret for storage
		const encryptedSecret = await symmetricEncrypt({ key, data: secret })

		// Generate backup codes
		const { backupCodes, encryptedBackupCodes } = await generateBackupCodes(key)

		// Store in database (2FA not yet enabled - user must verify first)
		await db.insert(twoFactors).values({
			userId: ctx.user.id,
			secret: encryptedSecret,
			backupCodes: encryptedBackupCodes,
		})

		// Generate TOTP URI for QR code
		const totpUri = generateTotpUri(ctx.user.email, secret)

		return {
			totpUri,
			backupCodes,
		}
	}),

	/**
	 * Verify TOTP code and activate 2FA
	 * Called after user scans QR code and enters first code
	 * Rate limited to prevent brute force attacks
	 */
	verifyAndActivate: protectedRateLimitedProcedure
		.input(
			z.object({
				code: z
					.string()
					.length(6)
					.regex(/^\d{6}$/, 'Code must be 6 digits'),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const sessionToken = ctx.session.session.token

			// Require identity verification for security
			await requireChallenge(sessionToken, 'identity')

			// Get pending 2FA setup
			const twoFactor = await db.query.twoFactors.findFirst({
				where: eq(twoFactors.userId, ctx.user.id),
			})

			if (!twoFactor) {
				throw new TRPCError({
					code: 'NOT_FOUND',
					message: 'No 2FA setup in progress. Please start setup first.',
				})
			}

			// Check if already enabled
			const user = await db.query.users.findFirst({
				where: eq(users.id, ctx.user.id),
			})

			if (user?.twoFactorEnabled) {
				throw new TRPCError({
					code: 'BAD_REQUEST',
					message: 'Two-factor authentication is already enabled',
				})
			}

			// Decrypt secret
			const key = getEncryptionKey()
			const secret = await decryptTotpSecret(twoFactor.secret, key)

			// Verify TOTP code
			const isValid = authenticator.verify({ token: input.code, secret })

			if (!isValid) {
				throw new TRPCError({
					code: 'BAD_REQUEST',
					message: 'Invalid verification code. Please try again.',
				})
			}

			// Enable 2FA on user and mark session as verified (atomic transaction)
			await db.transaction(async (tx) => {
				await tx
					.update(users)
					.set({
						twoFactorEnabled: true,
						updatedAt: new Date(),
					})
					.where(eq(users.id, ctx.user.id))

				// Mark current session as 2FA verified (user just proved they have the authenticator)
				await tx
					.update(sessions)
					.set({ twoFactorVerified: true })
					.where(eq(sessions.token, sessionToken))
			})

			// Create security alert (non-critical, no email)
			await createSecurityAlert(ctx.user.id, '2fa_enabled')

			return { success: true }
		}),

	/**
	 * Disable 2FA
	 * Requires identity challenge + valid TOTP code (implicit MFA)
	 * Rate limited to prevent brute force attacks
	 */
	disable: protectedRateLimitedProcedure
		.input(
			z.object({
				code: z
					.string()
					.length(6)
					.regex(/^\d{6}$/, 'Code must be 6 digits'),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const sessionToken = ctx.session.session.token

			// Require identity verification for security
			// Note: MFA verification is handled by the TOTP code requirement below
			await requireChallenge(sessionToken, 'identity')

			// Use SSOT permission check (checks both enabled status and admin restriction)
			const authState = await getAuthState(ctx.user.id)
			if (!canDisable2FA(authState)) {
				const reason = getDisable2FABlockedReason(authState)
				throw new TRPCError({
					code: authState.twoFactorEnabled ? 'FORBIDDEN' : 'BAD_REQUEST',
					message: reason ?? 'Cannot disable two-factor authentication',
				})
			}

			// Get 2FA secret
			const twoFactor = await db.query.twoFactors.findFirst({
				where: eq(twoFactors.userId, ctx.user.id),
			})

			if (!twoFactor) {
				throw new TRPCError({
					code: 'NOT_FOUND',
					message: '2FA configuration not found',
				})
			}

			// Decrypt and verify code
			const key = getEncryptionKey()
			const secret = await decryptTotpSecret(twoFactor.secret, key)
			const isValid = authenticator.verify({ token: input.code, secret })

			if (!isValid) {
				throw new TRPCError({
					code: 'BAD_REQUEST',
					message: 'Invalid verification code',
				})
			}

			// Disable 2FA and delete secret (atomic transaction)
			await db.transaction(async (tx) => {
				await tx
					.update(users)
					.set({
						twoFactorEnabled: false,
						updatedAt: new Date(),
					})
					.where(eq(users.id, ctx.user.id))

				// Delete 2FA secret
				await tx.delete(twoFactors).where(eq(twoFactors.userId, ctx.user.id))
			})

			// Create security alert (critical - sends email notification)
			await createSecurityAlert(ctx.user.id, '2fa_disabled')

			return { success: true }
		}),

	/**
	 * Regenerate backup codes
	 * Requires identity challenge + valid TOTP code
	 * Rate limited to prevent abuse
	 */
	regenerateBackupCodes: protectedRateLimitedProcedure
		.input(
			z.object({
				code: z
					.string()
					.length(6)
					.regex(/^\d{6}$/, 'Code must be 6 digits'),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const sessionToken = ctx.session.session.token

			// Require identity verification for security
			await requireChallenge(sessionToken, 'identity')

			// Check if 2FA is enabled
			const user = await db.query.users.findFirst({
				where: eq(users.id, ctx.user.id),
			})

			if (!user?.twoFactorEnabled) {
				throw new TRPCError({
					code: 'BAD_REQUEST',
					message: 'Two-factor authentication is not enabled',
				})
			}

			// Get 2FA secret
			const twoFactor = await db.query.twoFactors.findFirst({
				where: eq(twoFactors.userId, ctx.user.id),
			})

			if (!twoFactor) {
				throw new TRPCError({
					code: 'NOT_FOUND',
					message: '2FA configuration not found',
				})
			}

			// Verify code
			const key = getEncryptionKey()
			const secret = await decryptTotpSecret(twoFactor.secret, key)
			const isValid = authenticator.verify({ token: input.code, secret })

			if (!isValid) {
				throw new TRPCError({
					code: 'BAD_REQUEST',
					message: 'Invalid verification code',
				})
			}

			// Generate new backup codes
			const { backupCodes, encryptedBackupCodes } = await generateBackupCodes(key)

			// Update in database
			await db
				.update(twoFactors)
				.set({ backupCodes: encryptedBackupCodes, updatedAt: new Date() })
				.where(eq(twoFactors.userId, ctx.user.id))

			return { backupCodes }
		}),

	/**
	 * View current backup codes
	 * Requires identity challenge
	 */
	viewBackupCodes: protectedProcedure.query(async ({ ctx }) => {
		const sessionToken = ctx.session.session.token

		// Require identity verification for security
		await requireChallenge(sessionToken, 'identity')

		// Check if 2FA is enabled
		const user = await db.query.users.findFirst({
			where: eq(users.id, ctx.user.id),
		})

		if (!user?.twoFactorEnabled) {
			throw new TRPCError({
				code: 'BAD_REQUEST',
				message: 'Two-factor authentication is not enabled',
			})
		}

		// Get 2FA data
		const twoFactor = await db.query.twoFactors.findFirst({
			where: eq(twoFactors.userId, ctx.user.id),
		})

		if (!twoFactor) {
			throw new TRPCError({
				code: 'NOT_FOUND',
				message: '2FA configuration not found',
			})
		}

		// Decrypt backup codes
		const key = getEncryptionKey()
		const codes = await decryptBackupCodes(twoFactor.backupCodes, key)

		return { backupCodes: codes ?? [] }
	}),

	/**
	 * Cancel pending 2FA setup
	 * Rate limited to prevent abuse
	 */
	cancelSetup: protectedRateLimitedProcedure.mutation(async ({ ctx }) => {
		// Check if user has 2FA enabled (can't cancel if already active)
		const user = await db.query.users.findFirst({
			where: eq(users.id, ctx.user.id),
		})

		if (user?.twoFactorEnabled) {
			throw new TRPCError({
				code: 'BAD_REQUEST',
				message: 'Two-factor authentication is already enabled. Use disable instead.',
			})
		}

		// Delete any pending setup
		await db.delete(twoFactors).where(eq(twoFactors.userId, ctx.user.id))

		return { success: true }
	}),

	// Note: MFA verification (verifySession) moved to challenge router as verifyMfa
	// Note: Session status (getSessionVerificationStatus) moved to challenge router as getStatus
})
