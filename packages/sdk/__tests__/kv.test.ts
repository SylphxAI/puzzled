/**
 * KV (Key-Value Store) Server Tests
 *
 * Tests for server-side KV client operations.
 */

import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { createKv, getKv, type KvClient } from '../src/server/kv'

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

function getRequestBody(): Record<string, unknown> | null {
	const last = getLastCall()
	if (!last?.options.body) return null
	return JSON.parse(last.options.body as string)
}

function getRequestHeaders(): Record<string, string> {
	const last = getLastCall()
	if (!last?.options.headers) return {}
	const headers: Record<string, string> = {}
	const h = last.options.headers as Record<string, string>
	for (const [key, value] of Object.entries(h)) {
		headers[key.toLowerCase()] = value
	}
	return headers
}

function setupMockFetch<T>(response: T, status = 200) {
	globalThis.fetch = mock((url: string, options: RequestInit) => {
		fetchCalls.push({ url, options })
		return Promise.resolve(createMockResponse(response, status))
	}) as typeof fetch
}

beforeEach(() => {
	fetchCalls = []
})

afterEach(() => {
	globalThis.fetch = originalFetch
})

// ============================================================================
// createKv Tests
// ============================================================================

describe('createKv', () => {
	test('creates client with custom options', () => {
		const kv = createKv({
			baseURL: 'https://custom.api.com',
			apiKey: 'sk_dev_custom123',
		})
		expect(kv).toBeDefined()
		expect(typeof kv.get).toBe('function')
		expect(typeof kv.set).toBe('function')
	})

	test('uses x-app-secret header', async () => {
		setupMockFetch({ value: 'test', ttl: null })

		const kv = createKv({
			baseURL: 'https://api.test.com',
			apiKey: 'sk_dev_test123',
		})

		await kv.get('mykey')

		const headers = getRequestHeaders()
		expect(headers['x-app-secret']).toBe('sk_dev_test123')
		expect(headers['content-type']).toBe('application/json')
	})
})

// ============================================================================
// Basic Operations Tests
// ============================================================================

describe('get', () => {
	test('fetches value by key', async () => {
		setupMockFetch({ value: { name: 'John' }, ttl: 3600 })

		const kv = createKv({ baseURL: 'https://api.test.com', apiKey: 'sk_dev_test' })
		const result = await kv.get<{ name: string }>('user:123')

		expect(result.value).toEqual({ name: 'John' })
		expect(result.ttl).toBe(3600)
		expect(getLastCall()?.url).toContain('/kv/user%3A123')
		expect(getLastCall()?.options.method).toBe('GET')
	})

	test('returns null for missing key', async () => {
		setupMockFetch({ value: null, ttl: null })

		const kv = createKv({ baseURL: 'https://api.test.com', apiKey: 'sk_dev_test' })
		const result = await kv.get('nonexistent')

		expect(result.value).toBeNull()
		expect(result.ttl).toBeNull()
	})

	test('encodes special characters in key', async () => {
		setupMockFetch({ value: 'test', ttl: null })

		const kv = createKv({ baseURL: 'https://api.test.com', apiKey: 'sk_dev_test' })
		await kv.get('user:123:profile')

		expect(getLastCall()?.url).toContain('/kv/user%3A123%3Aprofile')
	})
})

describe('set', () => {
	test('sets value with options', async () => {
		setupMockFetch({ success: true })

		const kv = createKv({ baseURL: 'https://api.test.com', apiKey: 'sk_dev_test' })
		const result = await kv.set('user:123', { name: 'John' }, { ex: 3600, nx: true })

		expect(result).toBe(true)
		expect(getLastCall()?.options.method).toBe('POST')

		const body = getRequestBody()
		expect(body?.key).toBe('user:123')
		expect(body?.value).toEqual({ name: 'John' })
		expect(body?.ex).toBe(3600)
		expect(body?.nx).toBe(true)
	})

	test('sets value without options', async () => {
		setupMockFetch({ success: true })

		const kv = createKv({ baseURL: 'https://api.test.com', apiKey: 'sk_dev_test' })
		await kv.set('key', 'value')

		const body = getRequestBody()
		expect(body?.key).toBe('key')
		expect(body?.value).toBe('value')
	})
})

