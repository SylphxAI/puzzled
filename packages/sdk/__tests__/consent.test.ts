/**
 * Consent Functions Tests
 *
 * Tests for GDPR/CCPA consent management functions.
 */

import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test'
import {
	getConsentTypes,
	hasConsent,
	getUserConsents,
	setConsents,
	acceptAllConsents,
	declineOptionalConsents,
	linkAnonymousConsents,
	type ConsentType,
	type UserConsent,
	type ConsentCategory,
} from '../src/consent'
import { type SylphxConfig, createConfig } from '../src/config'

// ============================================================================
// Test Setup
// ============================================================================

let mockFetch: ReturnType<typeof mock>
let originalFetch: typeof globalThis.fetch
let testConfig: SylphxConfig

beforeEach(() => {
	originalFetch = globalThis.fetch
	mockFetch = mock(() =>
		Promise.resolve(
			new Response(JSON.stringify({ success: true }), {
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			})
		)
	)
	globalThis.fetch = mockFetch as unknown as typeof fetch

	testConfig = createConfig({
		secretKey: 'sk_dev_test123',
		platformUrl: 'https://test.sylphx.com',
	})
})

afterEach(() => {
	globalThis.fetch = originalFetch
	mockFetch.mockClear()
})

// Helper to extract request details from mock call
function getRequestBody(callIndex: number = 0): Record<string, unknown> {
	const call = mockFetch.mock.calls[callIndex]
	const options = call?.[1] as RequestInit
	if (!options.body) return {}
	return JSON.parse(options.body as string)
}

function getRequestUrl(callIndex: number = 0): string {
	const call = mockFetch.mock.calls[callIndex]
	return call?.[0] as string
}

function getRequestMethod(callIndex: number = 0): string {
	const call = mockFetch.mock.calls[callIndex]
	const options = call?.[1] as RequestInit
	return options.method || 'GET'
}

// Mock consent types for testing
const mockConsentTypes: ConsentType[] = [
	{
		id: 'ct_1',
		slug: 'necessary',
		name: 'Essential Cookies',
		description: 'Required for the website to function',
		category: 'necessary',
		required: true,
		defaultEnabled: true,
		sortOrder: 0,
	},
	{
		id: 'ct_2',
		slug: 'analytics',
		name: 'Analytics Cookies',
		description: 'Help us understand how visitors use our site',
		category: 'analytics',
		required: false,
		defaultEnabled: false,
		sortOrder: 1,
	},
	{
		id: 'ct_3',
		slug: 'marketing',
		name: 'Marketing Cookies',
		description: 'Used for targeted advertising',
		category: 'marketing',
		required: false,
		defaultEnabled: false,
		sortOrder: 2,
	},
]

// Mock user consents
const mockUserConsents: UserConsent[] = [
	{
		consentTypeId: 'ct_1',
		slug: 'necessary',
		granted: true,
		updatedAt: '2024-01-15T10:00:00.000Z',
		grantedAt: '2024-01-15T10:00:00.000Z',
	},
	{
		consentTypeId: 'ct_2',
		slug: 'analytics',
		granted: true,
		updatedAt: '2024-01-15T10:00:00.000Z',
		grantedAt: '2024-01-15T10:00:00.000Z',
	},
	{
		consentTypeId: 'ct_3',
		slug: 'marketing',
		granted: false,
		updatedAt: '2024-01-15T10:00:00.000Z',
		revokedAt: '2024-01-15T10:00:00.000Z',
	},
]

// ============================================================================
// getConsentTypes() Tests
// ============================================================================

describe('getConsentTypes', () => {
	test('fetches consent types from correct endpoint', async () => {
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(JSON.stringify(mockConsentTypes), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				})
			)
		)

		await getConsentTypes(testConfig)

		expect(mockFetch).toHaveBeenCalledTimes(1)
		const url = getRequestUrl()
		expect(url).toContain('/api/sdk/v1/consent/types')
	})

	test('uses GET method', async () => {
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(JSON.stringify(mockConsentTypes), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				})
			)
		)

		await getConsentTypes(testConfig)

		expect(getRequestMethod()).toBe('GET')
	})

	test('returns consent types array', async () => {
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(JSON.stringify(mockConsentTypes), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				})
			)
		)

		const result = await getConsentTypes(testConfig)

		expect(result).toEqual(mockConsentTypes)
		expect(result).toHaveLength(3)
	})

	test('returns empty array when no consent types configured', async () => {
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(JSON.stringify([]), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				})
			)
		)

		const result = await getConsentTypes(testConfig)

		expect(result).toEqual([])
	})
})

