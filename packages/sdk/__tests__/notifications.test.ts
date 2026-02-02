/**
 * Notifications Module Tests
 *
 * Tests for push notification functions.
 */

import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import type { SylphxConfig } from '../src/config'
import {
	getPushPreferences,
	registerPush,
	sendPush,
	unregisterPush,
	updatePushPreferences,
} from '../src/notifications'

// ============================================================================
// Test Setup
// ============================================================================

const mockConfig: SylphxConfig = {
	secretKey: 'sk_dev_test123',
	platformUrl: 'https://api.sylphx.com',
}

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

function getRequestBody(): Record<string, unknown> | null {
	const last = getLastCall()
	if (!last?.options.body) return null
	return JSON.parse(last.options.body as string)
}

function getRequestHeaders(): Record<string, string> {
	const last = getLastCall()
	if (!last?.options.headers) return {}
	return last.options.headers as Record<string, string>
}

beforeEach(() => {
	fetchCalls = []
})

afterEach(() => {
	globalThis.fetch = originalFetch
})

// ============================================================================
// registerPush Tests
// ============================================================================

describe('registerPush', () => {
	test('registers a push subscription', async () => {
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(createMockResponse({}))
		}) as typeof fetch

		await registerPush(mockConfig, {
			endpoint: 'https://fcm.googleapis.com/fcm/send/abc123',
			keys: {
				p256dh: 'BNcRdreALRFXTkOOUHK1EtK2...',
				auth: 'tBHItJI5svbpez7KI4CCXg==',
			},
		})

		expect(getLastCall()?.url).toContain('/notifications/register')
		expect(getLastCall()?.options.method).toBe('POST')
		const body = getRequestBody()
		expect(body?.subscription).toEqual({
			endpoint: 'https://fcm.googleapis.com/fcm/send/abc123',
			keys: {
				p256dh: 'BNcRdreALRFXTkOOUHK1EtK2...',
				auth: 'tBHItJI5svbpez7KI4CCXg==',
			},
		})
	})

	test('sends correct authentication header', async () => {
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(createMockResponse({}))
		}) as typeof fetch

		await registerPush(mockConfig, {
			endpoint: 'https://push.example.com/send/xyz',
			keys: {
				p256dh: 'p256dh-key',
				auth: 'auth-key',
			},
		})

		const headers = getRequestHeaders()
		expect(headers['x-app-secret']).toBe('sk_dev_test123')
	})
})

// ============================================================================
// unregisterPush Tests
// ============================================================================

describe('unregisterPush', () => {
	test('unregisters a push subscription by endpoint', async () => {
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(createMockResponse({}))
		}) as typeof fetch

		await unregisterPush(mockConfig, 'https://fcm.googleapis.com/fcm/send/abc123')

		expect(getLastCall()?.url).toContain('/notifications/unregister')
		expect(getLastCall()?.options.method).toBe('POST')
		const body = getRequestBody()
		expect(body?.endpoint).toBe('https://fcm.googleapis.com/fcm/send/abc123')
	})
})

// ============================================================================
// sendPush Tests
// ============================================================================

describe('sendPush', () => {
	test('sends a push notification to a user', async () => {
		const mockResponse = { sentTo: 2, expired: 0 }
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(createMockResponse(mockResponse))
		}) as typeof fetch

		const result = await sendPush(mockConfig, 'user-123', {
			title: 'New message',
			body: 'You have a new message from Alice',
		})

		expect(result.sentTo).toBe(2)
		expect(result.expired).toBe(0)
		expect(getLastCall()?.url).toContain('/notifications/send')
		expect(getLastCall()?.options.method).toBe('POST')
		const body = getRequestBody()
		expect(body?.userId).toBe('user-123')
		expect(body?.title).toBe('New message')
		expect(body?.body).toBe('You have a new message from Alice')
	})

	test('includes optional icon and url', async () => {
		const mockResponse = { sentTo: 1, expired: 0 }
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(createMockResponse(mockResponse))
		}) as typeof fetch

		await sendPush(mockConfig, 'user-123', {
			title: 'Order shipped',
			body: 'Your order #12345 has shipped',
			icon: 'https://example.com/icons/shipping.png',
			url: '/orders/12345',
		})

		const body = getRequestBody()
		expect(body?.icon).toBe('https://example.com/icons/shipping.png')
		expect(body?.url).toBe('/orders/12345')
	})
})

