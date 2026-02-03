/**
 * Analytics Functions Tests
 *
 * Tests for event tracking, page views, identification, and batching.
 */

import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test'
import {
	track,
	page,
	identify,
	trackBatch,
	generateAnonymousId,
	createTracker,
	type TrackInput,
	type PageInput,
	type IdentifyInput,
	type BatchEvent,
} from '../src/analytics'
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

// Helper to extract request body from mock call
function getRequestBody(callIndex: number = 0): Record<string, unknown> {
	const call = mockFetch.mock.calls[callIndex]
	const options = call?.[1] as RequestInit
	return JSON.parse(options.body as string)
}

function getRequestUrl(callIndex: number = 0): string {
	const call = mockFetch.mock.calls[callIndex]
	return call?.[0] as string
}

// ============================================================================
// track() Tests
// ============================================================================

describe('track', () => {
	test('sends event to correct endpoint', async () => {
		await track(testConfig, {
			event: 'button_clicked',
		})

		expect(mockFetch).toHaveBeenCalledTimes(1)
		const url = getRequestUrl()
		expect(url).toContain('/api/sdk/v1/analytics/track')
	})

	test('includes event name in body', async () => {
		await track(testConfig, {
			event: 'purchase_completed',
		})

		const body = getRequestBody()
		expect(body.event).toBe('purchase_completed')
	})

	test('includes properties when provided', async () => {
		await track(testConfig, {
			event: 'purchase_completed',
			properties: {
				amount: 99.99,
				currency: 'USD',
				productId: 'prod-123',
			},
		})

		const body = getRequestBody()
		expect(body.properties).toEqual({
			amount: 99.99,
			currency: 'USD',
			productId: 'prod-123',
		})
	})

	test('defaults properties to empty object', async () => {
		await track(testConfig, {
			event: 'simple_event',
		})

		const body = getRequestBody()
		expect(body.properties).toEqual({})
	})

	test('includes userId when provided', async () => {
		await track(testConfig, {
			event: 'test_event',
			userId: 'user-123',
		})

		const body = getRequestBody()
		expect(body.userId).toBe('user-123')
	})

	test('includes anonymousId when provided', async () => {
		await track(testConfig, {
			event: 'test_event',
			anonymousId: 'anon-456',
		})

		const body = getRequestBody()
		expect(body.anonymousId).toBe('anon-456')
	})

	test('uses provided timestamp', async () => {
		const customTimestamp = '2024-01-15T10:30:00.000Z'
		await track(testConfig, {
			event: 'test_event',
			timestamp: customTimestamp,
		})

		const body = getRequestBody()
		expect(body.timestamp).toBe(customTimestamp)
	})

	test('generates timestamp when not provided', async () => {
		const before = new Date().toISOString()
		await track(testConfig, {
			event: 'test_event',
		})
		const after = new Date().toISOString()

		const body = getRequestBody()
		expect(body.timestamp).toBeDefined()
		// Timestamp should be between before and after
		expect(new Date(body.timestamp as string).getTime()).toBeGreaterThanOrEqual(
			new Date(before).getTime() - 1000
		)
		expect(new Date(body.timestamp as string).getTime()).toBeLessThanOrEqual(
			new Date(after).getTime() + 1000
		)
	})

	test('sends POST request', async () => {
		await track(testConfig, { event: 'test' })

		const call = mockFetch.mock.calls[0]
		const options = call?.[1] as RequestInit
		expect(options.method).toBe('POST')
	})

	test('includes correct headers', async () => {
		await track(testConfig, { event: 'test' })

		const call = mockFetch.mock.calls[0]
		const options = call?.[1] as RequestInit
		const headers = options.headers as Record<string, string>
		expect(headers['Content-Type']).toBe('application/json')
		expect(headers['x-app-secret']).toBe('sk_dev_test123')
	})
})

// ============================================================================
// page() Tests
// ============================================================================

describe('page', () => {
	test('sends page view to correct endpoint', async () => {
		await page(testConfig, {
			name: 'Home',
		})

		expect(mockFetch).toHaveBeenCalledTimes(1)
		const url = getRequestUrl()
		expect(url).toContain('/api/sdk/v1/analytics/page')
	})

	test('includes page name in body', async () => {
		await page(testConfig, {
			name: 'Product Page',
		})

		const body = getRequestBody()
		expect(body.name).toBe('Product Page')
	})

	test('includes properties when provided', async () => {
		await page(testConfig, {
			name: 'Search Results',
			properties: {
				path: '/search',
				query: 'shoes',
				resultCount: 42,
			},
		})

		const body = getRequestBody()
		expect(body.properties).toEqual({
			path: '/search',
			query: 'shoes',
			resultCount: 42,
		})
	})

	test('defaults properties to empty object', async () => {
		await page(testConfig, {
			name: 'About',
		})

		const body = getRequestBody()
		expect(body.properties).toEqual({})
	})

	test('includes userId when provided', async () => {
		await page(testConfig, {
			name: 'Dashboard',
			userId: 'user-123',
		})

		const body = getRequestBody()
		expect(body.userId).toBe('user-123')
	})

	test('includes anonymousId when provided', async () => {
		await page(testConfig, {
			name: 'Home',
			anonymousId: 'anon-789',
		})

		const body = getRequestBody()
		expect(body.anonymousId).toBe('anon-789')
	})

	test('generates timestamp automatically', async () => {
		await page(testConfig, { name: 'Test Page' })

		const body = getRequestBody()
		expect(body.timestamp).toBeDefined()
		expect(typeof body.timestamp).toBe('string')
	})
})

