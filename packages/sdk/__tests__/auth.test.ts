/**
 * Auth Functions Tests
 *
 * Tests for authentication pure functions.
 */

import { describe, test, expect, afterEach } from 'bun:test'
import { createConfig } from '../src/config'
import {
	signIn,
	signUp,
	signOut,
	refreshToken,
	verifyEmail,
	forgotPassword,
	resetPassword,
	getSession,
	verifyTwoFactor,
	type SignInResult,
	type SignUpResult,
	type TokenResult,
	type SessionResult,
} from '../src/auth'

// ============================================================================
// Test Setup
// ============================================================================

const createTestConfig = () =>
	createConfig({
		secretKey: 'sk_dev_test-secret',
		platformUrl: 'https://test.sylphx.com',
	})

const originalFetch = globalThis.fetch

afterEach(() => {
	globalThis.fetch = originalFetch
})

// Helper to mock fetch
const mockFetch = (response: unknown, status = 200) => {
	globalThis.fetch = async () => {
		return new Response(JSON.stringify(response), { status })
	}
}

const mockFetchError = (message: string, status: number) => {
	globalThis.fetch = async () => {
		return new Response(JSON.stringify({ error: { message } }), { status })
	}
}

// ============================================================================
// signIn Tests
// ============================================================================

describe('signIn', () => {
	test('returns tokens on successful login', async () => {
		const mockResponse: SignInResult = {
			requiresTwoFactor: false,
			accessToken: 'access-token-123',
			refreshToken: 'refresh-token-456',
			expiresIn: 900,
			user: {
				id: 'user-123',
				email: 'test@example.com',
				name: 'Test User',
				image: null,
			},
		}

		mockFetch(mockResponse)

		const config = createTestConfig()
		const result = await signIn(config, {
			email: 'test@example.com',
			password: 'password123',
		})

		expect(result.requiresTwoFactor).toBe(false)
		expect(result.accessToken).toBe('access-token-123')
		expect(result.user?.email).toBe('test@example.com')
	})

	test('returns requiresTwoFactor when 2FA enabled', async () => {
		const mockResponse: SignInResult = {
			requiresTwoFactor: true,
			userId: 'user-123',
		}

		mockFetch(mockResponse)

		const config = createTestConfig()
		const result = await signIn(config, {
			email: 'test@example.com',
			password: 'password123',
		})

		expect(result.requiresTwoFactor).toBe(true)
		expect(result.userId).toBe('user-123')
		expect(result.accessToken).toBeUndefined()
	})

	test('throws on invalid credentials', async () => {
		mockFetchError('Invalid email or password', 401)

		const config = createTestConfig()

		await expect(
			signIn(config, {
				email: 'test@example.com',
				password: 'wrong',
			})
		).rejects.toThrow('Invalid email or password')
	})

	test('sends correct request body', async () => {
		let capturedBody: string | undefined

		globalThis.fetch = async (_url, init) => {
			capturedBody = init?.body as string
			return new Response(
				JSON.stringify({
					requiresTwoFactor: false,
					accessToken: 'token',
				})
			)
		}

		const config = createTestConfig()
		await signIn(config, {
			email: 'user@test.com',
			password: 'secret123',
		})

		const body = JSON.parse(capturedBody!)
		expect(body.email).toBe('user@test.com')
		expect(body.password).toBe('secret123')
	})
})

// ============================================================================
// signUp Tests
// ============================================================================

describe('signUp', () => {
	test('returns user info on successful registration', async () => {
		mockFetch({
			user: {
				id: 'user-new',
				email: 'new@example.com',
				name: 'New User',
			},
		})

		const config = createTestConfig()
		const result = await signUp(config, {
			email: 'new@example.com',
			password: 'password123',
			name: 'New User',
		})

		expect(result.requiresVerification).toBe(true)
		expect(result.user.id).toBe('user-new')
		expect(result.user.email).toBe('new@example.com')
	})

	test('throws on duplicate email', async () => {
		mockFetchError('Email already in use', 409)

		const config = createTestConfig()

		await expect(
			signUp(config, {
				email: 'existing@example.com',
				password: 'password123',
			})
		).rejects.toThrow('Email already in use')
	})

	test('sends correct request body with name', async () => {
		let capturedBody: string | undefined

		globalThis.fetch = async (_url, init) => {
			capturedBody = init?.body as string
			return new Response(
				JSON.stringify({
					user: { id: '1', email: 'test@test.com', name: 'Test' },
				})
			)
		}

		const config = createTestConfig()
		await signUp(config, {
			email: 'test@test.com',
			password: 'pass123',
			name: 'Test Name',
		})

		const body = JSON.parse(capturedBody!)
		expect(body.email).toBe('test@test.com')
		expect(body.password).toBe('pass123')
		expect(body.name).toBe('Test Name')
	})
})

