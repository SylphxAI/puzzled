/**
 * Auth State - Single Source of Truth for Authentication Permissions
 *
 * This module defines the EXACT rules for what authentication operations
 * are allowed based on a user's current authentication state.
 *
 * INVARIANT: A user must ALWAYS have at least ONE way to authenticate.
 * This means: hasCredential || oauthProviders.length >= 1
 */

import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { accounts, type UserRole, userRoleEnum, users } from '@/lib/db/schema'
import { isAdminRole } from '@/lib/roles'

// Re-export for consumers of this module
export type { UserRole }

// ============================================================================
// Constants
// ============================================================================

/**
 * Provider ID for credential (email/password) authentication.
 * Used by better-auth to identify password-based accounts.
 */
export const CREDENTIAL_PROVIDER_ID = 'credential' as const

/**
 * Valid user roles derived from schema enum.
 * Used for runtime validation.
 */
const VALID_ROLES = userRoleEnum.enumValues as readonly string[]

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Runtime type guard for UserRole.
 * Validates that a value is a valid user role from the schema enum.
 */
function isUserRole(value: unknown): value is UserRole {
	return typeof value === 'string' && VALID_ROLES.includes(value)
}

/**
 * Assert and return a valid UserRole.
 * Throws if the value is not a valid role (should never happen with proper DB constraints).
 */
function assertUserRole(value: unknown): UserRole {
	if (!isUserRole(value)) {
		throw new Error(`Invalid user role: ${String(value)}`)
	}
	return value
}

export interface AuthState {
	/** User has a password (credential account exists) */
	hasCredential: boolean
	/** List of connected OAuth provider IDs */
	oauthProviders: string[]
	/** 2FA is enabled for this user */
	twoFactorEnabled: boolean
	/** User's role */
	role: UserRole
	/** Email is verified */
	emailVerified: boolean
}

export interface AuthStateWithAccounts extends AuthState {
	/** Full account records for mutations */
	accounts: Array<{
		id: string
		providerId: string
		accountId: string
		createdAt: Date
	}>
}

/**
 * Minimal auth state for account-level permission checks
 * Used when building state from transaction data (TOCTOU safety)
 */
export type MinimalAuthState = Pick<AuthState, 'hasCredential' | 'oauthProviders'>

// ============================================================================
// State Building (Pure Functions)
// ============================================================================

/**
 * Extract authentication methods from account records
 *
 * Pure helper function that categorizes accounts into credential vs OAuth.
 * Used internally to build auth state from any list of accounts.
 */
function extractAuthMethods(accountRecords: Array<{ providerId: string }>): MinimalAuthState {
	const hasCredential = accountRecords.some((a) => a.providerId === CREDENTIAL_PROVIDER_ID)
	const oauthProviders = accountRecords
		.filter((a) => a.providerId !== CREDENTIAL_PROVIDER_ID)
		.map((a) => a.providerId)

	return { hasCredential, oauthProviders }
}

/**
 * Build minimal auth state from raw account records
 *
 * Use this within transactions for TOCTOU-safe permission checks.
 * The returned state can be used with canDisconnectOAuth and getDisconnectBlockedReason.
 *
 * @example
 * // Within a transaction
 * const accounts = await tx.select(...).from(accounts).where(...)
 * const authState = buildAuthStateFromAccounts(accounts)
 * if (!canDisconnectOAuth(authState, providerId)) { throw ... }
 */
export function buildAuthStateFromAccounts(
	accountRecords: Array<{ providerId: string }>,
): MinimalAuthState {
	return extractAuthMethods(accountRecords)
}

// ============================================================================
// State Fetching
// ============================================================================

/**
 * Fetch complete auth state for a user
 * Use this for permission checks before mutations
 */
export async function getAuthState(userId: string): Promise<AuthState> {
	const [user, userAccounts] = await Promise.all([
		db.query.users.findFirst({
			where: eq(users.id, userId),
			columns: {
				role: true,
				twoFactorEnabled: true,
				emailVerified: true,
			},
		}),
		db.query.accounts.findMany({
			where: eq(accounts.userId, userId),
			columns: {
				providerId: true,
			},
		}),
	])

	if (!user) {
		throw new Error('User not found')
	}

	const { hasCredential, oauthProviders } = extractAuthMethods(userAccounts)

	return {
		hasCredential,
		oauthProviders,
		twoFactorEnabled: user.twoFactorEnabled ?? false,
		role: assertUserRole(user.role),
		emailVerified: user.emailVerified ?? false,
	}
}

/**
 * Fetch auth state with full account records
 * Use this when you need account IDs for mutations
 */
export async function getAuthStateWithAccounts(userId: string): Promise<AuthStateWithAccounts> {
	const [user, userAccounts] = await Promise.all([
		db.query.users.findFirst({
			where: eq(users.id, userId),
			columns: {
				role: true,
				twoFactorEnabled: true,
				emailVerified: true,
			},
		}),
		db.query.accounts.findMany({
			where: eq(accounts.userId, userId),
			columns: {
				id: true,
				providerId: true,
				accountId: true,
				createdAt: true,
			},
		}),
	])

	if (!user) {
		throw new Error('User not found')
	}

	const { hasCredential, oauthProviders } = extractAuthMethods(userAccounts)

	return {
		hasCredential,
		oauthProviders,
		twoFactorEnabled: user.twoFactorEnabled ?? false,
		role: assertUserRole(user.role),
		emailVerified: user.emailVerified ?? false,
		accounts: userAccounts,
	}
}

