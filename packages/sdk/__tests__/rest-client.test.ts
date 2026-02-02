/**
 * REST Client Module Tests
 *
 * Tests for the authenticated REST API client.
 */

import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { createRestApi, type RestClientConfig } from '../src/react/rest-client'
import type { TokenManager } from '../src/react/token-manager'

// ============================================================================
// Test Setup
// ============================================================================

let fetchCalls: Array<{ url: string; options: RequestInit }> = []
const originalFetch = globalThis.fetch

function createMockResponse<T>(data: T, status = 200) {
	return new Response(JSON.stringify(data), {
		status,
		headers: { 'Content-Type': 'application/json' },
	})
}

function getLastCall() {
	return fetchCalls[fetchCalls.length - 1]
}

function getRequestHeaders(): Record<string, string> {
	const last = getLastCall()
	if (!last?.options.headers) return {}
	return last.options.headers as Record<string, string>
}

function getRequestBody(): Record<string, unknown> | null {
	const last = getLastCall()
	if (!last?.options.body) return null
	return JSON.parse(last.options.body as string)
}

function createMockTokenManager(token: string | null = 'test-token-123'): TokenManager {
	return {
		getToken: mock(() => Promise.resolve(token)),
		invalidate: mock(() => {}),
		cleanup: mock(() => {}),
	} as unknown as TokenManager
}

beforeEach(() => {
	fetchCalls = []
})

afterEach(() => {
	globalThis.fetch = originalFetch
})

// ============================================================================
// createRestApi Tests
// ============================================================================

describe('createRestApi', () => {
	test('creates API client with all methods', () => {
		const mockTokenManager = createMockTokenManager()

		const api = createRestApi({
			appId: 'app_dev_test123',
			platformUrl: 'https://sylphx.com',
			tokenManager: mockTokenManager,
		})

		expect(api.get).toBeTypeOf('function')
		expect(api.post).toBeTypeOf('function')
		expect(api.put).toBeTypeOf('function')
		expect(api.del).toBeTypeOf('function')
	})
})

// ============================================================================
// GET Requests
// ============================================================================

describe('GET requests', () => {
	test('makes GET request to correct URL', async () => {
		const mockTokenManager = createMockTokenManager()

		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(createMockResponse({ id: 1, name: 'Test' }))
		}) as typeof fetch

		const api = createRestApi({
			appId: 'app_dev_test123',
			platformUrl: 'https://sylphx.com',
			tokenManager: mockTokenManager,
		})

		const result = await api.get<{ id: number; name: string }>('/user/profile')

		expect(result).toEqual({ id: 1, name: 'Test' })
		expect(getLastCall()?.url).toBe('https://sylphx.com/api/sdk/v1/user/profile')
		expect(getLastCall()?.options.method).toBe('GET')
	})

	test('includes query parameters', async () => {
		const mockTokenManager = createMockTokenManager()

		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(createMockResponse({ items: [] }))
		}) as typeof fetch

		const api = createRestApi({
			appId: 'app_dev_test123',
			platformUrl: 'https://sylphx.com',
			tokenManager: mockTokenManager,
		})

		await api.get('/items', { status: 'active', limit: '10' })

		expect(getLastCall()?.url).toContain('status=active')
		expect(getLastCall()?.url).toContain('limit=10')
	})

	test('excludes undefined query parameters', async () => {
		const mockTokenManager = createMockTokenManager()

		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(createMockResponse({ items: [] }))
		}) as typeof fetch

		const api = createRestApi({
			appId: 'app_dev_test123',
			platformUrl: 'https://sylphx.com',
			tokenManager: mockTokenManager,
		})

		await api.get('/items', { status: 'active', filter: undefined })

		expect(getLastCall()?.url).toContain('status=active')
		expect(getLastCall()?.url).not.toContain('filter')
	})

	test('includes authorization header', async () => {
		const mockTokenManager = createMockTokenManager('my-auth-token')

		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(createMockResponse({}))
		}) as typeof fetch

		const api = createRestApi({
			appId: 'app_dev_test123',
			platformUrl: 'https://sylphx.com',
			tokenManager: mockTokenManager,
		})

		await api.get('/protected')

		const headers = getRequestHeaders()
		expect(headers['Authorization']).toBe('Bearer my-auth-token')
	})

	test('includes app ID header', async () => {
		const mockTokenManager = createMockTokenManager()

		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(createMockResponse({}))
		}) as typeof fetch

		const api = createRestApi({
			appId: 'app_dev_test123',
			platformUrl: 'https://sylphx.com',
			tokenManager: mockTokenManager,
		})

		await api.get('/data')

		const headers = getRequestHeaders()
		expect(headers['x-app-secret']).toBe('app_dev_test123')
	})

	test('works without app ID', async () => {
		const mockTokenManager = createMockTokenManager()

		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(createMockResponse({}))
		}) as typeof fetch

		const api = createRestApi({
			platformUrl: 'https://sylphx.com',
			tokenManager: mockTokenManager,
		})

		await api.get('/data')

		const headers = getRequestHeaders()
		expect(headers['x-app-secret']).toBeUndefined()
	})
})