// ============================================================================
// signOut Tests
// ============================================================================

describe('signOut', () => {
	test('completes successfully', async () => {
		mockFetch({})

		const config = createTestConfig()
		await expect(signOut(config)).resolves.toBeUndefined()
	})

	test('calls correct endpoint', async () => {
		let capturedUrl: string | undefined

		globalThis.fetch = async (url) => {
			capturedUrl = url.toString()
			return new Response(JSON.stringify({}))
		}

		const config = createTestConfig()
		await signOut(config)

		// Uses versioned SDK API path
		expect(capturedUrl).toContain('/api/sdk/v1/auth/logout')
	})
})

// ============================================================================
// refreshToken Tests
// ============================================================================

describe('refreshToken', () => {
	test('returns new tokens', async () => {
		const mockResponse: TokenResult = {
			accessToken: 'new-access-token',
			refreshToken: 'new-refresh-token',
			expiresIn: 900,
			user: {
				id: 'user-123',
				email: 'test@example.com',
				name: 'Test',
				image: null,
			},
		}

		mockFetch(mockResponse)

		const config = createTestConfig()
		const result = await refreshToken(config, 'old-refresh-token')

		expect(result.accessToken).toBe('new-access-token')
		expect(result.refreshToken).toBe('new-refresh-token')
	})

	test('throws on invalid refresh token', async () => {
		mockFetchError('Invalid refresh token', 401)

		const config = createTestConfig()

		// refreshToken uses a default error message when JSON parsing fails
		await expect(refreshToken(config, 'invalid-token')).rejects.toThrow('Token refresh failed')
	})

	test('sends correct request format', async () => {
		let capturedBody: string | undefined

		globalThis.fetch = async (_url, init) => {
			capturedBody = init?.body as string
			return new Response(
				JSON.stringify({
					accessToken: 'token',
					refreshToken: 'refresh',
					expiresIn: 900,
					user: { id: '1', email: 'a@b.com', name: null, image: null },
				})
			)
		}

		const config = createTestConfig()
		await refreshToken(config, 'refresh-token-xyz')

		const body = JSON.parse(capturedBody!)
		expect(body.grant_type).toBe('refresh_token')
		expect(body.refresh_token).toBe('refresh-token-xyz')
		// Uses client_secret for OAuth token refresh (not app_id)
		expect(body.client_secret).toBe('sk_dev_test-secret')
	})
})

// ============================================================================
// verifyEmail Tests
// ============================================================================

describe('verifyEmail', () => {
	test('completes successfully', async () => {
		mockFetch({ success: true })

		const config = createTestConfig()
		await expect(verifyEmail(config, 'verify-token-123')).resolves.toBeUndefined()
	})

	test('throws on invalid token', async () => {
		mockFetchError('Invalid or expired verification token', 400)

		const config = createTestConfig()

		// verifyEmail uses a default error message
		await expect(verifyEmail(config, 'invalid-token')).rejects.toThrow(
			'Email verification failed'
		)
	})
})

// ============================================================================
// forgotPassword Tests
// ============================================================================

describe('forgotPassword', () => {
	test('completes successfully', async () => {
		mockFetch({ success: true })

		const config = createTestConfig()
		await expect(forgotPassword(config, 'user@example.com')).resolves.toBeUndefined()
	})

	test('sends correct email in request', async () => {
		let capturedBody: string | undefined

		globalThis.fetch = async (_url, init) => {
			capturedBody = init?.body as string
			return new Response(JSON.stringify({ success: true }))
		}

		const config = createTestConfig()
		await forgotPassword(config, 'reset@example.com')

		const body = JSON.parse(capturedBody!)
		expect(body.email).toBe('reset@example.com')
	})
})