// ============================================================================
// Permission Checks - OAuth
// ============================================================================

/**
 * Check if user can disconnect a specific OAuth provider
 *
 * Rules:
 * - Provider must be connected
 * - Must have another auth method remaining (password OR another OAuth)
 *
 * Accepts MinimalAuthState for transaction-safe usage.
 */
export function canDisconnectOAuth(state: MinimalAuthState, providerId: string): boolean {
	// Must have this provider connected
	if (!state.oauthProviders.includes(providerId)) {
		return false
	}

	// Can disconnect if: have password OR have 2+ OAuth providers
	return state.hasCredential || state.oauthProviders.length >= 2
}

/**
 * Get reason why OAuth disconnect is not allowed
 *
 * Accepts MinimalAuthState for transaction-safe usage.
 */
export function getDisconnectBlockedReason(
	state: MinimalAuthState,
	providerId: string,
): string | null {
	if (!state.oauthProviders.includes(providerId)) {
		return 'Provider not connected'
	}

	if (!state.hasCredential && state.oauthProviders.length <= 1) {
		return 'Cannot disconnect last authentication method. Set a password first.'
	}

	return null
}

// ============================================================================
// Permission Checks - Password
// ============================================================================

/**
 * Check if user can set a password (OAuth-only users)
 */
export function canSetPassword(state: AuthState): boolean {
	// Cannot set if already has password
	if (state.hasCredential) {
		return false
	}

	// Must have at least one OAuth account
	return state.oauthProviders.length >= 1
}

/**
 * Check if user can change their password
 */
export function canChangePassword(state: AuthState): boolean {
	return state.hasCredential
}

/**
 * Check if user can remove their password
 *
 * Rules:
 * - Must have a password
 * - Must have at least one OAuth provider as backup
 */
export function canRemovePassword(state: AuthState): boolean {
	if (!state.hasCredential) {
		return false
	}

	// Can remove if have at least 1 OAuth provider
	return state.oauthProviders.length >= 1
}

// ============================================================================
// Permission Checks - 2FA
// ============================================================================

/**
 * Check if user can enable 2FA
 */
export function canEnable2FA(state: AuthState): boolean {
	// Cannot enable if already enabled
	if (state.twoFactorEnabled) {
		return false
	}

	// Must have at least one auth method
	return state.hasCredential || state.oauthProviders.length >= 1
}

/**
 * Check if user can disable 2FA
 *
 * Rules:
 * - Must have 2FA enabled
 * - Admins CANNOT disable 2FA (required for role)
 */
export function canDisable2FA(state: AuthState): boolean {
	if (!state.twoFactorEnabled) {
		return false
	}

	// Admins cannot disable 2FA
	if (isAdminRole(state.role)) {
		return false
	}

	return true
}

/**
 * Check if user MUST enable 2FA (admins without 2FA)
 */
export function mustEnable2FA(state: AuthState): boolean {
	return isAdminRole(state.role) && !state.twoFactorEnabled
}

/**
 * Get reason why 2FA disable is not allowed
 */
export function getDisable2FABlockedReason(state: AuthState): string | null {
	if (!state.twoFactorEnabled) {
		return '2FA is not enabled'
	}

	if (isAdminRole(state.role)) {
		return 'Administrators must keep 2FA enabled'
	}

	return null
}

// ============================================================================
// Permission Checks - Role Changes
// ============================================================================

/**
 * Check if user can be promoted to admin
 *
 * Rules:
 * - Must have 2FA enabled first
 */
export function canPromoteToAdmin(state: AuthState): boolean {
	return state.twoFactorEnabled
}

/**
 * Get reason why admin promotion is blocked
 */
export function getPromotionBlockedReason(state: AuthState): string | null {
	if (!state.twoFactorEnabled) {
		return 'Must enable 2FA before becoming an administrator'
	}

	return null
}

// ============================================================================
// Summary Helpers
// ============================================================================

/**
 * Get count of total authentication methods
 */
export function getAuthMethodCount(state: AuthState): number {
	return (state.hasCredential ? 1 : 0) + state.oauthProviders.length
}

/**
 * Check if user has minimum required auth methods
 */
export function hasMinimumAuthMethods(state: AuthState): boolean {
	return getAuthMethodCount(state) >= 1
}

/**
 * Get security score (0-100) based on auth state
 */
export function getSecurityScore(state: AuthState): number {
	let score = 0

	// Base: has any auth method
	if (hasMinimumAuthMethods(state)) score += 20

	// Has password
	if (state.hasCredential) score += 20

	// Has OAuth backup
	if (state.oauthProviders.length >= 1) score += 15

	// Has multiple OAuth providers
	if (state.oauthProviders.length >= 2) score += 10

	// Has both password AND OAuth (can recover either)
	if (state.hasCredential && state.oauthProviders.length >= 1) score += 15

	// Email verified
	if (state.emailVerified) score += 10

	// 2FA enabled
	if (state.twoFactorEnabled) score += 10

	return Math.min(score, 100)
}
