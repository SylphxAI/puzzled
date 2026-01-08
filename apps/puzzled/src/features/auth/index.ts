// Client components - safe for client bundles
export { ChallengeDialog } from './components/challenge-dialog'
export { ManageSubscriptionButton } from './components/manage-subscription-button'
export { MfaSetup } from './components/mfa-setup'
export { PasswordStrength } from './components/password-strength'
export { SocialLoginButtons } from './components/social-login-buttons'

// Hooks
export { useChallenge } from './hooks/use-challenge'
export { useGuestDataMigration } from './hooks/use-guest-data-migration'
export { useIsAdmin } from './hooks/use-is-admin'
// Client auth - safe for client bundles
export {
	authClient,
	sendVerificationEmail,
	signIn,
	signOut,
	signUp,
	useSession,
	verifyEmail,
} from './lib/auth-client'

// Password validation - client-safe (re-exported from @sylphx/auth/password via lib)
export {
	getPasswordStrength,
	getStrengthLabel,
	PASSWORD_REQUIREMENTS,
	type PasswordValidationResult,
	validatePassword,
} from './lib'
