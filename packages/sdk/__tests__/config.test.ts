/**
 * SDK Configuration Tests
 *
 * Tests for createConfig, buildHeaders, buildApiUrl, and callApi.
 */

import { describe, test, expect, beforeEach, afterEach, spyOn, mock } from 'bun:test'
import {
	createConfig,
	createPlatformConfig,
	withToken,
	buildHeaders,
	buildApiUrl,
	callApi,
	type SylphxConfig,
} from '../src/config'

// ============================================================================
// createConfig Tests
// ============================================================================

describe('createConfig', () => {
	test('creates config with required fields', () => {
		const config = createConfig({
			appId: 'my-app',
			appSecret: 'secret-123',
		})

		expect(config.appId).toBe('my-app')
		expect(config.appSecret).toBe('secret-123')
		expect(config.platformUrl).toBe('https://sylphx.com') // Default
	})

	test('uses custom platformUrl when provided', () => {
		const config = createConfig({
			appId: 'my-app',
			platformUrl: 'https://custom.example.com',
		})

		expect(config.platformUrl).toBe('https://custom.example.com')
	})

	test('includes accessToken when provided', () => {
		const config = createConfig({
			appId: 'my-app',
			accessToken: 'token-abc',
		})

		expect(config.accessToken).toBe('token-abc')
	})

	test('sets platformMode when provided', () => {
		const config = createConfig({
			appId: 'my-app',
			platformMode: true,
		})

		expect(config.platformMode).toBe(true)
	})

	test('returns frozen object', () => {
		const config = createConfig({
			appId: 'my-app',
			appSecret: 'secret',
		})

		expect(Object.isFrozen(config)).toBe(true)
	})
})

// ============================================================================
// createPlatformConfig Tests
// ============================================================================

describe('createPlatformConfig', () => {
	test('creates platform-mode config', () => {
		const config = createPlatformConfig('sylphx-console')

		expect(config.appId).toBe('sylphx-console')
		expect(config.platformMode).toBe(true)
		// platformUrl is window.location.origin in browser, empty string in Node
		expect(config.platformUrl).toBe('')
	})

	test('returns frozen object', () => {
		const config = createPlatformConfig('my-app')

		expect(Object.isFrozen(config)).toBe(true)
	})
})

// ============================================================================
// withToken Tests
// ============================================================================

describe('withToken', () => {
	test('creates new config with token', () => {
		const original = createConfig({
			appId: 'my-app',
			appSecret: 'secret',
		})

		const authenticated = withToken(original, 'new-token')

		expect(authenticated.accessToken).toBe('new-token')
		expect(authenticated.appId).toBe('my-app')
		expect(authenticated.appSecret).toBe('secret')
	})

	test('does not modify original config', () => {
		const original = createConfig({
			appId: 'my-app',
		})

		withToken(original, 'token')

		expect(original.accessToken).toBeUndefined()
	})

	test('returns frozen object', () => {
		const config = createConfig({ appId: 'my-app' })
		const authenticated = withToken(config, 'token')

		expect(Object.isFrozen(authenticated)).toBe(true)
	})
})

// ============================================================================
// buildHeaders Tests
// ============================================================================

describe('buildHeaders', () => {
	test('includes Content-Type and x-app-id', () => {
		const config = createConfig({ appId: 'my-app' })
		const headers = buildHeaders(config)

		expect(headers['Content-Type']).toBe('application/json')
		expect(headers['x-app-id']).toBe('my-app')
	})

	test('includes x-app-secret when provided', () => {
		const config = createConfig({
			appId: 'my-app',
			appSecret: 'secret-123',
		})
		const headers = buildHeaders(config)

		expect(headers['x-app-secret']).toBe('secret-123')
	})

	test('includes Authorization when accessToken provided', () => {
		const config = createConfig({
			appId: 'my-app',
			accessToken: 'token-abc',
		})
		const headers = buildHeaders(config)

		expect(headers['Authorization']).toBe('Bearer token-abc')
	})

	test('excludes x-app-secret and Authorization in platform mode', () => {
		const config = createConfig({
			appId: 'my-app',
			appSecret: 'secret',
			accessToken: 'token',
			platformMode: true,
		})
		const headers = buildHeaders(config)

		expect(headers['x-app-secret']).toBeUndefined()
		expect(headers['Authorization']).toBeUndefined()
	})
})

// ============================================================================
// buildApiUrl Tests
// ============================================================================

describe('buildApiUrl', () => {
	test('builds correct URL with leading slash', () => {
		const config = createConfig({
			appId: 'my-app',
			platformUrl: 'https://sylphx.com',
		})

		expect(buildApiUrl(config, '/auth/login')).toBe('https://sylphx.com/api/sdk/auth/login')
	})

	test('builds correct URL without leading slash', () => {
		const config = createConfig({
			appId: 'my-app',
			platformUrl: 'https://sylphx.com',
		})

		expect(buildApiUrl(config, 'auth/login')).toBe('https://sylphx.com/api/sdk/auth/login')
	})

	test('handles trailing slash in platformUrl', () => {
		const config = createConfig({
			appId: 'my-app',
			platformUrl: 'https://sylphx.com/',
		})

		expect(buildApiUrl(config, '/auth/login')).toBe('https://sylphx.com/api/sdk/auth/login')
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

		const config = createConfig({ appId: 'my-app', platformUrl: 'https://example.com' })
		await callApi(config, '/test')

		expect(capturedRequest?.method).toBe('GET')
	})

	test('makes POST request with body', async () => {
		let capturedBody: string | undefined

		globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
			capturedBody = init?.body as string
			return new Response(JSON.stringify({ success: true }))
		}

		const config = createConfig({ appId: 'my-app', platformUrl: 'https://example.com' })
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

		const config = createConfig({ appId: 'my-app', platformUrl: 'https://example.com' })
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

		const config = createConfig({ appId: 'my-app', platformUrl: 'https://example.com' })
		await callApi(config, '/test', {
			query: { userId: 'user-123', filter: undefined },
		})

		expect(capturedUrl).toContain('userId=user-123')
		expect(capturedUrl).not.toContain('filter')
	})

	test('includes credentials in platform mode', async () => {
		let capturedCredentials: RequestCredentials | undefined

		globalThis.fetch = async (_input: RequestInfo | URL, init?: RequestInit) => {
			capturedCredentials = init?.credentials
			return new Response(JSON.stringify({}))
		}

		const config = createConfig({ appId: 'my-app', platformUrl: 'https://example.com', platformMode: true })
		await callApi(config, '/test')

		expect(capturedCredentials).toBe('include')
	})

	test('throws error on non-OK response', async () => {
		globalThis.fetch = async () => {
			return new Response(JSON.stringify({ error: { message: 'Not found' } }), { status: 404 })
		}

		const config = createConfig({ appId: 'my-app', platformUrl: 'https://example.com' })

		await expect(callApi(config, '/test')).rejects.toThrow('Not found')
	})

	test('handles empty response (204 No Content)', async () => {
		globalThis.fetch = async () => {
			return new Response('', { status: 204 })
		}

		const config = createConfig({ appId: 'my-app', platformUrl: 'https://example.com' })
		const result = await callApi(config, '/test')

		expect(result).toEqual({})
	})

	test('parses JSON response', async () => {
		globalThis.fetch = async () => {
			return new Response(JSON.stringify({ user: { id: '123', name: 'Test' } }))
		}

		const config = createConfig({ appId: 'my-app', platformUrl: 'https://example.com' })
		const result = await callApi<{ user: { id: string; name: string } }>(config, '/test')

		expect(result.user.id).toBe('123')
		expect(result.user.name).toBe('Test')
	})
})
