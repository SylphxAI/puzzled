/**
 * Unified Challenge System
 *
 * Single source of truth for all authentication challenges.
 * Replaces the fragmented reauth + step-up auth systems.
 *
 * Two challenge types:
 * - Identity: Proves account ownership (password OR email code)
 * - MFA: Proves device possession (TOTP OR backup code)
 *
 * Three requirement levels:
 * - 'identity': Only identity verification needed
 * - 'mfa': Only MFA verification needed
 * - 'both': Both required (for critical operations)
 *
 * @see https://auth0.com/docs/secure/multi-factor-authentication/step-up-authentication
 */

import { TRPCError } from '@trpc/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { sessions } from '@/lib/db/schema'

// ==================
// Types
// ==================

export type ChallengeType = 'identity' | 'mfa' | 'both'

export type IdentityMethod = 'password' | 'email'
export type MfaMethod = 'totp' | 'backup'

export interface ChallengeStatus {
	/** Whether identity challenge is currently satisfied */
	identityVerified: boolean
	/** When identity verification expires (null if not verified) */
	identityExpiresAt: Date | null
	/** Method used for identity verification */
	identityMethod: IdentityMethod | null

	/** Whether MFA challenge is currently satisfied */
	mfaVerified: boolean
	/** When MFA verification expires (null = session lifetime) */
	mfaExpiresAt: Date | null
	/** Method used for MFA verification */
	mfaMethod: MfaMethod | null

	/** User's available identity methods */
	availableIdentityMethods: IdentityMethod[]
	/** User's available MFA methods */
	availableMfaMethods: MfaMethod[]

	/** Whether user has 2FA enabled */
	userHas2FA: boolean
	/** Whether user has a password set */
	userHasPassword: boolean
}

// ==================
// Constants (SSOT)
// ==================

/** How long identity verification remains valid (minutes) */
export const IDENTITY_CHALLENGE_TTL_MINUTES = 10

/** How long MFA verification remains valid (null = session lifetime) */
export const MFA_CHALLENGE_TTL_MINUTES: number | null = null

/** Stricter TTL for critical operations requiring both (minutes) */
export const CRITICAL_CHALLENGE_TTL_MINUTES = 5

/** Max failed attempts before lockout */
export const MAX_FAILED_ATTEMPTS = 5

/** Lockout duration after max failed attempts (minutes) */
export const LOCKOUT_DURATION_MINUTES = 15

/** Email verification code expiry (minutes) */
export const EMAIL_CODE_EXPIRY_MINUTES = 10

// ==================
// Session State Helpers
// ==================

/**
 * Check if identity challenge is satisfied
 * Uses sessions.verifiedAt with TTL check
 */
export async function isIdentityVerified(sessionToken: string): Promise<boolean> {
	const [session] = await db
		.select({ verifiedAt: sessions.verifiedAt })
		.from(sessions)
		.where(eq(sessions.token, sessionToken))
		.limit(1)

	if (!session?.verifiedAt) {
		return false
	}

	const verifiedAt = new Date(session.verifiedAt)
	const expiresAt = new Date(verifiedAt.getTime() + IDENTITY_CHALLENGE_TTL_MINUTES * 60 * 1000)

	return new Date() < expiresAt
}

/**
 * Check if MFA challenge is satisfied
 * Uses sessions.twoFactorVerified (currently boolean, session lifetime)
 */
export async function isMfaVerified(sessionToken: string): Promise<boolean> {
	const [session] = await db
		.select({ twoFactorVerified: sessions.twoFactorVerified })
		.from(sessions)
		.where(eq(sessions.token, sessionToken))
		.limit(1)

	return session?.twoFactorVerified ?? false
}

/**
 * Check if a specific challenge requirement is satisfied
 */
export async function isChallengeVerified(
	sessionToken: string,
	requirement: ChallengeType,
): Promise<boolean> {
	switch (requirement) {
		case 'identity':
			return isIdentityVerified(sessionToken)
		case 'mfa':
			return isMfaVerified(sessionToken)
		case 'both': {
			const [identity, mfa] = await Promise.all([
				isIdentityVerified(sessionToken),
				isMfaVerified(sessionToken),
			])
			return identity && mfa
		}
	}
}