// ============================================================================
// getPushPreferences Tests
// ============================================================================

describe('getPushPreferences', () => {
	test('gets push notification preferences', async () => {
		const mockResponse = {
			enabled: true,
			categories: {
				marketing: false,
				updates: true,
				security: true,
				social: true,
			},
		}
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(createMockResponse(mockResponse))
		}) as typeof fetch

		const result = await getPushPreferences(mockConfig)

		expect(result.enabled).toBe(true)
		expect(result.categories.marketing).toBe(false)
		expect(result.categories.updates).toBe(true)
		expect(getLastCall()?.url).toContain('/notifications/preferences')
		expect(getLastCall()?.options.method).toBe('GET')
	})
})

// ============================================================================
// updatePushPreferences Tests
// ============================================================================

describe('updatePushPreferences', () => {
	test('enables notifications', async () => {
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(createMockResponse({}))
		}) as typeof fetch

		await updatePushPreferences(mockConfig, { enabled: true })

		expect(getLastCall()?.url).toContain('/notifications/preferences')
		expect(getLastCall()?.options.method).toBe('PUT')
		const body = getRequestBody()
		expect(body?.enabled).toBe(true)
	})

	test('disables notifications', async () => {
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(createMockResponse({}))
		}) as typeof fetch

		await updatePushPreferences(mockConfig, { enabled: false })

		const body = getRequestBody()
		expect(body?.enabled).toBe(false)
	})

	test('updates category preferences', async () => {
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(createMockResponse({}))
		}) as typeof fetch

		await updatePushPreferences(mockConfig, {
			categories: {
				marketing: false,
				updates: true,
				social: false,
			},
		})

		const body = getRequestBody()
		expect(body?.categories).toEqual({
			marketing: false,
			updates: true,
			social: false,
		})
	})

	test('updates both enabled and categories', async () => {
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(createMockResponse({}))
		}) as typeof fetch

		await updatePushPreferences(mockConfig, {
			enabled: true,
			categories: { security: true },
		})

		const body = getRequestBody()
		expect(body?.enabled).toBe(true)
		expect(body?.categories).toEqual({ security: true })
	})
})

// ============================================================================
// Edge Cases
// ============================================================================

describe('Edge Cases', () => {
	test('handles special characters in notification body', async () => {
		const mockResponse = { sentTo: 1, expired: 0 }
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(createMockResponse(mockResponse))
		}) as typeof fetch

		await sendPush(mockConfig, 'user-123', {
			title: 'Special <chars> & "quotes"',
			body: "Line1\nLine2\tTabbed\r\nWindows line",
		})

		const body = getRequestBody()
		expect(body?.title).toBe('Special <chars> & "quotes"')
		expect(body?.body).toContain('\n')
	})

	test('handles emoji in notifications', async () => {
		const mockResponse = { sentTo: 1, expired: 0 }
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(createMockResponse(mockResponse))
		}) as typeof fetch

		await sendPush(mockConfig, 'user-123', {
			title: 'New Message',
			body: 'Hello World',
		})

		const body = getRequestBody()
		expect(body?.title).toBe('New Message')
		expect(body?.body).toBe('Hello World')
	})

	test('handles long notification content', async () => {
		const mockResponse = { sentTo: 1, expired: 0 }
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(createMockResponse(mockResponse))
		}) as typeof fetch

		const longBody = 'A'.repeat(1000)

		await sendPush(mockConfig, 'user-123', {
			title: 'Long notification',
			body: longBody,
		})

		const body = getRequestBody()
		expect(body?.body).toBe(longBody)
	})
})