describe('del', () => {
	test('deletes key and returns count', async () => {
		setupMockFetch({ deleted: 1 })

		const kv = createKv({ baseURL: 'https://api.test.com', apiKey: 'sk_dev_test' })
		const result = await kv.del('user:123')

		expect(result).toBe(1)
		expect(getLastCall()?.options.method).toBe('DELETE')
	})

	test('returns 0 for nonexistent key', async () => {
		setupMockFetch({ deleted: 0 })

		const kv = createKv({ baseURL: 'https://api.test.com', apiKey: 'sk_dev_test' })
		const result = await kv.del('nonexistent')

		expect(result).toBe(0)
	})
})

describe('exists', () => {
	test('returns true for existing key', async () => {
		setupMockFetch({ exists: true })

		const kv = createKv({ baseURL: 'https://api.test.com', apiKey: 'sk_dev_test' })
		const result = await kv.exists('user:123')

		expect(result).toBe(true)
		expect(getLastCall()?.url).toContain('/kv/exists/user%3A123')
	})

	test('returns false for missing key', async () => {
		setupMockFetch({ exists: false })

		const kv = createKv({ baseURL: 'https://api.test.com', apiKey: 'sk_dev_test' })
		const result = await kv.exists('nonexistent')

		expect(result).toBe(false)
	})
})

// ============================================================================
// Multiple Key Operations Tests
// ============================================================================

describe('mget', () => {
	test('fetches multiple values', async () => {
		setupMockFetch({
			values: {
				'key1': 'value1',
				'key2': 'value2',
				'key3': null,
			},
		})

		const kv = createKv({ baseURL: 'https://api.test.com', apiKey: 'sk_dev_test' })
		const result = await kv.mget(['key1', 'key2', 'key3'])

		expect(result.key1).toBe('value1')
		expect(result.key2).toBe('value2')
		expect(result.key3).toBeNull()

		const body = getRequestBody()
		expect(body?.keys).toEqual(['key1', 'key2', 'key3'])
	})
})

describe('mset', () => {
	test('sets multiple values with TTL', async () => {
		setupMockFetch({ success: true })

		const kv = createKv({ baseURL: 'https://api.test.com', apiKey: 'sk_dev_test' })
		await kv.mset(
			[
				{ key: 'key1', value: 'value1' },
				{ key: 'key2', value: 'value2' },
			],
			{ ex: 3600 }
		)

		const body = getRequestBody()
		expect(body?.entries).toEqual([
			{ key: 'key1', value: 'value1' },
			{ key: 'key2', value: 'value2' },
		])
		expect(body?.ex).toBe(3600)
	})
})

// ============================================================================
// Counter Operations Tests
// ============================================================================

describe('incr', () => {
	test('increments by 1 by default', async () => {
		setupMockFetch({ value: 42 })

		const kv = createKv({ baseURL: 'https://api.test.com', apiKey: 'sk_dev_test' })
		const result = await kv.incr('counter')

		expect(result).toBe(42)

		const body = getRequestBody()
		expect(body?.key).toBe('counter')
		expect(body?.by).toBe(1)
	})

	test('increments by custom amount', async () => {
		setupMockFetch({ value: 50 })

		const kv = createKv({ baseURL: 'https://api.test.com', apiKey: 'sk_dev_test' })
		const result = await kv.incr('counter', 10)

		expect(result).toBe(50)

		const body = getRequestBody()
		expect(body?.by).toBe(10)
	})

	test('decrements with negative value', async () => {
		setupMockFetch({ value: 5 })

		const kv = createKv({ baseURL: 'https://api.test.com', apiKey: 'sk_dev_test' })
		const result = await kv.incr('counter', -5)

		expect(result).toBe(5)

		const body = getRequestBody()
		expect(body?.by).toBe(-5)
	})
})

// ============================================================================
// Expiration Tests
// ============================================================================

describe('expire', () => {
	test('sets TTL on existing key', async () => {
		setupMockFetch({ success: true })

		const kv = createKv({ baseURL: 'https://api.test.com', apiKey: 'sk_dev_test' })
		const result = await kv.expire('user:123', 3600)

		expect(result).toBe(true)

		const body = getRequestBody()
		expect(body?.key).toBe('user:123')
		expect(body?.seconds).toBe(3600)
	})

	test('returns false for missing key', async () => {
		setupMockFetch({ success: false })

		const kv = createKv({ baseURL: 'https://api.test.com', apiKey: 'sk_dev_test' })
		const result = await kv.expire('nonexistent', 3600)

		expect(result).toBe(false)
	})
})

