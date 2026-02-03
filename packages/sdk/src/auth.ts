/**
 * Auth Functions
 *
 * Pure functions for authentication - no hidden state.
 * Each function takes config as the first parameter.
 *
 * Uses REST API at /api/sdk/auth/* for all operations.
 *
 * Types are derived from the OpenAPI spec (generated/api.d.ts).
 * Run `bun run generate:types:local` to regenerate after API changes.
 */

import { type SylphxConfig, buildHeaders, callApi } from './config'
import { SylphxError } from './errors'
import type { components } from './generated/api'

// ============================================================================
// Types (re-exported from generated OpenAPI spec)
// ============================================================================

export type LoginRequest = components['schemas']['LoginRequest']
export type LoginResponse = components['schemas']['LoginResponse']
export type RegisterRequest = components['schemas']['RegisterRequest']
export type RegisterResponse = components['schemas']['RegisterResponse']
export type TokenResponse = components['schemas']['TokenResponse']
export type TwoFactorVerifyRequest = components['schemas']['TwoFactorVerifyRequest']
export type MeResponse = components['schemas']['MeResponse']

// SDK-specific types (not directly from API schema)
/**
 * Token introspection result (RFC 7662)
 */
export interface TokenIntrospectionResult {
	/** Whether the token is active/valid */
	active: boolean
	/** Token type (access_token or refresh_token) */
	token_type?: 'access_token' | 'refresh_token'
	/** User ID */
	sub?: string
	/** User email */
	email?: string
	/** User name */
	name?: string
	/** App ID */
	client_id?: string
	/** Audience */
	aud?: string
	/** Issuer */
	iss?: string
	/** Expiration time (Unix timestamp) */
	exp?: number
	/** Issued at time (Unix timestamp) */
	iat?: number
	/** User role */
	role?: string
	/** Email verification status */
	email_verified?: boolean
}

/**
 * Token revocation options
 */
export interface RevokeTokenOptions {
	/** Revoke all tokens for a user in this app */
	revokeAll?: boolean
	/** User ID (required when revoking all) */
	userId?: string
}

// SDK-specific types (not in generated API)
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
export async function signIn(config: SylphxConfig, input: LoginRequest): Promise<LoginResponse> {
	return callApi<LoginResponse>(config, '/auth/login', {
		method: 'POST',
		body: input,
	})
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
export async function signUp(config: SylphxConfig, input: RegisterRequest): Promise<RegisterResponse> {
	return callApi<RegisterResponse>(config, '/auth/register', {
		method: 'POST',
		body: input,
	})
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
	await callApi<void>(config, '/auth/logout', { method: 'POST' })
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
): Promise<TokenResponse> {
	const response = await fetch(`${config.platformUrl}/api/auth/token`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			grant_type: 'refresh_token',
			refresh_token: token,
			client_secret: config.secretKey,
		}),
	})

	if (!response.ok) {
		const error = await response.json().catch(() => ({ message: 'Token refresh failed' }))
		throw new SylphxError(error.message ?? 'Token refresh failed', { code: 'UNAUTHORIZED' })
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
		body: JSON.stringify({ token }),
	})

	if (!response.ok) {
		const error = await response.json().catch(() => ({ message: 'Email verification failed' }))
		throw new SylphxError(error.message ?? 'Email verification failed', { code: 'BAD_REQUEST' })
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
	await callApi<{ success: boolean }>(config, '/auth/forgot-password', {
		method: 'POST',
		body: { email },
	})
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
	await callApi<{ success: boolean }>(config, '/auth/reset-password', {
		method: 'POST',
		body: { token: input.token, newPassword: input.password },
	})
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
		const user = await callApi<SessionResult['user']>(config, '/auth/me')
		return { user }
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
): Promise<TokenResponse> {
	return callApi<TokenResponse>(config, '/auth/verify-2fa', {
		method: 'POST',
		body: { userId, code },
	})
}

/**
 * Introspect a token to check its validity (RFC 7662)
 *
 * Use this to verify token status without decoding. Essential for:
 * - Checking if a token has been revoked
 * - Validating tokens at the edge
 * - Security-critical operations
 *
 * @example
 * ```typescript
 * const result = await introspectToken(config, accessToken)
 * if (!result.active) {
 *   // Token is invalid, revoked, or expired
 *   await refreshTokens()
 * }
 * ```
 */
export async function introspectToken(
	config: SylphxConfig,
	token: string,
	tokenTypeHint?: 'access_token' | 'refresh_token'
): Promise<TokenIntrospectionResult> {
	const response = await fetch(`${config.platformUrl}/api/auth/introspect`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			token,
			token_type_hint: tokenTypeHint,
			client_secret: config.secretKey,
		}),
	})

	if (!response.ok) {
		// Per RFC 7662, errors should return inactive
		return { active: false }
	}

	return response.json()
}

/**
 * Revoke a token (RFC 7009)
 *
 * Use cases:
 * - Sign out user from specific device
 * - Security response to compromised token
 * - User-initiated session termination
 *
 * @example
 * ```typescript
 * // Revoke single refresh token
 * await revokeToken(config, refreshToken)
 *
 * // Revoke all tokens for a user (logout everywhere)
 * await revokeToken(config, '', { revokeAll: true, userId: 'user-123' })
 * ```
 */
export async function revokeToken(
	config: SylphxConfig,
	token: string,
	options?: RevokeTokenOptions
): Promise<void> {
	await fetch(`${config.platformUrl}/api/auth/revoke`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			token: options?.revokeAll ? undefined : token,
			client_secret: config.secretKey,
			user_id: options?.userId,
			revoke_all: options?.revokeAll,
		}),
	})
	// Per RFC 7009, always succeeds (200 OK)
}

/**
 * Revoke all tokens for a user (logout from all devices)
 *
 * Convenience wrapper around revokeToken with revokeAll option.
 *
 * @example
 * ```typescript
 * // After password change, revoke all sessions
 * await revokeAllTokens(config, userId)
 * ```
 */
export async function revokeAllTokens(config: SylphxConfig, userId: string): Promise<void> {
	await revokeToken(config, '', { revokeAll: true, userId })
}