// ============================================================================
// POST Requests
// ============================================================================

describe('POST requests', () => {
	test('makes POST request with body', async () => {
		const mockTokenManager = createMockTokenManager()

		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(createMockResponse({ id: 'new-123' }))
		}) as typeof fetch

		const api = createRestApi({
			appId: 'app_dev_test123',
			platformUrl: 'https://sylphx.com',
			tokenManager: mockTokenManager,
		})

		const result = await api.post<{ id: string }>('/items', { name: 'New Item' })

		expect(result).toEqual({ id: 'new-123' })
		expect(getLastCall()?.options.method).toBe('POST')
		const body = getRequestBody()
		expect(body?.name).toBe('New Item')
	})

	test('includes content-type header', async () => {
		const mockTokenManager = createMockTokenManager()

		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(createMockResponse({}))
		}) as typeof fetch

		const api = createRestApi({
			appId: 'app_dev_test123',
			platformUrl: 'https://sylphx.com',
			tokenManager: mockTokenManager,
		})

		await api.post('/items', { data: 'test' })

		const headers = getRequestHeaders()
		expect(headers['Content-Type']).toBe('application/json')
	})

	test('handles POST without body', async () => {
		const mockTokenManager = createMockTokenManager()

		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(createMockResponse({ triggered: true }))
		}) as typeof fetch

		const api = createRestApi({
			appId: 'app_dev_test123',
			platformUrl: 'https://sylphx.com',
			tokenManager: mockTokenManager,
		})

		await api.post('/trigger')

		expect(getLastCall()?.options.body).toBeUndefined()
	})
})

// ============================================================================
// PUT Requests
// ============================================================================

describe('PUT requests', () => {
	test('makes PUT request with body', async () => {
		const mockTokenManager = createMockTokenManager()

		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(createMockResponse({ updated: true }))
		}) as typeof fetch

		const api = createRestApi({
			appId: 'app_dev_test123',
			platformUrl: 'https://sylphx.com',
			tokenManager: mockTokenManager,
		})

		const result = await api.put<{ updated: boolean }>('/items/123', { name: 'Updated' })

		expect(result).toEqual({ updated: true })
		expect(getLastCall()?.options.method).toBe('PUT')
		expect(getLastCall()?.url).toContain('/items/123')
	})
})

// ============================================================================
// DELETE Requests
// ============================================================================

describe('DELETE requests', () => {
	test('makes DELETE request', async () => {
		const mockTokenManager = createMockTokenManager()

		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(createMockResponse({ deleted: true }))
		}) as typeof fetch

		const api = createRestApi({
			appId: 'app_dev_test123',
			platformUrl: 'https://sylphx.com',
			tokenManager: mockTokenManager,
		})

		const result = await api.del<{ deleted: boolean }>('/items/123')

		expect(result).toEqual({ deleted: true })
		expect(getLastCall()?.options.method).toBe('DELETE')
		expect(getLastCall()?.url).toContain('/items/123')
	})
})

// ============================================================================
// Token Management
// ============================================================================

describe('Token Management', () => {
	test('fetches token via token manager', async () => {
		const mockTokenManager = createMockTokenManager()

		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(createMockResponse({}))
		}) as typeof fetch

		const api = createRestApi({
			appId: 'app_dev_test123',
			platformUrl: 'https://sylphx.com',
			tokenManager: mockTokenManager,
		})

		await api.get('/protected')

		expect(mockTokenManager.getToken).toHaveBeenCalled()
	})

	test('works without token', async () => {
		const noTokenManager = createMockTokenManager(null)

		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(createMockResponse({}))
		}) as typeof fetch

		const api = createRestApi({
			appId: 'app_dev_test123',
			platformUrl: 'https://sylphx.com',
			tokenManager: noTokenManager,
		})

		await api.get('/public')

		const headers = getRequestHeaders()
		expect(headers['Authorization']).toBeUndefined()
	})
})

// ============================================================================
// 401 Recovery
// ============================================================================

