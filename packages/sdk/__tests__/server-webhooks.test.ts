/**
 * Server Webhook Verification Tests
 *
 * Tests for verifyWebhook() and createWebhookHandler() from @sylphx/sdk/server.
 * These are critical security functions - must be bulletproof.
 */

import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test'

// We need to test the actual implementation
// Since verifyWebhook uses Web Crypto API, we can test it directly

// ============================================================================
// Test Helpers - Recreate the signing logic for test verification
// ============================================================================

async function computeHmacSha256(message: string, secret: string): Promise<string> {
	const encoder = new TextEncoder()
	const keyData = encoder.encode(secret)
	const messageData = encoder.encode(message)

	const cryptoKey = await crypto.subtle.importKey(
		'raw',
		keyData,
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	)

	const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData)
	return Buffer.from(signature).toString('hex')
}

async function createSignedWebhook(payload: object, secret: string): Promise<{
	body: string
	signatureHeader: string
	timestamp: number
}> {
	const timestamp = Math.floor(Date.now() / 1000)
	const body = JSON.stringify(payload)
	const signedPayload = `${timestamp}.${body}`
	const signature = await computeHmacSha256(signedPayload, secret)

	return {
		body,
		signatureHeader: `t=${timestamp},v1=${signature}`,
		timestamp,
	}
}

// Import the actual functions to test
import { verifyWebhook, createWebhookHandler } from '../src/server/index'

// ============================================================================
// verifyWebhook() Tests
// ============================================================================