// ============================================================================
// identify() Tests
// ============================================================================

describe('identify', () => {
	test('sends identify to correct endpoint', async () => {
		await identify(testConfig, {
			userId: 'user-123',
		})

		expect(mockFetch).toHaveBeenCalledTimes(1)
		const url = getRequestUrl()
		expect(url).toContain('/api/sdk/v1/analytics/identify')
	})

	test('includes userId in body', async () => {
		await identify(testConfig, {
			userId: 'user-abc',
		})

		const body = getRequestBody()
		expect(body.userId).toBe('user-abc')
	})

	test('includes traits when provided', async () => {
		await identify(testConfig, {
			userId: 'user-123',
			traits: {
				email: 'user@example.com',
				plan: 'pro',
				company: 'Acme Inc',
			},
		})

		const body = getRequestBody()
		expect(body.traits).toEqual({
			email: 'user@example.com',
			plan: 'pro',
			company: 'Acme Inc',
		})
	})

	test('defaults traits to empty object', async () => {
		await identify(testConfig, {
			userId: 'user-123',
		})

		const body = getRequestBody()
		expect(body.traits).toEqual({})
	})

	test('includes anonymousId for linking', async () => {
		await identify(testConfig, {
			userId: 'user-123',
			anonymousId: 'anon-456',
		})

		const body = getRequestBody()
		expect(body.anonymousId).toBe('anon-456')
	})
})

// ============================================================================
// trackBatch() Tests
// ============================================================================

describe('trackBatch', () => {
	test('sends batch to correct endpoint', async () => {
		await trackBatch(testConfig, [{ type: 'track', event: 'test' }])

		expect(mockFetch).toHaveBeenCalledTimes(1)
		const url = getRequestUrl()
		expect(url).toContain('/api/sdk/v1/analytics/batch')
	})

	test('sends multiple events in single request', async () => {
		await trackBatch(testConfig, [
			{ type: 'track', event: 'event1' },
			{ type: 'track', event: 'event2' },
			{ type: 'track', event: 'event3' },
		])

		expect(mockFetch).toHaveBeenCalledTimes(1)
		const body = getRequestBody()
		expect(body.events).toHaveLength(3)
	})

	test('transforms track events correctly', async () => {
		await trackBatch(testConfig, [
			{
				type: 'track',
				event: 'button_clicked',
				properties: { buttonId: 'cta' },
				userId: 'user-123',
			},
		])

		const body = getRequestBody()
		const events = body.events as Array<Record<string, unknown>>
		expect(events[0].event).toBe('button_clicked')
		expect(events[0].properties).toEqual({ buttonId: 'cta' })
		expect(events[0].userId).toBe('user-123')
	})

	test('transforms page events to $pageview', async () => {
		await trackBatch(testConfig, [
			{
				type: 'page',
				name: 'Home Page',
				properties: { path: '/' },
			},
		])

		const body = getRequestBody()
		const events = body.events as Array<Record<string, unknown>>
		expect(events[0].event).toBe('$pageview')
		expect((events[0].properties as Record<string, unknown>).name).toBe('Home Page')
		expect((events[0].properties as Record<string, unknown>).path).toBe('/')
	})

	test('transforms identify events to $identify', async () => {
		await trackBatch(testConfig, [
			{
				type: 'identify',
				userId: 'user-123',
				traits: { email: 'test@example.com' },
			},
		])

		const body = getRequestBody()
		const events = body.events as Array<Record<string, unknown>>
		expect(events[0].event).toBe('$identify')
		expect(
			((events[0].properties as Record<string, unknown>).traits as Record<string, unknown>).email
		).toBe('test@example.com')
	})

	test('adds timestamp to events without one', async () => {
		await trackBatch(testConfig, [{ type: 'track', event: 'test' }])

		const body = getRequestBody()
		const events = body.events as Array<Record<string, unknown>>
		expect(events[0].timestamp).toBeDefined()
	})

	test('preserves provided timestamp', async () => {
		const customTimestamp = '2024-01-15T12:00:00.000Z'
		await trackBatch(testConfig, [
			{
				type: 'track',
				event: 'test',
				timestamp: customTimestamp,
			},
		])

		const body = getRequestBody()
		const events = body.events as Array<Record<string, unknown>>
		expect(events[0].timestamp).toBe(customTimestamp)
	})

	test('includes anonymousId from events', async () => {
		await trackBatch(testConfig, [
			{
				type: 'track',
				event: 'test',
				anonymousId: 'anon-123',
			},
		])

		const body = getRequestBody()
		const events = body.events as Array<Record<string, unknown>>
		expect(events[0].anonymousId).toBe('anon-123')
	})

	test('handles empty batch', async () => {
		await trackBatch(testConfig, [])

		const body = getRequestBody()
		expect(body.events).toEqual([])
	})

	test('handles mixed event types', async () => {
		await trackBatch(testConfig, [
			{ type: 'track', event: 'signup' },
			{ type: 'identify', userId: 'user-123', traits: { plan: 'free' } },
			{ type: 'page', name: 'Dashboard' },
		])

		const body = getRequestBody()
		const events = body.events as Array<Record<string, unknown>>
		expect(events).toHaveLength(3)
		expect(events[0].event).toBe('signup')
		expect(events[1].event).toBe('$identify')
		expect(events[2].event).toBe('$pageview')
	})
})