// ============================================================================
// hasConsent() Tests
// ============================================================================

describe('hasConsent', () => {
	test('calls correct endpoint', async () => {
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(JSON.stringify(true), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				})
			)
		)

		await hasConsent(testConfig, 'analytics', { userId: 'user-123' })

		expect(mockFetch).toHaveBeenCalledTimes(1)
		const url = getRequestUrl()
		expect(url).toContain('/api/sdk/v1/consent/check')
	})

	test('uses POST method', async () => {
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(JSON.stringify(true), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				})
			)
		)

		await hasConsent(testConfig, 'analytics', { userId: 'user-123' })

		expect(getRequestMethod()).toBe('POST')
	})

	test('includes purposeSlug in body', async () => {
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(JSON.stringify(true), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				})
			)
		)

		await hasConsent(testConfig, 'marketing', { userId: 'user-123' })

		const body = getRequestBody()
		expect(body.purposeSlug).toBe('marketing')
	})

	test('includes userId in body', async () => {
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(JSON.stringify(true), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				})
			)
		)

		await hasConsent(testConfig, 'analytics', { userId: 'user-456' })

		const body = getRequestBody()
		expect(body.userId).toBe('user-456')
	})

	test('includes anonymousId in body', async () => {
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(JSON.stringify(true), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				})
			)
		)

		await hasConsent(testConfig, 'analytics', { anonymousId: 'anon-789' })

		const body = getRequestBody()
		expect(body.anonymousId).toBe('anon-789')
	})

	test('includes defaults for auto-discovery', async () => {
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(JSON.stringify(true), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				})
			)
		)

		const defaults = {
			name: 'Analytics Cookies',
			description: 'Help us understand usage',
			category: 'analytics' as ConsentCategory,
			required: false,
			defaultEnabled: false,
			sortOrder: 5,
		}

		await hasConsent(testConfig, 'analytics', { userId: 'user-123' }, defaults)

		const body = getRequestBody()
		expect(body.defaults).toEqual(defaults)
	})

	test('returns true when consent is granted', async () => {
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(JSON.stringify(true), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				})
			)
		)

		const result = await hasConsent(testConfig, 'analytics', { userId: 'user-123' })

		expect(result).toBe(true)
	})

	test('returns false when consent is not granted', async () => {
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(JSON.stringify(false), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				})
			)
		)

		const result = await hasConsent(testConfig, 'marketing', { userId: 'user-123' })

		expect(result).toBe(false)
	})

	test('works without defaults', async () => {
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(JSON.stringify(true), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				})
			)
		)

		await hasConsent(testConfig, 'necessary', { userId: 'user-123' })

		const body = getRequestBody()
		expect(body.defaults).toBeUndefined()
	})
})

// ============================================================================
// getUserConsents() Tests
// ============================================================================

describe('getUserConsents', () => {
	test('fetches user consents from correct endpoint', async () => {
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(JSON.stringify(mockUserConsents), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				})
			)
		)

		await getUserConsents(testConfig, { userId: 'user-123' })

		expect(mockFetch).toHaveBeenCalledTimes(1)
		const url = getRequestUrl()
		expect(url).toContain('/api/sdk/v1/consent/user')
	})

	test('uses GET method', async () => {
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(JSON.stringify(mockUserConsents), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				})
			)
		)

		await getUserConsents(testConfig, { userId: 'user-123' })

		expect(getRequestMethod()).toBe('GET')
	})

	test('includes userId in query params', async () => {
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(JSON.stringify(mockUserConsents), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				})
			)
		)

		await getUserConsents(testConfig, { userId: 'user-abc' })

		const url = getRequestUrl()
		expect(url).toContain('userId=user-abc')
	})

	test('includes anonymousId in query params', async () => {
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(JSON.stringify(mockUserConsents), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				})
			)
		)

		await getUserConsents(testConfig, { anonymousId: 'anon-xyz' })

		const url = getRequestUrl()
		expect(url).toContain('anonymousId=anon-xyz')
	})

	test('returns user consents array', async () => {
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(JSON.stringify(mockUserConsents), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				})
			)
		)

		const result = await getUserConsents(testConfig, { userId: 'user-123' })

		expect(result).toEqual(mockUserConsents)
		expect(result).toHaveLength(3)
	})

	test('returns empty array for user with no consents', async () => {
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(JSON.stringify([]), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				})
			)
		)

		const result = await getUserConsents(testConfig, { userId: 'new-user' })

		expect(result).toEqual([])
	})
})

