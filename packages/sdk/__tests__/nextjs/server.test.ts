/**
 * Next.js Server Helpers Tests
 *
 * Tests for server-side auth helpers logic.
 */

import { describe, expect, test } from 'bun:test'

// ============================================================================
// Types (from server.ts)
// ============================================================================

interface User {
	id: string
	email: string
	name: string | null
	image: string | null
	emailVerified?: boolean
}

interface TokenResponse {
	accessToken: string
	refreshToken: string
	user: User
}

interface AuthResult {
	userId: string | null
	user: User | null
	sessionToken: string | null
}

interface JWTPayload {
	sub: string
	email: string
	name?: string
	picture?: string
	email_verified?: boolean
	exp: number
	iat: number
}

// ============================================================================
// Type Guard Tests
// ============================================================================

describe('isTokenResponse type guard', () => {
	function isTokenResponse(data: unknown): data is TokenResponse {
		return (
			typeof data === 'object' &&
			data !== null &&
			'accessToken' in data &&
			'refreshToken' in data &&
			'user' in data &&
			typeof (data as TokenResponse).accessToken === 'string' &&
			typeof (data as TokenResponse).refreshToken === 'string'
		)
	}

	test('returns true for valid token response', () => {
		const validResponse = {
			accessToken: 'access-token-123',
			refreshToken: 'refresh-token-456',
			user: {
				id: 'user-123',
				email: 'test@example.com',
				name: 'Test User',
				image: null,
			},
		}

		expect(isTokenResponse(validResponse)).toBe(true)
	})

	test('returns false for missing accessToken', () => {
		const invalid = {
			refreshToken: 'refresh-token-456',
			user: { id: 'user-123' },
		}

		expect(isTokenResponse(invalid)).toBe(false)
	})

	test('returns false for missing refreshToken', () => {
		const invalid = {
			accessToken: 'access-token-123',
			user: { id: 'user-123' },
		}

		expect(isTokenResponse(invalid)).toBe(false)
	})

	test('returns false for missing user', () => {
		const invalid = {
			accessToken: 'access-token-123',
			refreshToken: 'refresh-token-456',
		}

		expect(isTokenResponse(invalid)).toBe(false)
	})

	test('returns false for non-string tokens', () => {
		const invalid = {
			accessToken: 123,
			refreshToken: null,
			user: { id: 'user-123' },
		}

		expect(isTokenResponse(invalid)).toBe(false)
	})

	test('returns false for null', () => {
		expect(isTokenResponse(null)).toBe(false)
	})

	test('returns false for undefined', () => {
		expect(isTokenResponse(undefined)).toBe(false)
	})

	test('returns false for primitive types', () => {
		expect(isTokenResponse('string')).toBe(false)
		expect(isTokenResponse(123)).toBe(false)
		expect(isTokenResponse(true)).toBe(false)
	})
})

// ============================================================================
// Cookie Namespace Tests
// ============================================================================

describe('Cookie namespace derivation', () => {
	function getCookieNamespace(secretKey: string): string {
		// Extract prefix from secret key (sk_dev_, sk_stg_, sk_prod_)
		const match = secretKey.match(/^sk_(dev|stg|prod)_/)
		if (match) {
			return `sylphx_${match[1]}`
		}
		return 'sylphx'
	}

	test('derives namespace from dev secret key', () => {
		expect(getCookieNamespace('sk_dev_abc123')).toBe('sylphx_dev')
	})

	test('derives namespace from staging secret key', () => {
		expect(getCookieNamespace('sk_stg_abc123')).toBe('sylphx_stg')
	})

	test('derives namespace from production secret key', () => {
		expect(getCookieNamespace('sk_prod_abc123')).toBe('sylphx_prod')
	})

	test('returns default namespace for invalid key', () => {
		expect(getCookieNamespace('invalid_key')).toBe('sylphx')
		expect(getCookieNamespace('')).toBe('sylphx')
	})
})

// ============================================================================
// Auth State Logic Tests
// ============================================================================