// ============================================================================
// generateAnonymousId() Tests
// ============================================================================

describe('generateAnonymousId', () => {
	test('returns valid UUID v4 format (Segment pattern)', () => {
		const id = generateAnonymousId()
		// UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
		// where y is 8, 9, a, or b
		expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
	})

	test('generates unique IDs (no collision risk)', () => {
		const ids = new Set<string>()
		for (let i = 0; i < 1000; i++) {
			ids.add(generateAnonymousId())
		}
		// All IDs should be unique - UUID v4 has ~2^122 possible values
		expect(ids.size).toBe(1000)
	})

	test('ID is proper length (36 characters)', () => {
		const id = generateAnonymousId()
		// UUID format: 8-4-4-4-12 = 32 hex chars + 4 hyphens = 36
		expect(id.length).toBe(36)
	})

	test('does not include timestamp (privacy + collision safety)', () => {
		const id = generateAnonymousId()
		// Should NOT include Date.now() or any timestamp
		// Old format was anon_{timestamp}_{random} - this should fail
		expect(id.startsWith('anon_')).toBe(false)
		expect(id).not.toMatch(/\d{13}/) // No 13-digit timestamp
	})
})

// ============================================================================
// createTracker() Tests
// ============================================================================

describe('createTracker', () => {
	test('creates tracker with generated anonymousId (UUID v4)', () => {
		const tracker = createTracker(testConfig)
		const anonId = tracker.getAnonymousId()

		expect(anonId).toBeDefined()
		// UUID v4 format (Segment pattern)
		expect(anonId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
	})

	test('uses provided anonymousId', () => {
		const customId = 'custom-anon-id'
		const tracker = createTracker(testConfig, customId)

		expect(tracker.getAnonymousId()).toBe(customId)
	})

	test('track method sends events', async () => {
		const tracker = createTracker(testConfig, 'anon-123')

		await tracker.track('test_event', { prop: 'value' })

		expect(mockFetch).toHaveBeenCalledTimes(1)
		const body = getRequestBody()
		expect(body.event).toBe('test_event')
		expect(body.properties).toEqual({ prop: 'value' })
		expect(body.anonymousId).toBe('anon-123')
	})

	test('track method includes userId when provided', async () => {
		const tracker = createTracker(testConfig, 'anon-123')

		await tracker.track('test_event', {}, 'user-456')

		const body = getRequestBody()
		expect(body.userId).toBe('user-456')
		expect(body.anonymousId).toBe('anon-123')
	})

	test('page method sends page views', async () => {
		const tracker = createTracker(testConfig, 'anon-123')

		await tracker.page('Home', { path: '/' })

		expect(mockFetch).toHaveBeenCalledTimes(1)
		const url = getRequestUrl()
		expect(url).toContain('/analytics/page')
		const body = getRequestBody()
		expect(body.name).toBe('Home')
		expect(body.properties).toEqual({ path: '/' })
	})

	test('identify method links user to anonymousId', async () => {
		const tracker = createTracker(testConfig, 'anon-123')

		await tracker.identify('user-456', { email: 'test@example.com' })

		const body = getRequestBody()
		expect(body.userId).toBe('user-456')
		expect(body.traits).toEqual({ email: 'test@example.com' })
		expect(body.anonymousId).toBe('anon-123')
	})

	test('batch method adds anonymousId to events', async () => {
		const tracker = createTracker(testConfig, 'anon-123')

		await tracker.batch([
			{ type: 'track', event: 'event1' },
			{ type: 'track', event: 'event2', anonymousId: 'override-456' },
		])

		const body = getRequestBody()
		const events = body.events as Array<Record<string, unknown>>
		// First event gets tracker's anonymousId
		expect(events[0].anonymousId).toBe('anon-123')
		// Second event preserves its own anonymousId
		expect(events[1].anonymousId).toBe('override-456')
	})

	test('getAnonymousId returns the ID', () => {
		const tracker = createTracker(testConfig, 'my-anon-id')
		expect(tracker.getAnonymousId()).toBe('my-anon-id')
	})

	test('tracker methods are bound correctly', async () => {
		const tracker = createTracker(testConfig, 'anon-123')

		// Destructure and call - should still work
		const { track, page, identify, batch, getAnonymousId } = tracker

		await track('test')
		expect(mockFetch).toHaveBeenCalledTimes(1)

		mockFetch.mockClear()
		await page('Test')
		expect(mockFetch).toHaveBeenCalledTimes(1)

		mockFetch.mockClear()
		await identify('user-123')
		expect(mockFetch).toHaveBeenCalledTimes(1)

		expect(getAnonymousId()).toBe('anon-123')
	})
})

// ============================================================================
// Error Handling Tests
// ============================================================================

describe('Error Handling', () => {
	test('track throws on network error', async () => {
		mockFetch.mockImplementationOnce(() => Promise.reject(new Error('Network error')))

		await expect(track(testConfig, { event: 'test' })).rejects.toThrow()
	})

	test('track throws on non-200 response', async () => {
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(JSON.stringify({ error: 'Bad request' }), {
					status: 400,
					headers: { 'Content-Type': 'application/json' },
				})
			)
		)

		await expect(track(testConfig, { event: 'test' })).rejects.toThrow()
	})

	test('page throws on error', async () => {
		mockFetch.mockImplementationOnce(() => Promise.reject(new Error('Failed')))

		await expect(page(testConfig, { name: 'Test' })).rejects.toThrow()
	})

	test('identify throws on error', async () => {
		mockFetch.mockImplementationOnce(() => Promise.reject(new Error('Failed')))

		await expect(identify(testConfig, { userId: 'test' })).rejects.toThrow()
	})

	test('trackBatch throws on error', async () => {
		mockFetch.mockImplementationOnce(() => Promise.reject(new Error('Failed')))

		await expect(trackBatch(testConfig, [{ type: 'track', event: 'test' }])).rejects.toThrow()
	})
})