// ============================================================================
// setConsents() Tests
// ============================================================================

describe('setConsents', () => {
	test('posts to correct endpoint', async () => {
		await setConsents(testConfig, {
			userId: 'user-123',
			consents: { analytics: true },
		})

		expect(mockFetch).toHaveBeenCalledTimes(1)
		const url = getRequestUrl()
		expect(url).toContain('/api/sdk/v1/consent/set')
	})

	test('uses POST method', async () => {
		await setConsents(testConfig, {
			userId: 'user-123',
			consents: { analytics: true },
		})

		expect(getRequestMethod()).toBe('POST')
	})

	test('includes userId in body', async () => {
		await setConsents(testConfig, {
			userId: 'user-456',
			consents: { analytics: true },
		})

		const body = getRequestBody()
		expect(body.userId).toBe('user-456')
	})

	test('includes anonymousId in body', async () => {
		await setConsents(testConfig, {
			anonymousId: 'anon-789',
			consents: { analytics: true },
		})

		const body = getRequestBody()
		expect(body.anonymousId).toBe('anon-789')
	})

	test('includes consents object in body', async () => {
		await setConsents(testConfig, {
			userId: 'user-123',
			consents: {
				analytics: true,
				marketing: false,
				functional: true,
			},
		})

		const body = getRequestBody()
		expect(body.consents).toEqual({
			analytics: true,
			marketing: false,
			functional: true,
		})
	})

	test('handles single consent', async () => {
		await setConsents(testConfig, {
			userId: 'user-123',
			consents: { marketing: false },
		})

		const body = getRequestBody()
		expect(body.consents).toEqual({ marketing: false })
	})

	test('handles empty consents object', async () => {
		await setConsents(testConfig, {
			userId: 'user-123',
			consents: {},
		})

		const body = getRequestBody()
		expect(body.consents).toEqual({})
	})
})

// ============================================================================
// acceptAllConsents() Tests
// ============================================================================

describe('acceptAllConsents', () => {
	test('posts to correct endpoint', async () => {
		await acceptAllConsents(testConfig, { userId: 'user-123' })

		expect(mockFetch).toHaveBeenCalledTimes(1)
		const url = getRequestUrl()
		expect(url).toContain('/api/sdk/v1/consent/accept-all')
	})

	test('uses POST method', async () => {
		await acceptAllConsents(testConfig, { userId: 'user-123' })

		expect(getRequestMethod()).toBe('POST')
	})

	test('includes userId in body', async () => {
		await acceptAllConsents(testConfig, { userId: 'user-456' })

		const body = getRequestBody()
		expect(body.userId).toBe('user-456')
	})

	test('includes anonymousId in body', async () => {
		await acceptAllConsents(testConfig, { anonymousId: 'anon-789' })

		const body = getRequestBody()
		expect(body.anonymousId).toBe('anon-789')
	})

	test('works with both userId and anonymousId', async () => {
		await acceptAllConsents(testConfig, {
			userId: 'user-123',
			anonymousId: 'anon-456',
		})

		const body = getRequestBody()
		expect(body.userId).toBe('user-123')
		expect(body.anonymousId).toBe('anon-456')
	})
})

// ============================================================================
// declineOptionalConsents() Tests
// ============================================================================

describe('declineOptionalConsents', () => {
	test('posts to correct endpoint', async () => {
		await declineOptionalConsents(testConfig, { userId: 'user-123' })

		expect(mockFetch).toHaveBeenCalledTimes(1)
		const url = getRequestUrl()
		expect(url).toContain('/api/sdk/v1/consent/decline-optional')
	})

	test('uses POST method', async () => {
		await declineOptionalConsents(testConfig, { userId: 'user-123' })

		expect(getRequestMethod()).toBe('POST')
	})

	test('includes userId in body', async () => {
		await declineOptionalConsents(testConfig, { userId: 'user-456' })

		const body = getRequestBody()
		expect(body.userId).toBe('user-456')
	})

	test('includes anonymousId in body', async () => {
		await declineOptionalConsents(testConfig, { anonymousId: 'anon-789' })

		const body = getRequestBody()
		expect(body.anonymousId).toBe('anon-789')
	})
})

// ============================================================================
// linkAnonymousConsents() Tests
// ============================================================================