/**
 * Mark identity as verified
 */
export async function markIdentityVerified(sessionToken: string): Promise<void> {
	await db
		.update(sessions)
		.set({ verifiedAt: new Date(), updatedAt: new Date() })
		.where(eq(sessions.token, sessionToken))
}

/**
 * Mark MFA as verified
 */
export async function markMfaVerified(sessionToken: string): Promise<void> {
	await db
		.update(sessions)
		.set({ twoFactorVerified: true, updatedAt: new Date() })
		.where(eq(sessions.token, sessionToken))
}

/**
 * Clear all challenge verifications for a session
 *
 * Use cases:
 * - Security reset (suspicious activity detected)
 * - Admin forcing re-verification
 * - Session downgrade
 *
 * Note: Not needed on logout - session deletion clears verifications automatically.
 */
export async function clearChallenges(sessionToken: string): Promise<void> {
	await db
		.update(sessions)
		.set({
			verifiedAt: null,
			twoFactorVerified: false,
			updatedAt: new Date(),
		})
		.where(eq(sessions.token, sessionToken))
}

// ==================
// Requirement Enforcement
// ==================

/**
 * Error thrown when challenge is required
 */
export class ChallengeRequiredError extends TRPCError {
	constructor(
		public readonly requirement: ChallengeType,
		message?: string,
	) {
		super({
			code: 'FORBIDDEN',
			message: message ?? getChallengeMessage(requirement),
		})
		this.name = 'ChallengeRequiredError'
	}
}

/**
 * Get user-friendly message for challenge requirement
 */
function getChallengeMessage(requirement: ChallengeType): string {
	switch (requirement) {
		case 'identity':
			return 'Please verify your identity to continue'
		case 'mfa':
			return 'Please verify with your authenticator to continue'
		case 'both':
			return 'Please complete identity and MFA verification to continue'
	}
}

/**
 * Require a challenge to be satisfied, throw if not
 */
export async function requireChallenge(
	sessionToken: string,
	requirement: ChallengeType,
): Promise<void> {
	const verified = await isChallengeVerified(sessionToken, requirement)
	if (!verified) {
		throw new ChallengeRequiredError(requirement)
	}
}

// ==================
// Operation Requirements (SSOT)
// ==================

/**
 * Map of operations to their challenge requirements
 *
 * SSOT for what verification each operation needs.
 * Exported for documentation and API consistency.
 * Routers currently use requireChallenge directly for flexibility.
 *
 * Note: Some operations (like twoFactor.disable, backupCodes.regenerate) also
 * require a valid TOTP code as an additional verification, which is handled
 * separately in the router logic.
 */
export const OPERATION_REQUIREMENTS = {
	// Identity only (10 min TTL)
	'oauth.disconnect': 'identity',
	'email.change': 'identity',
	'password.change': 'identity',
	'password.set': 'identity',
	'session.revoke': 'identity',
	'session.revokeAll': 'identity',
	'twoFactor.setup': 'identity',
	'twoFactor.verify': 'identity',
	'backupCodes.view': 'identity', // View requires identity; user may have lost authenticator
	'backupCodes.regenerate': 'identity', // Also requires TOTP code (handled in router)

	// MFA only (session TTL)
	'admin.access': 'mfa',

	// Both required (smart: only requires MFA if user has 2FA enabled)
	'account.delete': 'both',
	'twoFactor.disable': 'identity', // Also requires TOTP code (handled in router)
} as const satisfies Record<string, ChallengeType>

export type Operation = keyof typeof OPERATION_REQUIREMENTS

/**
 * Get the challenge requirement for an operation
 */
export function getOperationRequirement(operation: Operation): ChallengeType {
	return OPERATION_REQUIREMENTS[operation]
}

/**
 * Require challenge for a specific operation (using OPERATION_REQUIREMENTS map)
 *
 * Alternative to requireChallenge() that uses the SSOT operation mapping.
 * Currently exported for API completeness; routers use requireChallenge directly.
 */
export async function requireChallengeForOperation(
	sessionToken: string,
	operation: Operation,
): Promise<void> {
	const requirement = getOperationRequirement(operation)
	await requireChallenge(sessionToken, requirement)
}