// ============================================================================
// Rate Limiting Tests
// ============================================================================

describe('ratelimit', () => {
	test('checks rate limit', async () => {
		setupMockFetch({
			success: true,
			limit: 100,
			remaining: 99,
			reset: 1704067200000,
		})

		const kv = createKv({ baseURL: 'https://api.test.com', apiKey: 'sk_dev_test' })
		const result = await kv.ratelimit('api:user123', { limit: 100, window: '1h' })

		expect(result.success).toBe(true)
		expect(result.limit).toBe(100)
		expect(result.remaining).toBe(99)
		expect(result.reset).toBe(1704067200000)

		const body = getRequestBody()
		expect(body?.key).toBe('api:user123')
		expect(body?.limit).toBe(100)
		expect(body?.window).toBe('1h')
	})

	test('rate limit exceeded', async () => {
		setupMockFetch({
			success: false,
			limit: 100,
			remaining: 0,
			reset: 1704067200000,
		})

		const kv = createKv({ baseURL: 'https://api.test.com', apiKey: 'sk_dev_test' })
		const result = await kv.ratelimit('api:user123', { limit: 100, window: '1h' })

		expect(result.success).toBe(false)
		expect(result.remaining).toBe(0)
	})
})

// ============================================================================
// Hash Operations Tests
// ============================================================================

describe('hset', () => {
	test('sets hash fields', async () => {
		setupMockFetch({ created: 2 })

		const kv = createKv({ baseURL: 'https://api.test.com', apiKey: 'sk_dev_test' })
		const result = await kv.hset('user:123', { name: 'John', age: 30 })

		expect(result).toBe(2)

		const body = getRequestBody()
		expect(body?.key).toBe('user:123')
		expect(body?.fields).toEqual({ name: 'John', age: 30 })
	})
})

describe('hget', () => {
	test('gets hash field', async () => {
		setupMockFetch({ value: 'John' })

		const kv = createKv({ baseURL: 'https://api.test.com', apiKey: 'sk_dev_test' })
		const result = await kv.hget('user:123', 'name')

		expect(result).toBe('John')

		const body = getRequestBody()
		expect(body?.key).toBe('user:123')
		expect(body?.field).toBe('name')
	})

	test('returns null for missing field', async () => {
		setupMockFetch({ value: null })

		const kv = createKv({ baseURL: 'https://api.test.com', apiKey: 'sk_dev_test' })
		const result = await kv.hget('user:123', 'nonexistent')

		expect(result).toBeNull()
	})
})

describe('hgetall', () => {
	test('gets all hash fields', async () => {
		setupMockFetch({ fields: { name: 'John', age: 30 } })

		const kv = createKv({ baseURL: 'https://api.test.com', apiKey: 'sk_dev_test' })
		const result = await kv.hgetall('user:123')

		expect(result).toEqual({ name: 'John', age: 30 })
	})

	test('returns null for missing hash', async () => {
		setupMockFetch({ fields: null })

		const kv = createKv({ baseURL: 'https://api.test.com', apiKey: 'sk_dev_test' })
		const result = await kv.hgetall('nonexistent')

		expect(result).toBeNull()
	})
})

// ============================================================================
// List Operations Tests
// ============================================================================

describe('lpush', () => {
	test('pushes values to list', async () => {
		setupMockFetch({ length: 3 })

		const kv = createKv({ baseURL: 'https://api.test.com', apiKey: 'sk_dev_test' })
		const result = await kv.lpush('notifications', 'msg1', 'msg2')

		expect(result).toBe(3)

		const body = getRequestBody()
		expect(body?.key).toBe('notifications')
		expect(body?.values).toEqual(['msg1', 'msg2'])
	})
})

describe('lrange', () => {
	test('gets list range with defaults', async () => {
		setupMockFetch({ values: ['a', 'b', 'c'] })

		const kv = createKv({ baseURL: 'https://api.test.com', apiKey: 'sk_dev_test' })
		const result = await kv.lrange('list')

		expect(result).toEqual(['a', 'b', 'c'])

		const body = getRequestBody()
		expect(body?.start).toBe(0)
		expect(body?.stop).toBe(-1)
	})

	test('gets list range with custom bounds', async () => {
		setupMockFetch({ values: ['b', 'c'] })

		const kv = createKv({ baseURL: 'https://api.test.com', apiKey: 'sk_dev_test' })
		const result = await kv.lrange('list', 1, 2)

		expect(result).toEqual(['b', 'c'])

		const body = getRequestBody()
		expect(body?.start).toBe(1)
		expect(body?.stop).toBe(2)
	})
})

