/**
 * Auth Functions
 *
 * Pure functions for authentication - no hidden state.
 * Each function takes config as the first parameter.
 */

import { type SylphxConfig, callTrpc, buildHeaders } from './config'

// ============================================================================
// Types
// ============================================================================

export interface SignInInput {
	email: string
	password: string
}

export interface SignInResult {
	/** Whether 2FA is required before completing sign-in */
	requiresTwoFactor: boolean
	/** User ID (available even if 2FA required) */
	userId?: string
	/** Access token (only if 2FA not required) */
	accessToken?: string
	/** Refresh token (only if 2FA not required) */
	refreshToken?: string
	/** Token expiry in seconds (only if 2FA not required) */
	expiresIn?: number
	/** User info (only if 2FA not required) */
	user?: {
		id: string
		email: string
		name: string | null
		image: string | null
	}
}

export interface SignUpInput {
	email: string
	password: string
	name?: string
}

export interface SignUpResult {
	/** Whether email verification is required */
	requiresVerification: boolean
	/** User info */
	user: {
		id: string
		email: string
		name: string | null
	}
}

export interface TokenResult {
	accessToken: string
	refreshToken: string
	expiresIn: number
	user: {
		id: string
		email: string
		name: string | null
		image: string | null
	}
}

export interface SessionResult {
	user: {
		id: string
		email: string
		name: string | null
		image: string | null
		emailVerified: boolean
	} | null
}

// ============================================================================
// Functions
// ============================================================================

/**
 * Sign in with email and password
 *
 * @example
 * ```typescript
 * const result = await signIn(config, { email: 'user@example.com', password: 'secret' })
 * if (result.requiresTwoFactor) {
 *   // Handle 2FA flow
 * } else {
 *   // Save tokens
 *   const authenticatedConfig = withToken(config, result.accessToken!)
 * }
 * ```
 */
export async function signIn(config: SylphxConfig, input: SignInInput): Promise<SignInResult> {
	return callTrpc<SignInInput, SignInResult>(config, 'auth.login', input, 'mutation')
}

/**
 * Sign up with email and password
 *
 * @example
 * ```typescript
 * const result = await signUp(config, {
 *   email: 'user@example.com',
 *   password: 'secret',
 *   name: 'John Doe',
 * })
 * // User needs to verify email
 * ```
 */
export async function signUp(config: SylphxConfig, input: SignUpInput): Promise<SignUpResult> {
	const result = await callTrpc<SignUpInput, { user: SignUpResult['user'] }>(
		config,
		'auth.register',
		input,
		'mutation'
	)
	return {
		requiresVerification: true,
		user: result.user,
	}
}

/**
 * Sign out (revoke tokens)
 *
 * @example
 * ```typescript
 * await signOut(config)
 * ```
 */
export async function signOut(config: SylphxConfig): Promise<void> {
	await callTrpc<void, void>(config, 'auth.logout', undefined, 'mutation')
}

/**
 * Refresh access token
 *
 * @example
 * ```typescript
 * const tokens = await refreshToken(config, refreshTokenString)
 * const newConfig = withToken(config, tokens.accessToken)
 * ```
 */
export async function refreshToken(
	config: SylphxConfig,
	token: string
): Promise<TokenResult> {
	const response = await fetch(`${config.platformUrl}/api/auth/token`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			grant_type: 'refresh_token',
			refresh_token: token,
			app_id: config.appId,
		}),
	})

	if (!response.ok) {
		const error = await response.json().catch(() => ({ message: 'Token refresh failed' }))
		throw new Error(error.message ?? 'Token refresh failed')
	}

	return response.json()
}

/**
 * Verify email with token
 *
 * @example
 * ```typescript
 * await verifyEmail(config, token)
 * ```
 */
export async function verifyEmail(config: SylphxConfig, token: string): Promise<void> {
	const response = await fetch(`${config.platformUrl}/api/auth/verify-email`, {
		method: 'POST',
		headers: buildHeaders(config),
		body: JSON.stringify({ token, app_id: config.appId }),
	})

	if (!response.ok) {
		const error = await response.json().catch(() => ({ message: 'Email verification failed' }))
		throw new Error(error.message ?? 'Email verification failed')
	}
}

/**
 * Request password reset email
 *
 * @example
 * ```typescript
 * await forgotPassword(config, 'user@example.com')
 * ```
 */
export async function forgotPassword(config: SylphxConfig, email: string): Promise<void> {
	await callTrpc<{ email: string }, { success: boolean }>(
		config,
		'auth.forgotPassword',
		{ email },
		'mutation'
	)
}

/**
 * Reset password with token
 *
 * @example
 * ```typescript
 * await resetPassword(config, { token, password: 'newpassword' })
 * ```
 */
export async function resetPassword(
	config: SylphxConfig,
	input: { token: string; password: string }
): Promise<void> {
	await callTrpc<typeof input, { success: boolean }>(
		config,
		'auth.resetPassword',
		input,
		'mutation'
	)
}

/**
 * Get current session (requires authenticated config)
 *
 * @example
 * ```typescript
 * const session = await getSession(authenticatedConfig)
 * if (session.user) {
 *   console.log(`Logged in as ${session.user.email}`)
 * }
 * ```
 */
export async function getSession(config: SylphxConfig): Promise<SessionResult> {
	if (!config.accessToken) {
		return { user: null }
	}

	try {
		const profile = await callTrpc<void, SessionResult['user']>(
			config,
			'user.getProfile',
			undefined,
			'query'
		)
		return { user: profile }
	} catch {
		return { user: null }
	}
}

/**
 * Verify 2FA code (when signIn returns requiresTwoFactor: true)
 *
 * @example
 * ```typescript
 * const result = await signIn(config, credentials)
 * if (result.requiresTwoFactor) {
 *   const tokens = await verifyTwoFactor(config, result.userId!, code)
 * }
 * ```
 */
export async function verifyTwoFactor(
	config: SylphxConfig,
	userId: string,
	code: string
): Promise<TokenResult> {
	return callTrpc<{ userId: string; code: string }, TokenResult>(
		config,
		'auth.verifyTwoFactor',
		{ userId, code },
		'mutation'
	)
}
