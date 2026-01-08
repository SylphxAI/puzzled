export type { Session, SessionUser } from './auth'
export { auth } from './auth'
// enabledProviders moved to @/lib/oauth-providers

export {
	authClient,
	sendVerificationEmail,
	signIn,
	signOut,
	signUp,
	useSession,
	verifyEmail,
} from './auth-client'

export { getServerSession, getServerUser } from './auth-server'

export {
	getPasswordStrength,
	getStrengthLabel,
	PASSWORD_REQUIREMENTS,
	type PasswordValidationResult,
	validatePassword,
} from './password-validation'
