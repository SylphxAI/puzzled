/**
 * Auth State - Puzzled Application Layer
 *
 * Re-exports pure functions from @sylphx/auth/state and provides
 * app-specific database fetching functions.
 *
 * INVARIANT: A user must ALWAYS have at least ONE way to authenticate.
 * This means: hasCredential || oauthProviders.length >= 1
 */

import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { accounts, type UserRole, userRoleEnum, users } from '@/lib/db/schema'

// ============================================================================
// Re-exports from @sylphx/auth/state (Pure Functions)
// ============================================================================

export {
	// Types
	type AuthState,
	type AuthStateWithAccounts,
	type MinimalAuthState,
	// Constants
	CREDENTIAL_PROVIDER_ID,
	// Pure functions - State Building
	buildAuthStateFromAccounts,
	extractAuthMethods,
	// Pure functions - Permission Checks
	canChangePassword,
	canDisable2FA,
	canDisconnectOAuth,
	canEnable2FA,
	canPromoteToAdmin,
	canRemovePassword,
	canSetPassword,
	getAuthMethodCount,
	getDisable2FABlockedReason,
	getDisconnectBlockedReason,
	getPromotionBlockedReason,
	getSecurityScore,
	hasMinimumAuthMethods,
	mustEnable2FA,
} from '@sylphx/auth/state'

// Re-export UserRole from local schema (SSOT for this app)
export type { UserRole }

// Import from package for internal use
import { extractAuthMethods as extractMethods } from '@sylphx/auth/state'

// ============================================================================
// Type Guards (App-specific validation)
// ============================================================================

/**
 * Valid user roles derived from schema enum.
 * Used for runtime validation.
 */
const VALID_ROLES = userRoleEnum.enumValues as readonly string[]

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

// ============================================================================
// Database Fetching (App-specific)
// ============================================================================

// Import types for local use
import type { AuthState, AuthStateWithAccounts } from '@sylphx/auth/state'

/**
 * Fetch complete auth state for a user from database
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

	const { hasCredential, oauthProviders } = extractMethods(userAccounts)

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

	const { hasCredential, oauthProviders } = extractMethods(userAccounts)

	return {
		hasCredential,
		oauthProviders,
		twoFactorEnabled: user.twoFactorEnabled ?? false,
		role: assertUserRole(user.role),
		emailVerified: user.emailVerified ?? false,
		accounts: userAccounts,
	}
}
