/**
 * Sylphx Auth Context
 *
 * React context for managing authentication state.
 */

import { createContext } from 'react'
import type { User, OAuthProviderId } from '../types'

// Re-export for convenience
export type { OAuthProviderId }

export interface AuthState {
	/** Whether auth state has been loaded from storage */
	isLoaded: boolean
	/** Whether user is currently signed in */
	isSignedIn: boolean
	/** Current user data */
	user: User | null
	/** Access token for API calls */
	accessToken: string | null
	/** Refresh token for getting new access tokens */
	refreshToken: string | null
	/** Auth error (e.g., token refresh failed) */
	error: Error | null
}

export interface SignInOptions {
	/** URL to redirect back to after sign in */
	redirectUrl?: string
	/**
	 * OAuth providers to show (SDK-level filtering)
	 * - undefined/null = show all app-enabled providers
	 * - [] = hide OAuth (email only)
	 * - ['google'] = only show these
	 */
	providers?: OAuthProviderId[] | null
}

export interface ResetPasswordOptions {
	/** Reset password token from email */
	token: string
	/** New password */
	newPassword: string
}

export interface VerifyEmailOptions {
	/** Verification token from email */
	token: string
}

export interface ResendVerificationEmailOptions {
	/** Email address to resend verification to */
	email: string
}

export interface ForgotPasswordOptions {
	/** Email address to send reset link to */
	email: string
}

export interface AuthContextValue extends AuthState {
	/** Auth error (e.g., token refresh failed) */
	error: Error | null
	/** Redirect to Sylphx login page */
	signIn: (options?: SignInOptions) => void
	/** Redirect to Sylphx signup page */
	signUp: (options?: SignInOptions) => void
	/** Sign out and clear tokens */
	signOut: (options?: { redirectUrl?: string }) => Promise<void>
	/** Get current access token (refreshes if expired) */
	getToken: () => Promise<string | null>
	/** Handle OAuth callback (code exchange) */
	handleCallback: (code: string, state?: string) => Promise<void>
	/** Reset password with token */
	resetPassword: (options: ResetPasswordOptions) => Promise<void>
	/** Verify email with token */
	verifyEmail: (options: VerifyEmailOptions) => Promise<void>
	/** Resend verification email */
	resendVerificationEmail: (options: ResendVerificationEmailOptions) => Promise<void>
	/** Request password reset email */
	forgotPassword: (options: ForgotPasswordOptions) => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