describe('Auth state computation', () => {
	const TOKEN_EXPIRY_BUFFER_MS = 30 * 1000

	interface AuthCookiesData {
		sessionToken: string | null
		refreshToken: string | null
		user: User | null
		expiresAt: number | null
	}

	function computeAuthState(
		cookies: AuthCookiesData,
		tokenVerification: { valid: boolean; payload?: JWTPayload } | null
	): AuthResult {
		// No tokens at all
		if (!cookies.sessionToken && !cookies.refreshToken) {
			return { userId: null, user: null, sessionToken: null }
		}

		// Session token exists and not expired
		if (
			cookies.sessionToken &&
			cookies.expiresAt &&
			cookies.expiresAt > Date.now() + TOKEN_EXPIRY_BUFFER_MS
		) {
			if (tokenVerification?.valid && tokenVerification.payload) {
				const payload = tokenVerification.payload
				return {
					userId: payload.sub,
					user: cookies.user || {
						id: payload.sub,
						email: payload.email,
						name: payload.name || null,
						image: payload.picture || null,
						emailVerified: payload.email_verified,
					},
					sessionToken: cookies.sessionToken,
				}
			}
		}

		// Session expired but have refresh token + user data
		if (cookies.refreshToken && cookies.user && cookies.expiresAt) {
			if (cookies.expiresAt > Date.now()) {
				return {
					userId: cookies.user.id,
					user: cookies.user,
					sessionToken: cookies.sessionToken || null,
				}
			}
		}

		// No valid session
		return { userId: null, user: null, sessionToken: null }
	}

	test('returns unauthenticated when no tokens', () => {
		const cookies: AuthCookiesData = {
			sessionToken: null,
			refreshToken: null,
			user: null,
			expiresAt: null,
		}

		const result = computeAuthState(cookies, null)
		expect(result.userId).toBeNull()
		expect(result.user).toBeNull()
		expect(result.sessionToken).toBeNull()
	})

	test('returns authenticated when session valid', () => {
		const user: User = {
			id: 'user-123',
			email: 'test@example.com',
			name: 'Test User',
			image: null,
		}

		const cookies: AuthCookiesData = {
			sessionToken: 'valid-token',
			refreshToken: 'refresh-token',
			user,
			expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes from now
		}

		const verification = {
			valid: true,
			payload: {
				sub: 'user-123',
				email: 'test@example.com',
				name: 'Test User',
				exp: Math.floor(Date.now() / 1000) + 300,
				iat: Math.floor(Date.now() / 1000),
			},
		}

		const result = computeAuthState(cookies, verification)
		expect(result.userId).toBe('user-123')
		expect(result.user?.email).toBe('test@example.com')
		expect(result.sessionToken).toBe('valid-token')
	})

	test('uses user from cookie when session valid', () => {
		const user: User = {
			id: 'user-123',
			email: 'test@example.com',
			name: 'Test User from Cookie',
			image: 'https://example.com/avatar.jpg',
		}

		const cookies: AuthCookiesData = {
			sessionToken: 'valid-token',
			refreshToken: 'refresh-token',
			user,
			expiresAt: Date.now() + 5 * 60 * 1000,
		}

		const verification = {
			valid: true,
			payload: {
				sub: 'user-123',
				email: 'test@example.com',
				name: 'Different Name',
				exp: Math.floor(Date.now() / 1000) + 300,
				iat: Math.floor(Date.now() / 1000),
			},
		}

		const result = computeAuthState(cookies, verification)
		expect(result.user?.name).toBe('Test User from Cookie') // Cookie user takes precedence
	})

	test('falls back to refresh token when session expired but user valid', () => {
		const user: User = {
			id: 'user-123',
			email: 'test@example.com',
			name: 'Test User',
			image: null,
		}

		const cookies: AuthCookiesData = {
			sessionToken: 'expired-token',
			refreshToken: 'refresh-token',
			user,
			expiresAt: Date.now() + 1000, // User cookie still valid (1 second from now)
		}

		const result = computeAuthState(cookies, { valid: false }) // Token verification failed
		expect(result.userId).toBe('user-123')
		expect(result.user?.email).toBe('test@example.com')
	})

	test('returns unauthenticated when everything expired', () => {
		const user: User = {
			id: 'user-123',
			email: 'test@example.com',
			name: 'Test User',
			image: null,
		}

		const cookies: AuthCookiesData = {
			sessionToken: 'expired-token',
			refreshToken: 'refresh-token',
			user,
			expiresAt: Date.now() - 1000, // User cookie expired
		}

		const result = computeAuthState(cookies, { valid: false })
		expect(result.userId).toBeNull()
		expect(result.user).toBeNull()
	})
})

// ============================================================================
// Authorization URL Tests
// ============================================================================

describe('Authorization URL building', () => {
	function buildAuthorizationUrl(
		platformUrl: string,
		options: {
			clientId: string
			redirectUri?: string
			mode?: 'login' | 'signup'
			state?: string
		}
	): string {
		const params = new URLSearchParams({
			client_id: options.clientId,
			redirect_uri: options.redirectUri || '/',
			response_type: 'code',
		})

		if (options.mode === 'signup') {
			params.set('mode', 'signup')
		}

		if (options.state) {
			params.set('state', options.state)
		}

		return `${platformUrl}/auth/authorize?${params}`
	}

	test('builds basic authorization URL', () => {
		const url = buildAuthorizationUrl('https://sylphx.com', {
			clientId: 'app_prod_abc123',
		})

		expect(url).toContain('https://sylphx.com/auth/authorize')
		expect(url).toContain('client_id=app_prod_abc123')
		expect(url).toContain('response_type=code')
		expect(url).toContain('redirect_uri=%2F')
	})

	test('includes custom redirect URI', () => {
		const url = buildAuthorizationUrl('https://sylphx.com', {
			clientId: 'app_prod_abc123',
			redirectUri: '/dashboard',
		})

		expect(url).toContain('redirect_uri=%2Fdashboard')
	})

	test('includes signup mode', () => {
		const url = buildAuthorizationUrl('https://sylphx.com', {
			clientId: 'app_prod_abc123',
			mode: 'signup',
		})

		expect(url).toContain('mode=signup')
	})

	test('includes state parameter', () => {
		const url = buildAuthorizationUrl('https://sylphx.com', {
			clientId: 'app_prod_abc123',
			state: 'random-state-123',
		})

		expect(url).toContain('state=random-state-123')
	})

	test('does not include mode for login', () => {
		const url = buildAuthorizationUrl('https://sylphx.com', {
			clientId: 'app_prod_abc123',
			mode: 'login',
		})

		expect(url).not.toContain('mode=')
	})
})

