// Server-only exports - NOT for client bundles

export type { Session, SessionUser } from './lib/auth'
export { auth } from './lib/auth'
export { getServerSession, getServerUser, requireServerUser } from './lib/auth-server'
// enabledProviders moved to @/lib/oauth-providers

// Auth state - SSOT for permission checks
export {
	type AuthState,
	type AuthStateWithAccounts,
	buildAuthStateFromAccounts,
	CREDENTIAL_PROVIDER_ID,
	canChangePassword,
	canDisable2FA,
	canDisconnectOAuth,
	canEnable2FA,
	canPromoteToAdmin,
	canRemovePassword,
	canSetPassword,
	getAuthMethodCount,
	getAuthState,
	getAuthStateWithAccounts,
	getDisable2FABlockedReason,
	getDisconnectBlockedReason,
	getPromotionBlockedReason,
	getSecurityScore,
	hasMinimumAuthMethods,
	type MinimalAuthState,
	mustEnable2FA,
	type UserRole,
} from './lib/auth-state'