describe('401 Recovery', () => {
	test('invalidates token and retries on 401', async () => {
		const mockTokenManager = createMockTokenManager()
		let callCount = 0

		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			callCount++
			if (callCount === 1) {
				// First call returns 401
				return Promise.resolve(
					new Response(JSON.stringify({ error: { message: 'Unauthorized' } }), {
						status: 401,
						headers: { 'Content-Type': 'application/json' },
					})
				)
			}
			// Retry succeeds
			return Promise.resolve(createMockResponse({ data: 'success' }))
		}) as typeof fetch

		const api = createRestApi({
			appId: 'app_dev_test123',
			platformUrl: 'https://sylphx.com',
			tokenManager: mockTokenManager,
		})

		const result = await api.get<{ data: string }>('/protected')

		expect(result).toEqual({ data: 'success' })
		expect(mockTokenManager.invalidate).toHaveBeenCalled()
		expect(fetchCalls).toHaveLength(2)
	})

	test('does not retry 401 twice (prevents infinite loop)', async () => {
		const mockTokenManager = createMockTokenManager()

		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			// Always return 401
			return Promise.resolve(
				new Response(JSON.stringify({ error: { message: 'Still unauthorized' } }), {
					status: 401,
					headers: { 'Content-Type': 'application/json' },
				})
			)
		}) as typeof fetch

		const api = createRestApi({
			appId: 'app_dev_test123',
			platformUrl: 'https://sylphx.com',
			tokenManager: mockTokenManager,
		})

		await expect(api.get('/protected')).rejects.toThrow('Still unauthorized')
		expect(fetchCalls).toHaveLength(2)
	})
})

// ============================================================================
// Error Handling
// ============================================================================

describe('Error Handling', () => {
	test('throws on non-200 response', async () => {
		const mockTokenManager = createMockTokenManager()

		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(
				new Response(JSON.stringify({ error: { message: 'Not found' } }), {
					status: 404,
					headers: { 'Content-Type': 'application/json' },
				})
			)
		}) as typeof fetch

		const api = createRestApi({
			appId: 'app_dev_test123',
			platformUrl: 'https://sylphx.com',
			tokenManager: mockTokenManager,
		})

		await expect(api.get('/nonexistent')).rejects.toThrow('Not found')
	})

	test('handles error without message', async () => {
		const mockTokenManager = createMockTokenManager()

		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(
				new Response(JSON.stringify({ message: 'Something went wrong' }), {
					status: 500,
					headers: { 'Content-Type': 'application/json' },
				})
			)
		}) as typeof fetch

		const api = createRestApi({
			appId: 'app_dev_test123',
			platformUrl: 'https://sylphx.com',
			tokenManager: mockTokenManager,
		})

		await expect(api.get('/error')).rejects.toThrow('Something went wrong')
	})

	test('handles malformed JSON error response', async () => {
		const mockTokenManager = createMockTokenManager()

		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(
				new Response('Invalid JSON', {
					status: 500,
					headers: { 'Content-Type': 'text/plain' },
				})
			)
		}) as typeof fetch

		const api = createRestApi({
			appId: 'app_dev_test123',
			platformUrl: 'https://sylphx.com',
			tokenManager: mockTokenManager,
		})

		await expect(api.get('/error')).rejects.toThrow('Request failed')
	})

	test('handles empty error response', async () => {
		const mockTokenManager = createMockTokenManager()

		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(
				new Response(JSON.stringify({}), {
					status: 400,
					headers: { 'Content-Type': 'application/json' },
				})
			)
		}) as typeof fetch

		const api = createRestApi({
			appId: 'app_dev_test123',
			platformUrl: 'https://sylphx.com',
			tokenManager: mockTokenManager,
		})

		await expect(api.get('/error')).rejects.toThrow('Request failed')
	})
})

// ============================================================================
// Edge Cases
// ============================================================================

describe('Edge Cases', () => {
	test('handles different platform URLs', async () => {
		const mockTokenManager = createMockTokenManager()

		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(createMockResponse({}))
		}) as typeof fetch

		const customApi = createRestApi({
			appId: 'app_dev_test123',
			platformUrl: 'https://custom.example.com',
			tokenManager: mockTokenManager,
		})

		await customApi.get('/test')

		expect(getLastCall()?.url).toContain('https://custom.example.com')
	})

	test('handles complex request bodies', async () => {
		const mockTokenManager = createMockTokenManager()

		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(createMockResponse({}))
		}) as typeof fetch

		const api = createRestApi({
			appId: 'app_dev_test123',
			platformUrl: 'https://sylphx.com',
			tokenManager: mockTokenManager,
		})

		const complexBody = {
			nested: { deep: { value: 123 } },
			array: [1, 2, 3],
			nullValue: null,
			boolValue: true,
		}

		await api.post('/complex', complexBody)

		const body = getRequestBody()
		expect(body).toEqual(complexBody)
	})

	test('handles special characters in paths', async () => {
		const mockTokenManager = createMockTokenManager()

		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(createMockResponse({}))
		}) as typeof fetch

		const api = createRestApi({
			appId: 'app_dev_test123',
			platformUrl: 'https://sylphx.com',
			tokenManager: mockTokenManager,
		})

		await api.get('/users/user%40example.com')

		expect(getLastCall()?.url).toContain('/users/user%40example.com')
	})
})
