/**
 * SDK Configuration Tests
 *
 * Tests for createConfig, buildHeaders, buildApiUrl, and callApi.
 */

import { afterEach, describe, expect, test } from 'bun:test'
import { buildApiUrl, buildHeaders, callApi, createConfig, withToken } from '../src/config'

// ============================================================================
// createConfig Tests
// ============================================================================

describe('createConfig', () => {
	test('creates config with secretKey', () => {
		const config = createConfig({
			secretKey: 'sk_dev_abc123',
		})

		expect(config.secretKey).toBe('sk_dev_abc123')
		expect(config.platformUrl).toBe('https://sylphx.com') // Default
	})

	test('uses custom platformUrl when provided', () => {
		const config = createConfig({
			platformUrl: 'https://custom.example.com',
		})

		expect(config.platformUrl).toBe('https://custom.example.com')
	})

	test('includes accessToken when provided', () => {
		const config = createConfig({
			accessToken: 'token-abc',
		})

		expect(config.accessToken).toBe('token-abc')
	})

	test('returns frozen object', () => {
		const config = createConfig({
			secretKey: 'sk_dev_abc123',
		})

		expect(Object.isFrozen(config)).toBe(true)
	})
})

// ============================================================================
// withToken Tests
// ============================================================================

describe('withToken', () => {
	test('creates new config with token', () => {
		const original = createConfig({
			secretKey: 'sk_dev_abc123',
		})

		const authenticated = withToken(original, 'new-token')

		expect(authenticated.accessToken).toBe('new-token')
		expect(authenticated.secretKey).toBe('sk_dev_abc123')
	})

	test('does not modify original config', () => {
		const original = createConfig({})

		withToken(original, 'token')

		expect(original.accessToken).toBeUndefined()
	})

	test('returns frozen object', () => {
		const config = createConfig({})
		const authenticated = withToken(config, 'token')

		expect(Object.isFrozen(authenticated)).toBe(true)
	})
})

// ============================================================================
// buildHeaders Tests
// ============================================================================

describe('buildHeaders', () => {
	test('includes Content-Type', () => {
		const config = createConfig({})
		const headers = buildHeaders(config)

		expect(headers['Content-Type']).toBe('application/json')
	})

	test('includes x-app-secret when secretKey provided', () => {
		const config = createConfig({
			secretKey: 'sk_dev_abc123',
		})
		const headers = buildHeaders(config)

		expect(headers['x-app-secret']).toBe('sk_dev_abc123')
	})

	test('includes Authorization when accessToken provided', () => {
		const config = createConfig({
			accessToken: 'token-abc',
		})
		const headers = buildHeaders(config)

		expect(headers['Authorization']).toBe('Bearer token-abc')
	})

	test('includes both headers when both provided', () => {
		const config = createConfig({
			secretKey: 'sk_dev_abc123',
			accessToken: 'token',
		})
		const headers = buildHeaders(config)

		expect(headers['x-app-secret']).toBe('sk_dev_abc123')
		expect(headers['Authorization']).toBe('Bearer token')
	})
})

// ============================================================================
// buildApiUrl Tests
// ============================================================================

describe('buildApiUrl', () => {
	test('builds correct URL with leading slash', () => {
		const config = createConfig({
			platformUrl: 'https://sylphx.com',
		})

		expect(buildApiUrl(config, '/auth/login')).toBe('https://sylphx.com/api/v1/auth/login')
	})

	test('builds correct URL without leading slash', () => {
		const config = createConfig({
			platformUrl: 'https://sylphx.com',
		})

		expect(buildApiUrl(config, 'auth/login')).toBe('https://sylphx.com/api/v1/auth/login')
	})

	test('handles trailing slash in platformUrl', () => {
		const config = createConfig({
			platformUrl: 'https://sylphx.com/',
		})

		expect(buildApiUrl(config, '/auth/login')).toBe('https://sylphx.com/api/v1/auth/login')
	})
})

// ============================================================================
// callApi Tests
// ============================================================================

describe('callApi', () => {
	const originalFetch = globalThis.fetch

	afterEach(() => {
		globalThis.fetch = originalFetch
	})

	test('makes GET request by default', async () => {
		let capturedRequest: Request | undefined

		globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
			capturedRequest = new Request(input, init)
			return new Response(JSON.stringify({ data: 'test' }))
		}

		const config = createConfig({ platformUrl: 'https://example.com' })
		await callApi(config, '/test')

		expect(capturedRequest?.method).toBe('GET')
	})

	test('makes POST request with body', async () => {
		let capturedBody: string | undefined

		globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
			capturedBody = init?.body as string
			return new Response(JSON.stringify({ success: true }))
		}

		const config = createConfig({ platformUrl: 'https://example.com' })
		await callApi(config, '/test', {
			method: 'POST',
			body: { email: 'test@example.com' },
		})

		expect(JSON.parse(capturedBody!)).toEqual({ email: 'test@example.com' })
	})

	test('adds query parameters', async () => {
		let capturedUrl: string | undefined

		globalThis.fetch = async (input: RequestInfo | URL) => {
			capturedUrl = input.toString()
			return new Response(JSON.stringify({}))
		}

		const config = createConfig({ platformUrl: 'https://example.com' })
		await callApi(config, '/test', {
			query: { userId: 'user-123', active: true },
		})

		expect(capturedUrl).toContain('userId=user-123')
		expect(capturedUrl).toContain('active=true')
	})

	test('filters undefined query parameters', async () => {
		let capturedUrl: string | undefined

		globalThis.fetch = async (input: RequestInfo | URL) => {
			capturedUrl = input.toString()
			return new Response(JSON.stringify({}))
		}

		const config = createConfig({ platformUrl: 'https://example.com' })
		await callApi(config, '/test', {
			query: { userId: 'user-123', filter: undefined },
		})

		expect(capturedUrl).toContain('userId=user-123')
		expect(capturedUrl).not.toContain('filter')
	})

	test('throws error on non-OK response', async () => {
		globalThis.fetch = async () => {
			return new Response(JSON.stringify({ error: { message: 'Not found' } }), {
				status: 404,
			})
		}

		const config = createConfig({ platformUrl: 'https://example.com' })

		await expect(callApi(config, '/test')).rejects.toThrow('Not found')
	})

	test('handles empty response (204 No Content)', async () => {
		globalThis.fetch = async () => {
			return new Response('', { status: 204 })
		}

		const config = createConfig({ platformUrl: 'https://example.com' })
		const result = await callApi(config, '/test')

		expect(result).toEqual({})
	})

	test('parses JSON response', async () => {
		globalThis.fetch = async () => {
			return new Response(JSON.stringify({ user: { id: '123', name: 'Test' } }))
		}

		const config = createConfig({ platformUrl: 'https://example.com' })
		const result = await callApi<{ user: { id: string; name: string } }>(config, '/test')

		expect(result.user.id).toBe('123')
		expect(result.user.name).toBe('Test')
	})
})
