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
	/** Whether an OAuth flow is in progress (loading authorization URL or exchanging code) */
	isOAuthLoading: boolean
	/** OAuth-specific error (e.g., user denied, provider error) */
	oauthError: Error | null
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

/**
 * Options for magic link (passwordless) sign-in.
 */
export interface SignInWithMagicLinkOptions {
	/** Email address to send magic link to */
	email: string
	/** URL to redirect back to after magic link verification. Defaults to current URL. */
	redirectUrl?: string
}

/**
 * Options for direct OAuth sign-in (Firebase/Supabase pattern).
 * User goes directly to OAuth provider, bypassing platform UI.
 */
export interface SignInWithOAuthOptions {
	/** OAuth provider to use */
	provider: OAuthProviderId
	/** URL to redirect back to after OAuth completes. Defaults to current URL. */
	redirectUrl?: string
	/**
	 * Additional OAuth scopes to request from the provider.
	 * Default scopes (email, profile) are always included.
	 *
	 * @example
	 * ```tsx
	 * // Request Google Calendar access
	 * signInWithOAuth({
	 *   provider: 'google',
	 *   scopes: ['https://www.googleapis.com/auth/calendar.readonly']
	 * })
	 *
	 * // Request GitHub private repo access
	 * signInWithOAuth({
	 *   provider: 'github',
	 *   scopes: ['repo']
	 * })
	 * ```
	 */
	scopes?: string[]
}

export interface AuthContextValue extends AuthState {
	/** Auth error (e.g., token refresh failed) */
	error: Error | null
	/** Whether an OAuth flow is in progress */
	isOAuthLoading: boolean
	/** OAuth-specific error */
	oauthError: Error | null
	/** Clear OAuth error state */
	clearOAuthError: () => void
	/** Redirect to Sylphx login page (shows platform UI) */
	signIn: (options?: SignInOptions) => void
	/** Redirect to Sylphx signup page (shows platform UI) */
	signUp: (options?: SignInOptions) => void
	/** Sign out and clear tokens */
	signOut: (options?: { redirectUrl?: string }) => Promise<void>
	/** Get current access token (refreshes if expired) */
	getToken: () => Promise<string | null>
	/** Reset password with token */
	resetPassword: (options: ResetPasswordOptions) => Promise<void>
	/** Verify email with token */
	verifyEmail: (options: VerifyEmailOptions) => Promise<void>
	/** Resend verification email */
	resendVerificationEmail: (options: ResendVerificationEmailOptions) => Promise<void>
	/** Request password reset email */
	forgotPassword: (options: ForgotPasswordOptions) => Promise<void>

	// ==========================================
	// Direct OAuth Methods (Firebase/Supabase pattern)
	// User goes directly to OAuth provider - no platform UI
	// ==========================================

	/**
	 * Sign in with OAuth provider directly.
	 * Redirects user straight to the OAuth provider (Google, GitHub, etc.)
	 * without showing the platform login UI.
	 *
	 * @example
	 * ```tsx
	 * const { signInWithOAuth } = useAuth()
	 *
	 * // Direct to Google consent screen
	 * await signInWithOAuth({ provider: 'google' })
	 *
	 * // With custom redirect
	 * await signInWithOAuth({ provider: 'github', redirectUrl: '/dashboard' })
	 * ```
	 */
	signInWithOAuth: (options: SignInWithOAuthOptions) => Promise<void>

	/** Convenience: Sign in with Google directly */
	signInWithGoogle: (redirectUrl?: string) => Promise<void>

	/** Convenience: Sign in with GitHub directly */
	signInWithGithub: (redirectUrl?: string) => Promise<void>

	/** Convenience: Sign in with Apple directly */
	signInWithApple: (redirectUrl?: string) => Promise<void>

	/** Convenience: Sign in with Discord directly */
	signInWithDiscord: (redirectUrl?: string) => Promise<void>

	/** Convenience: Sign in with Twitter directly */
	signInWithTwitter: (redirectUrl?: string) => Promise<void>

	/** Convenience: Sign in with Microsoft directly */
	signInWithMicrosoft: (redirectUrl?: string) => Promise<void>

	// ==========================================
	// Magic Link (Passwordless) Methods
	// ==========================================

	/**
	 * Sign in with magic link (passwordless).
	 * Sends an email with a one-time login link.
	 * User clicks the link and is automatically signed in.
	 *
	 * @example
	 * ```tsx
	 * const { signInWithMagicLink } = useAuth()
	 *
	 * // Request magic link email
	 * await signInWithMagicLink({ email: 'user@example.com' })
	 *
	 * // With custom redirect after verification
	 * await signInWithMagicLink({
	 *   email: 'user@example.com',
	 *   redirectUrl: '/dashboard'
	 * })
	 * ```
	 */
	signInWithMagicLink: (options: SignInWithMagicLinkOptions) => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
