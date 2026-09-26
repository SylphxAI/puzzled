import { describe, expect, it } from 'bun:test'
import { buildCaptureRequest, captureException, scrub, stackSignature } from './capture'
import { relayBrowserError } from './relay'

const env = {
	SYLPHX_API_KEY: 'sylphx_sk_live_test',
	SYLPHX_SERVICE_NAME: 'web',
	SYLPHX_GIT_COMMIT_SHA: 'abc123',
	SYLPHX_ENVIRONMENT_TYPE: 'production',
}

describe('scrub', () => {
	it('removes emails, keys, tokens, and query strings', () => {
		const out = scrub(
			'user jane.doe@example.com key sylphx_sk_live_AbC123 Bearer abcdefghijkl at https://x.test/a?token=1 and /b?c=d',
		)
		expect(out).toBe('user [email] key [secret] [secret] at https://x.test/a and /b')
	})
})

describe('grouping', () => {
	it('ignores line numbers and build hashes', () => {
		const a =
			'Error: x\n    at run (/_next/static/chunks/page-1a2b3c4d5e6f.js:10:5)\n    at go (file.js:3:1)'
		const b =
			'Error: x\n    at run (/_next/static/chunks/page-9f8e7d6c5b4a.js:99:7)\n    at go (file.js:8:2)'
		expect(stackSignature(a)).toBe(stackSignature(b))
	})

	it('groups equal errors under one fingerprint and different ones apart', async () => {
		// Created before any await, so all three share one stack (vitest adds async frames).
		const errors = [new TypeError('boom 1'), new TypeError('boom 1'), new RangeError('boom 1')]
		const [first, again, other] = await Promise.all(
			errors.map((error) => buildCaptureRequest(error, {}, env)),
		)
		expect(first.event.fingerprint).toEqual(again.event.fingerprint)
		expect(first.event.fingerprint).not.toEqual(other.event.fingerprint)
		expect(first.idempotencyKey).not.toBe(again.idempotencyKey)
	})

	it('carries release, service, and scrubbed breadcrumbs', async () => {
		const body = await buildCaptureRequest(
			new Error('failed for a@b.co'),
			{ route: '/pay?card=1', breadcrumbs: [{ category: 'ui', message: 'clicked by a@b.co' }] },
			env,
		)
		expect(body.event.release).toBe('abc123')
		expect(body.event.service).toBe('web')
		expect(body.event.message).toBe('failed for [email]')
		expect(body.event.route).toBe('/pay')
		expect(body.event.breadcrumbs[0]?.message).toBe('clicked by [email]')
		expect(JSON.stringify(body)).not.toContain('a@b.co')
	})
})

describe('captureException', () => {
	it('posts with the key and returns the occurrence id', async () => {
		let seen: { url: string; init: RequestInit } | undefined
		const fetch = (async (url: string, init: RequestInit) => {
			seen = { url, init }
			return new Response(JSON.stringify({ event: { identity: { id: 'occ-1' } } }), { status: 200 })
		}) as unknown as typeof globalThis.fetch
		const id = await captureException(new Error('x'), {}, { env, fetch })
		expect(id).toBe('occ-1')
		expect(seen?.url).toBe('https://api.observability.sylphx.com/v1/error-events:captureException')
		expect((seen?.init.headers as Record<string, string>).authorization).toBe(
			'Bearer sylphx_sk_live_test',
		)
	})

	it('never throws when the service is down or the key is missing', async () => {
		const down = (async () => {
			throw new Error('network')
		}) as unknown as typeof globalThis.fetch
		await expect(
			captureException(new Error('x'), {}, { env, fetch: down }),
		).resolves.toBeUndefined()
		await expect(
			captureException(new Error('x'), {}, { env: {}, fetch: down }),
		).resolves.toBeUndefined()
	})
})

describe('relayBrowserError', () => {
	const post = (
		body: string,
		headers: Record<string, string> = { 'sec-fetch-site': 'same-origin' },
	) => new Request('https://app.test/api/observability/errors', { method: 'POST', body, headers })

	it('refuses cross-site, oversized, and empty reports', async () => {
		expect((await relayBrowserError(post('{}', { 'sec-fetch-site': 'cross-site' }))).status).toBe(
			403,
		)
		expect((await relayBrowserError(post('x'.repeat(20_000)))).status).toBe(413)
		expect((await relayBrowserError(post('{"message":""}'))).status).toBe(400)
	})
})