// ============================================================================
// resetPassword Tests
// ============================================================================

describe('resetPassword', () => {
	test('completes successfully', async () => {
		mockFetch({ success: true })

		const config = createTestConfig()
		await expect(
			resetPassword(config, {
				token: 'reset-token',
				password: 'new-password',
			})
		).resolves.toBeUndefined()
	})

	test('throws on invalid token', async () => {
		mockFetchError('Invalid or expired reset token', 400)

		const config = createTestConfig()

		await expect(
			resetPassword(config, {
				token: 'bad-token',
				password: 'new-password',
			})
		).rejects.toThrow('Invalid or expired reset token')
	})

	test('sends correct request body', async () => {
		let capturedBody: string | undefined

		globalThis.fetch = async (_url, init) => {
			capturedBody = init?.body as string
			return new Response(JSON.stringify({ success: true }))
		}

		const config = createTestConfig()
		await resetPassword(config, {
			token: 'my-token',
			password: 'my-new-password',
		})

		const body = JSON.parse(capturedBody!)
		expect(body.token).toBe('my-token')
		expect(body.newPassword).toBe('my-new-password')
	})
})

// ============================================================================
// getSession Tests
// ============================================================================

describe('getSession', () => {
	test('returns user when authenticated', async () => {
		mockFetch({
			id: 'user-123',
			email: 'test@example.com',
			name: 'Test User',
			image: 'https://example.com/avatar.jpg',
			emailVerified: true,
		})

		const config = createConfig({
			secretKey: 'sk_dev_test-secret',
			platformUrl: 'https://test.sylphx.com',
			accessToken: 'valid-token',
		})

		const result = await getSession(config)

		expect(result.user).not.toBeNull()
		expect(result.user?.id).toBe('user-123')
		expect(result.user?.email).toBe('test@example.com')
	})

	test('returns null user when not authenticated', async () => {
		const config = createConfig({
			secretKey: 'sk_dev_test-secret',
			platformUrl: 'https://test.sylphx.com',
			// No accessToken
		})

		const result = await getSession(config)

		expect(result.user).toBeNull()
	})

	test('returns null user on error', async () => {
		mockFetchError('Unauthorized', 401)

		const config = createConfig({
			secretKey: 'sk_dev_test-secret',
			platformUrl: 'https://test.sylphx.com',
			accessToken: 'invalid-token',
		})

		const result = await getSession(config)

		expect(result.user).toBeNull()
	})
})

// ============================================================================
// verifyTwoFactor Tests
// ============================================================================

describe('verifyTwoFactor', () => {
	test('returns tokens on successful verification', async () => {
		const mockResponse: TokenResult = {
			accessToken: 'access-token-2fa',
			refreshToken: 'refresh-token-2fa',
			expiresIn: 900,
			user: {
				id: 'user-123',
				email: 'test@example.com',
				name: 'Test',
				image: null,
			},
		}

		mockFetch(mockResponse)

		const config = createTestConfig()
		const result = await verifyTwoFactor(config, 'user-123', '123456')

		expect(result.accessToken).toBe('access-token-2fa')
		expect(result.user.id).toBe('user-123')
	})

	test('throws on invalid code', async () => {
		mockFetchError('Invalid 2FA code', 401)

		const config = createTestConfig()

		await expect(verifyTwoFactor(config, 'user-123', '000000')).rejects.toThrow('Invalid 2FA code')
	})

	test('sends correct request body', async () => {
		let capturedBody: string | undefined

		globalThis.fetch = async (_url, init) => {
			capturedBody = init?.body as string
			return new Response(
				JSON.stringify({
					accessToken: 'token',
					refreshToken: 'refresh',
					expiresIn: 900,
					user: { id: '1', email: 'a@b.com', name: null, image: null },
				})
			)
		}

		const config = createTestConfig()
		await verifyTwoFactor(config, 'user-abc', '654321')

		const body = JSON.parse(capturedBody!)
		expect(body.userId).toBe('user-abc')
		expect(body.code).toBe('654321')
	})
})