// ============================================================================
// Edge Cases Tests
// ============================================================================

describe('Edge Cases', () => {
	test('handles empty event name', async () => {
		await track(testConfig, { event: '' })

		const body = getRequestBody()
		expect(body.event).toBe('')
	})

	test('handles special characters in event name', async () => {
		await track(testConfig, { event: 'user.signup.completed' })

		const body = getRequestBody()
		expect(body.event).toBe('user.signup.completed')
	})

	test('handles nested properties', async () => {
		await track(testConfig, {
			event: 'test',
			properties: {
				user: {
					name: 'John',
					settings: {
						theme: 'dark',
					},
				},
			},
		})

		const body = getRequestBody()
		expect((body.properties as Record<string, unknown>).user).toEqual({
			name: 'John',
			settings: { theme: 'dark' },
		})
	})

	test('handles array properties', async () => {
		await track(testConfig, {
			event: 'cart_updated',
			properties: {
				items: ['item1', 'item2', 'item3'],
				quantities: [1, 2, 3],
			},
		})

		const body = getRequestBody()
		expect((body.properties as Record<string, unknown>).items).toEqual([
			'item1',
			'item2',
			'item3',
		])
	})

	test('handles null and undefined in properties', async () => {
		await track(testConfig, {
			event: 'test',
			properties: {
				nullValue: null,
				undefinedValue: undefined,
				validValue: 'ok',
			},
		})

		const body = getRequestBody()
		const props = body.properties as Record<string, unknown>
		expect(props.nullValue).toBe(null)
		// undefined is not serialized in JSON
		expect('undefinedValue' in props).toBe(false)
		expect(props.validValue).toBe('ok')
	})

	test('handles very long event names', async () => {
		const longName = 'a'.repeat(1000)
		await track(testConfig, { event: longName })

		const body = getRequestBody()
		expect(body.event).toBe(longName)
	})

	test('handles large batch', async () => {
		const events: BatchEvent[] = Array.from({ length: 100 }, (_, i) => ({
			type: 'track',
			event: `event_${i}`,
		}))

		await trackBatch(testConfig, events)

		const body = getRequestBody()
		expect((body.events as Array<unknown>).length).toBe(100)
	})
})
