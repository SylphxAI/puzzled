/**
 * Auth Library Exports
 *
 * Re-exports from @sylphx/auth packages with app-specific additions.
 */

export type { Session, SessionUser } from './auth'
export { auth } from './auth'

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

// Re-export password validation from @sylphx/auth
export {
	getPasswordStrength,
	getStrengthColor,
	getStrengthLabel,
	isPasswordValid,
	PASSWORD_REQUIREMENTS,
	validatePassword,
	type PasswordStrength,
	type PasswordStrengthLabel,
	type PasswordValidationResult,
} from '@sylphx/auth/password'