describe('linkAnonymousConsents', () => {
	test('posts to correct endpoint', async () => {
		await linkAnonymousConsents(testConfig, {
			userId: 'user-123',
			anonymousId: 'anon-456',
		})

		expect(mockFetch).toHaveBeenCalledTimes(1)
		const url = getRequestUrl()
		expect(url).toContain('/api/sdk/v1/consent/link-anonymous')
	})

	test('uses POST method', async () => {
		await linkAnonymousConsents(testConfig, {
			userId: 'user-123',
			anonymousId: 'anon-456',
		})

		expect(getRequestMethod()).toBe('POST')
	})

	test('includes both userId and anonymousId in body', async () => {
		await linkAnonymousConsents(testConfig, {
			userId: 'user-abc',
			anonymousId: 'anon-xyz',
		})

		const body = getRequestBody()
		expect(body.userId).toBe('user-abc')
		expect(body.anonymousId).toBe('anon-xyz')
	})
})

// ============================================================================
// Error Handling Tests
// ============================================================================

describe('Error Handling', () => {
	test('getConsentTypes throws on network error', async () => {
		mockFetch.mockImplementationOnce(() => Promise.reject(new Error('Network error')))

		await expect(getConsentTypes(testConfig)).rejects.toThrow()
	})

	test('hasConsent throws on network error', async () => {
		mockFetch.mockImplementationOnce(() => Promise.reject(new Error('Network error')))

		await expect(hasConsent(testConfig, 'analytics', { userId: 'user-123' })).rejects.toThrow()
	})

	test('getUserConsents throws on network error', async () => {
		mockFetch.mockImplementationOnce(() => Promise.reject(new Error('Network error')))

		await expect(getUserConsents(testConfig, { userId: 'user-123' })).rejects.toThrow()
	})

	test('setConsents throws on network error', async () => {
		mockFetch.mockImplementationOnce(() => Promise.reject(new Error('Network error')))

		await expect(
			setConsents(testConfig, {
				userId: 'user-123',
				consents: { analytics: true },
			})
		).rejects.toThrow()
	})

	test('throws on 400 response', async () => {
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(JSON.stringify({ error: 'Invalid input' }), {
					status: 400,
					headers: { 'Content-Type': 'application/json' },
				})
			)
		)

		await expect(
			setConsents(testConfig, {
				userId: 'user-123',
				consents: {},
			})
		).rejects.toThrow()
	})

	test('throws on 401 response', async () => {
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(JSON.stringify({ error: 'Unauthorized' }), {
					status: 401,
					headers: { 'Content-Type': 'application/json' },
				})
			)
		)

		await expect(getUserConsents(testConfig, { userId: 'user-123' })).rejects.toThrow()
	})

	test('throws on 500 response', async () => {
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(JSON.stringify({ error: 'Server error' }), {
					status: 500,
					headers: { 'Content-Type': 'application/json' },
				})
			)
		)

		await expect(acceptAllConsents(testConfig, { userId: 'user-123' })).rejects.toThrow()
	})
})

// ============================================================================
// Type Tests
// ============================================================================

describe('Types', () => {
	test('ConsentCategory includes all valid categories', () => {
		const categories: ConsentCategory[] = [
			'necessary',
			'analytics',
			'marketing',
			'functional',
			'preferences',
		]

		// This is a compile-time check - if any of these are invalid, TypeScript will error
		expect(categories).toHaveLength(5)
	})

	test('ConsentType has required fields', () => {
		const consentType: ConsentType = {
			id: 'ct_1',
			slug: 'test',
			name: 'Test',
			description: 'Test description',
			category: 'analytics',
			required: false,
			defaultEnabled: false,
			sortOrder: 0,
		}

		expect(consentType.id).toBeDefined()
		expect(consentType.slug).toBeDefined()
		expect(consentType.name).toBeDefined()
		expect(consentType.description).toBeDefined()
		expect(consentType.category).toBeDefined()
		expect(typeof consentType.required).toBe('boolean')
		expect(typeof consentType.defaultEnabled).toBe('boolean')
		expect(typeof consentType.sortOrder).toBe('number')
	})

	test('UserConsent uses granted field', () => {
		// This test ensures we use 'granted' not 'enabled' (API alignment)
		const consent: UserConsent = {
			consentTypeId: 'ct_1',
			slug: 'analytics',
			granted: true,
			updatedAt: '2024-01-15T10:00:00.000Z',
		}

		expect(consent.granted).toBe(true)
		// @ts-expect-error - 'enabled' should not exist
		expect(consent.enabled).toBeUndefined()
	})
})