describe('verifyWebhook', () => {
	const testSecret = 'whsec_test_secret_12345'
	const testPayload = {
		event: 'user.created',
		data: { userId: 'user-123', email: 'test@example.com' },
		timestamp: Date.now(),
		id: 'evt-123',
	}

	describe('valid signatures', () => {
		test('verifies valid signature from header', async () => {
			const { body, signatureHeader } = await createSignedWebhook(testPayload, testSecret)

			const result = await verifyWebhook({
				payload: body,
				signatureHeader,
				secret: testSecret,
			})

			expect(result.valid).toBe(true)
			expect(result.payload).toBeDefined()
			expect(result.payload?.event).toBe('user.created')
		})

		test('verifies valid signature with pre-extracted values', async () => {
			const timestamp = Math.floor(Date.now() / 1000)
			const body = JSON.stringify(testPayload)
			const signedPayload = `${timestamp}.${body}`
			const signature = await computeHmacSha256(signedPayload, testSecret)

			const result = await verifyWebhook({
				payload: body,
				signature,
				timestamp: String(timestamp),
				secret: testSecret,
			})

			expect(result.valid).toBe(true)
		})

		test('parses payload correctly', async () => {
			const payload = {
				event: 'subscription.updated',
				data: { planId: 'premium', status: 'active' },
				timestamp: 1705320000000,
				id: 'evt-456',
			}
			const { body, signatureHeader } = await createSignedWebhook(payload, testSecret)

			const result = await verifyWebhook({
				payload: body,
				signatureHeader,
				secret: testSecret,
			})

			expect(result.valid).toBe(true)
			expect(result.payload?.event).toBe('subscription.updated')
			expect(result.payload?.data).toEqual({ planId: 'premium', status: 'active' })
			expect(result.payload?.id).toBe('evt-456')
		})
	})

	describe('signature validation', () => {
		test('rejects missing signature', async () => {
			const result = await verifyWebhook({
				payload: JSON.stringify(testPayload),
				signatureHeader: null,
				secret: testSecret,
			})

			expect(result.valid).toBe(false)
			expect(result.error).toContain('Missing signature')
		})

		test('rejects empty signature header', async () => {
			const result = await verifyWebhook({
				payload: JSON.stringify(testPayload),
				signatureHeader: '',
				secret: testSecret,
			})

			expect(result.valid).toBe(false)
			expect(result.error).toContain('Missing')
		})

		test('rejects malformed signature header', async () => {
			const result = await verifyWebhook({
				payload: JSON.stringify(testPayload),
				signatureHeader: 'invalid-format',
				secret: testSecret,
			})

			expect(result.valid).toBe(false)
		})

		test('rejects signature header without timestamp', async () => {
			const result = await verifyWebhook({
				payload: JSON.stringify(testPayload),
				signatureHeader: 'v1=abc123',
				secret: testSecret,
			})

			expect(result.valid).toBe(false)
			expect(result.error).toContain('Missing timestamp')
		})

		test('rejects signature header without signature', async () => {
			const result = await verifyWebhook({
				payload: JSON.stringify(testPayload),
				signatureHeader: 't=1705320000',
				secret: testSecret,
			})

			expect(result.valid).toBe(false)
			expect(result.error).toContain('Missing signature')
		})

		test('rejects wrong signature', async () => {
			const { body, timestamp } = await createSignedWebhook(testPayload, testSecret)
			const wrongSignature = 'a'.repeat(64)

			const result = await verifyWebhook({
				payload: body,
				signatureHeader: `t=${timestamp},v1=${wrongSignature}`,
				secret: testSecret,
			})

			expect(result.valid).toBe(false)
			expect(result.error).toContain('Invalid signature')
		})

		test('rejects signature from wrong secret', async () => {
			const { body, signatureHeader } = await createSignedWebhook(testPayload, 'wrong_secret')

			const result = await verifyWebhook({
				payload: body,
				signatureHeader,
				secret: testSecret,
			})

			expect(result.valid).toBe(false)
			expect(result.error).toContain('Invalid signature')
		})

		test('rejects tampered payload', async () => {
			const { signatureHeader } = await createSignedWebhook(testPayload, testSecret)
			const tamperedPayload = JSON.stringify({ ...testPayload, event: 'tampered' })

			const result = await verifyWebhook({
				payload: tamperedPayload,
				signatureHeader,
				secret: testSecret,
			})

			expect(result.valid).toBe(false)
			expect(result.error).toContain('Invalid signature')
		})
	})

	describe('timestamp validation', () => {
		test('rejects webhook with old timestamp (>5 minutes by default)', async () => {
			const oldTimestamp = Math.floor(Date.now() / 1000) - 400 // 6+ minutes ago
			const body = JSON.stringify(testPayload)
			const signedPayload = `${oldTimestamp}.${body}`
			const signature = await computeHmacSha256(signedPayload, testSecret)

			const result = await verifyWebhook({
				payload: body,
				signatureHeader: `t=${oldTimestamp},v1=${signature}`,
				secret: testSecret,
			})

			expect(result.valid).toBe(false)
			expect(result.error).toContain('too old')
		})

		test('rejects webhook with future timestamp', async () => {
			const futureTimestamp = Math.floor(Date.now() / 1000) + 120 // 2 minutes in future
			const body = JSON.stringify(testPayload)
			const signedPayload = `${futureTimestamp}.${body}`
			const signature = await computeHmacSha256(signedPayload, testSecret)

			const result = await verifyWebhook({
				payload: body,
				signatureHeader: `t=${futureTimestamp},v1=${signature}`,
				secret: testSecret,
			})

			expect(result.valid).toBe(false)
			expect(result.error).toContain('future')
		})

		test('accepts webhook within clock skew allowance', async () => {
			// 15 seconds in the future should be accepted (30s default clock skew)
			const nearFutureTimestamp = Math.floor(Date.now() / 1000) + 15
			const body = JSON.stringify(testPayload)
			const signedPayload = `${nearFutureTimestamp}.${body}`
			const signature = await computeHmacSha256(signedPayload, testSecret)

			const result = await verifyWebhook({
				payload: body,
				signatureHeader: `t=${nearFutureTimestamp},v1=${signature}`,
				secret: testSecret,
			})

			expect(result.valid).toBe(true)
		})

		test('rejects invalid timestamp format', async () => {
			const result = await verifyWebhook({
				payload: JSON.stringify(testPayload),
				signatureHeader: 't=not-a-number,v1=abc123',
				secret: testSecret,
			})

			expect(result.valid).toBe(false)
			// The regex t=(\d+) won't match non-digits, so it returns "Missing timestamp"
			expect(result.error).toBeDefined()
		})

		test('respects custom maxAge option', async () => {
			// Webhook from 2 minutes ago
			const twoMinutesAgo = Math.floor(Date.now() / 1000) - 120
			const body = JSON.stringify(testPayload)
			const signedPayload = `${twoMinutesAgo}.${body}`
			const signature = await computeHmacSha256(signedPayload, testSecret)

			// Should fail with 1 minute maxAge
			const resultFail = await verifyWebhook({
				payload: body,
				signatureHeader: `t=${twoMinutesAgo},v1=${signature}`,
				secret: testSecret,
				verifyOptions: { maxAge: 60_000 }, // 1 minute
			})
			expect(resultFail.valid).toBe(false)

			// Should pass with 5 minute maxAge
			const resultPass = await verifyWebhook({
				payload: body,
				signatureHeader: `t=${twoMinutesAgo},v1=${signature}`,
				secret: testSecret,
				verifyOptions: { maxAge: 300_000 }, // 5 minutes
			})
			expect(resultPass.valid).toBe(true)
		})

		test('respects custom clockSkew option', async () => {
			// 45 seconds in the future
			const futureTimestamp = Math.floor(Date.now() / 1000) + 45
			const body = JSON.stringify(testPayload)
			const signedPayload = `${futureTimestamp}.${body}`
			const signature = await computeHmacSha256(signedPayload, testSecret)

			// Should fail with 30s clock skew (default)
			const resultFail = await verifyWebhook({
				payload: body,
				signatureHeader: `t=${futureTimestamp},v1=${signature}`,
				secret: testSecret,
				verifyOptions: { clockSkew: 30_000 },
			})
			expect(resultFail.valid).toBe(false)

			// Should pass with 60s clock skew
			const resultPass = await verifyWebhook({
				payload: body,
				signatureHeader: `t=${futureTimestamp},v1=${signature}`,
				secret: testSecret,
				verifyOptions: { clockSkew: 60_000 },
			})
			expect(resultPass.valid).toBe(true)
		})
	})

	describe('error handling', () => {
		test('handles invalid JSON payload', async () => {
			const timestamp = Math.floor(Date.now() / 1000)
			const invalidJson = 'not valid json {'
			const signedPayload = `${timestamp}.${invalidJson}`
			const signature = await computeHmacSha256(signedPayload, testSecret)

			const result = await verifyWebhook({
				payload: invalidJson,
				signatureHeader: `t=${timestamp},v1=${signature}`,
				secret: testSecret,
			})

			expect(result.valid).toBe(false)
			// Error should mention JSON parsing issue
		})

		test('handles empty payload', async () => {
			const timestamp = Math.floor(Date.now() / 1000)
			const emptyPayload = ''
			const signedPayload = `${timestamp}.${emptyPayload}`
			const signature = await computeHmacSha256(signedPayload, testSecret)

			const result = await verifyWebhook({
				payload: emptyPayload,
				signatureHeader: `t=${timestamp},v1=${signature}`,
				secret: testSecret,
			})

			// Empty string is not valid JSON
			expect(result.valid).toBe(false)
		})

		test('returns error object, not throw', async () => {
			// verifyWebhook should return error result, not throw
			const result = await verifyWebhook({
				payload: 'invalid',
				signatureHeader: 'invalid',
				secret: testSecret,
			})

			expect(typeof result).toBe('object')
			expect(result.valid).toBe(false)
			expect(result.error).toBeDefined()
		})
	})

	describe('timing attack protection', () => {
		test('signature comparison is constant-time', async () => {
			// This is a behavioral test - we can't directly test timing
			// but we verify the function handles wrong signatures correctly
			const { body, timestamp } = await createSignedWebhook(testPayload, testSecret)

			// Test signatures of same length but wrong
			const wrongSig1 = 'a'.repeat(64)
			const wrongSig2 = 'b'.repeat(64)

			const result1 = await verifyWebhook({
				payload: body,
				signatureHeader: `t=${timestamp},v1=${wrongSig1}`,
				secret: testSecret,
			})

			const result2 = await verifyWebhook({
				payload: body,
				signatureHeader: `t=${timestamp},v1=${wrongSig2}`,
				secret: testSecret,
			})

			// Both should fail with same error
			expect(result1.valid).toBe(false)
			expect(result2.valid).toBe(false)
			expect(result1.error).toBe(result2.error)
		})
	})
})