// ============================================================================
// Sorted Set Operations Tests
// ============================================================================

describe('zadd', () => {
	test('adds members with scores', async () => {
		setupMockFetch({ added: 2 })

		const kv = createKv({ baseURL: 'https://api.test.com', apiKey: 'sk_dev_test' })
		const result = await kv.zadd(
			'leaderboard',
			{ score: 100, member: 'player1' },
			{ score: 200, member: 'player2' }
		)

		expect(result).toBe(2)

		const body = getRequestBody()
		expect(body?.key).toBe('leaderboard')
		expect(body?.members).toEqual([
			{ score: 100, member: 'player1' },
			{ score: 200, member: 'player2' },
		])
	})
})

describe('zrange', () => {
	test('gets range with defaults', async () => {
		setupMockFetch({
			members: [
				{ member: 'player1' },
				{ member: 'player2' },
			],
		})

		const kv = createKv({ baseURL: 'https://api.test.com', apiKey: 'sk_dev_test' })
		const result = await kv.zrange('leaderboard')

		expect(result).toHaveLength(2)
		expect(result[0].member).toBe('player1')
	})

	test('gets range with scores reversed', async () => {
		setupMockFetch({
			members: [
				{ member: 'player2', score: 200 },
				{ member: 'player1', score: 100 },
			],
		})

		const kv = createKv({ baseURL: 'https://api.test.com', apiKey: 'sk_dev_test' })
		const result = await kv.zrange('leaderboard', 0, 9, { withScores: true, rev: true })

		expect(result[0].member).toBe('player2')
		expect(result[0].score).toBe(200)

		const body = getRequestBody()
		expect(body?.withScores).toBe(true)
		expect(body?.rev).toBe(true)
	})
})

// ============================================================================
// Error Handling Tests
// ============================================================================

describe('error handling', () => {
	test('throws on non-200 response', async () => {
		setupMockFetch({ error: 'Key not found' }, 404)

		const kv = createKv({ baseURL: 'https://api.test.com', apiKey: 'sk_dev_test' })

		await expect(kv.get('test')).rejects.toThrow('Key not found')
	})

	test('throws generic error on parse failure', async () => {
		globalThis.fetch = mock(() => {
			return Promise.resolve(
				new Response('not json', {
					status: 500,
					headers: { 'Content-Type': 'text/plain' },
				})
			)
		}) as typeof fetch

		const kv = createKv({ baseURL: 'https://api.test.com', apiKey: 'sk_dev_test' })

		await expect(kv.get('test')).rejects.toThrow('Request failed')
	})
})

// ============================================================================
// getKv Singleton Tests
// ============================================================================

describe('getKv', () => {
	test('returns singleton instance when env vars set', () => {
		// Save original env
		const originalSecretKey = process.env.SYLPHX_SECRET_KEY

		// Set env for test
		process.env.SYLPHX_SECRET_KEY = 'sk_dev_test123'

		try {
			const kv1 = getKv()
			const kv2 = getKv()

			expect(kv1).toBe(kv2) // Same instance
			expect(typeof kv1.get).toBe('function')
		} finally {
			// Restore original env
			if (originalSecretKey === undefined) {
				delete process.env.SYLPHX_SECRET_KEY
			} else {
				process.env.SYLPHX_SECRET_KEY = originalSecretKey
			}
		}
	})

	test('throws when secret key not configured', () => {
		// Save and clear env
		const originalSecretKey = process.env.SYLPHX_SECRET_KEY
		delete process.env.SYLPHX_SECRET_KEY

		// Reset singleton for test (we need a fresh instance)
		// Note: In real code, the singleton persists, so this test only works
		// if run before any other getKv() call or after module reload

		try {
			// createKv without apiKey should throw
			expect(() => createKv({ baseURL: 'https://test.com' })).toThrow(/Secret Key is required/)
		} finally {
			// Restore
			if (originalSecretKey !== undefined) {
				process.env.SYLPHX_SECRET_KEY = originalSecretKey
			}
		}
	})
})