// ============================================================================
// Convenience Functions Tests
// ============================================================================

describe('Convenience functions', () => {
	describe('currentUser', () => {
		async function currentUser(authResult: AuthResult): Promise<User | null> {
			return authResult.user
		}

		test('returns user when authenticated', async () => {
			const authResult: AuthResult = {
				userId: 'user-123',
				user: {
					id: 'user-123',
					email: 'test@example.com',
					name: 'Test User',
					image: null,
				},
				sessionToken: 'token',
			}

			const user = await currentUser(authResult)
			expect(user?.id).toBe('user-123')
		})

		test('returns null when not authenticated', async () => {
			const authResult: AuthResult = {
				userId: null,
				user: null,
				sessionToken: null,
			}

			const user = await currentUser(authResult)
			expect(user).toBeNull()
		})
	})

	describe('currentUserId', () => {
		async function currentUserId(authResult: AuthResult): Promise<string | null> {
			return authResult.userId
		}

		test('returns userId when authenticated', async () => {
			const authResult: AuthResult = {
				userId: 'user-123',
				user: { id: 'user-123', email: 'test@example.com', name: null, image: null },
				sessionToken: 'token',
			}

			const userId = await currentUserId(authResult)
			expect(userId).toBe('user-123')
		})

		test('returns null when not authenticated', async () => {
			const authResult: AuthResult = {
				userId: null,
				user: null,
				sessionToken: null,
			}

			const userId = await currentUserId(authResult)
			expect(userId).toBeNull()
		})
	})

	describe('getSessionToken', () => {
		async function getSessionToken(authResult: AuthResult): Promise<string | null> {
			return authResult.sessionToken
		}

		test('returns session token when authenticated', async () => {
			const authResult: AuthResult = {
				userId: 'user-123',
				user: { id: 'user-123', email: 'test@example.com', name: null, image: null },
				sessionToken: 'access-token-123',
			}

			const token = await getSessionToken(authResult)
			expect(token).toBe('access-token-123')
		})

		test('returns null when not authenticated', async () => {
			const authResult: AuthResult = {
				userId: null,
				user: null,
				sessionToken: null,
			}

			const token = await getSessionToken(authResult)
			expect(token).toBeNull()
		})
	})
})

// ============================================================================
// Server Configuration Tests
// ============================================================================

describe('Server configuration', () => {
	test('config structure is correct', () => {
		const config = {
			secretKey: 'sk_prod_abc123',
			platformUrl: 'https://sylphx.com',
		}

		expect(config.secretKey).toBe('sk_prod_abc123')
		expect(config.platformUrl).toBe('https://sylphx.com')
	})

	test('config can have custom platformUrl', () => {
		const config = {
			secretKey: 'sk_dev_abc123',
			platformUrl: 'http://localhost:3000',
		}

		expect(config.platformUrl).toBe('http://localhost:3000')
	})
})

// ============================================================================
// User from JWT Payload Tests
// ============================================================================

describe('User from JWT payload', () => {
	test('creates user from JWT payload', () => {
		const payload: JWTPayload = {
			sub: 'user-123',
			email: 'test@example.com',
			name: 'Test User',
			picture: 'https://example.com/avatar.jpg',
			email_verified: true,
			exp: Math.floor(Date.now() / 1000) + 300,
			iat: Math.floor(Date.now() / 1000),
		}

		const user: User = {
			id: payload.sub,
			email: payload.email,
			name: payload.name || null,
			image: payload.picture || null,
			emailVerified: payload.email_verified,
		}

		expect(user.id).toBe('user-123')
		expect(user.email).toBe('test@example.com')
		expect(user.name).toBe('Test User')
		expect(user.image).toBe('https://example.com/avatar.jpg')
		expect(user.emailVerified).toBe(true)
	})

	test('handles missing optional fields', () => {
		const payload: JWTPayload = {
			sub: 'user-123',
			email: 'test@example.com',
			exp: Math.floor(Date.now() / 1000) + 300,
			iat: Math.floor(Date.now() / 1000),
		}

		const user: User = {
			id: payload.sub,
			email: payload.email,
			name: payload.name || null,
			image: payload.picture || null,
			emailVerified: payload.email_verified,
		}

		expect(user.id).toBe('user-123')
		expect(user.name).toBeNull()
		expect(user.image).toBeNull()
		expect(user.emailVerified).toBeUndefined()
	})
})