// ============================================================================
// createWebhookHandler() Tests
// ============================================================================

describe('createWebhookHandler', () => {
	const testSecret = 'whsec_handler_secret'

	test('creates a function that handles requests', () => {
		const handler = createWebhookHandler({
			secret: testSecret,
			handlers: {},
		})

		expect(typeof handler).toBe('function')
	})

	describe('signature verification', () => {
		test('rejects requests with invalid signature', async () => {
			const handler = createWebhookHandler({
				secret: testSecret,
				handlers: {
					'test.event': async () => {},
				},
			})

			const request = new Request('https://example.com/webhooks', {
				method: 'POST',
				headers: {
					'x-webhook-signature': 'invalid',
				},
				body: JSON.stringify({ event: 'test.event', data: {} }),
			})

			const response = await handler(request)

			expect(response.status).toBe(401)
			const body = await response.json()
			expect(body.error).toBeDefined()
		})

		test('accepts requests with valid signature', async () => {
			const payload = { event: 'test.event', data: { test: true }, timestamp: Date.now(), id: 'evt-1' }
			const { body, signatureHeader } = await createSignedWebhook(payload, testSecret)

			const handler = createWebhookHandler({
				secret: testSecret,
				handlers: {
					'test.event': async () => {},
				},
			})

			const request = new Request('https://example.com/webhooks', {
				method: 'POST',
				headers: {
					'x-webhook-signature': signatureHeader,
				},
				body,
			})

			const response = await handler(request)

			expect(response.status).toBe(200)
		})
	})

	describe('event routing', () => {
		test('calls correct handler for event type', async () => {
			let handledData: unknown = null
			const payload = { event: 'user.created', data: { userId: 'user-123' }, timestamp: Date.now(), id: 'evt-1' }
			const { body, signatureHeader } = await createSignedWebhook(payload, testSecret)

			const handler = createWebhookHandler({
				secret: testSecret,
				handlers: {
					'user.created': async (data) => {
						handledData = data
					},
					'user.deleted': async () => {
						throw new Error('Wrong handler called')
					},
				},
			})

			const request = new Request('https://example.com/webhooks', {
				method: 'POST',
				headers: {
					'x-webhook-signature': signatureHeader,
				},
				body,
			})

			await handler(request)

			expect(handledData).toEqual({ userId: 'user-123' })
		})

		test('returns handled: false for unregistered event', async () => {
			const payload = { event: 'unknown.event', data: {}, timestamp: Date.now(), id: 'evt-1' }
			const { body, signatureHeader } = await createSignedWebhook(payload, testSecret)

			const handler = createWebhookHandler({
				secret: testSecret,
				handlers: {
					'known.event': async () => {},
				},
			})

			const request = new Request('https://example.com/webhooks', {
				method: 'POST',
				headers: {
					'x-webhook-signature': signatureHeader,
				},
				body,
			})

			const response = await handler(request)

			expect(response.status).toBe(200)
			const responseBody = await response.json()
			expect(responseBody.received).toBe(true)
			expect(responseBody.handled).toBe(false)
		})

		test('returns handled: true when handler succeeds', async () => {
			const payload = { event: 'test.event', data: {}, timestamp: Date.now(), id: 'evt-1' }
			const { body, signatureHeader } = await createSignedWebhook(payload, testSecret)

			const handler = createWebhookHandler({
				secret: testSecret,
				handlers: {
					'test.event': async () => {
						// Handler succeeds
					},
				},
			})

			const request = new Request('https://example.com/webhooks', {
				method: 'POST',
				headers: {
					'x-webhook-signature': signatureHeader,
				},
				body,
			})

			const response = await handler(request)

			expect(response.status).toBe(200)
			const responseBody = await response.json()
			expect(responseBody.received).toBe(true)
			expect(responseBody.handled).toBe(true)
		})
	})

	describe('error handling', () => {
		test('returns 500 when handler throws', async () => {
			const payload = { event: 'failing.event', data: {}, timestamp: Date.now(), id: 'evt-1' }
			const { body, signatureHeader } = await createSignedWebhook(payload, testSecret)

			const handler = createWebhookHandler({
				secret: testSecret,
				handlers: {
					'failing.event': async () => {
						throw new Error('Handler failure')
					},
				},
			})

			const request = new Request('https://example.com/webhooks', {
				method: 'POST',
				headers: {
					'x-webhook-signature': signatureHeader,
				},
				body,
			})

			const response = await handler(request)

			expect(response.status).toBe(500)
			const responseBody = await response.json()
			expect(responseBody.error).toBe('Handler failed')
			expect(responseBody.message).toBe('Handler failure')
		})

		test('handles non-Error throws', async () => {
			const payload = { event: 'throwing.event', data: {}, timestamp: Date.now(), id: 'evt-1' }
			const { body, signatureHeader } = await createSignedWebhook(payload, testSecret)

			const handler = createWebhookHandler({
				secret: testSecret,
				handlers: {
					'throwing.event': async () => {
						throw 'string error'
					},
				},
			})

			const request = new Request('https://example.com/webhooks', {
				method: 'POST',
				headers: {
					'x-webhook-signature': signatureHeader,
				},
				body,
			})

			const response = await handler(request)

			expect(response.status).toBe(500)
			const responseBody = await response.json()
			expect(responseBody.error).toBe('Handler failed')
			expect(responseBody.message).toBe('Unknown error')
		})
	})

	describe('response format', () => {
		test('returns JSON content type', async () => {
			const payload = { event: 'test.event', data: {}, timestamp: Date.now(), id: 'evt-1' }
			const { body, signatureHeader } = await createSignedWebhook(payload, testSecret)

			const handler = createWebhookHandler({
				secret: testSecret,
				handlers: {},
			})

			const request = new Request('https://example.com/webhooks', {
				method: 'POST',
				headers: {
					'x-webhook-signature': signatureHeader,
				},
				body,
			})

			const response = await handler(request)

			expect(response.headers.get('Content-Type')).toBe('application/json')
		})
	})

	describe('verify options', () => {
		test('passes verifyOptions to verifyWebhook', async () => {
			// Create a webhook with old timestamp
			const oldTimestamp = Math.floor(Date.now() / 1000) - 400 // >5 minutes ago
			const payload = { event: 'test.event', data: {}, timestamp: Date.now(), id: 'evt-1' }
			const body = JSON.stringify(payload)
			const signedPayload = `${oldTimestamp}.${body}`
			const signature = await computeHmacSha256(signedPayload, testSecret)

			// Handler with extended maxAge
			const handler = createWebhookHandler({
				secret: testSecret,
				handlers: {
					'test.event': async () => {},
				},
				verifyOptions: {
					maxAge: 600_000, // 10 minutes
				},
			})

			const request = new Request('https://example.com/webhooks', {
				method: 'POST',
				headers: {
					'x-webhook-signature': `t=${oldTimestamp},v1=${signature}`,
				},
				body,
			})

			const response = await handler(request)

			// Should succeed with extended maxAge
			expect(response.status).toBe(200)
		})
	})
})
