import { describe, expect, it } from 'bun:test'
import { isTestTriggerAuthorized as isAuthorized } from '@/lib/observability/test-trigger'
import { POST } from './route'

const post = (authorization?: string) =>
	new Request('https://app.test/api/observability/test', {
		method: 'POST',
		headers: authorization ? { authorization } : {},
		body: JSON.stringify({ nonce: 'abc-123' }),
	})

describe('observability test trigger', () => {
	it('accepts only the environment key', () => {
		expect(isAuthorized('Bearer k1', 'k1')).toBe(true)
		expect(isAuthorized('Bearer k2', 'k1')).toBe(false)
		expect(isAuthorized(null, 'k1')).toBe(false)
		expect(isAuthorized('Bearer ', undefined)).toBe(false)
	})

	it('hides itself from other callers and throws the nonce for the key holder', async () => {
		process.env.SYLPHX_API_KEY = 'sylphx_sk_live_test'
		expect((await POST(post())).status).toBe(404)
		expect((await POST(post('Bearer wrong'))).status).toBe(404)
		await expect(POST(post('Bearer sylphx_sk_live_test'))).rejects.toThrow(
			'observability test error abc-123',
		)
		delete process.env.SYLPHX_API_KEY
	})
})
