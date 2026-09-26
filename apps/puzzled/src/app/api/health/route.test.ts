import { describe, expect, test } from 'bun:test'
import { GET } from './route'

describe('web readiness check', () => {
	test('answers 200 without calling anything', async () => {
		const realFetch = globalThis.fetch
		let fetched = false
		globalThis.fetch = (async () => {
			fetched = true
			throw new Error('the readiness check must not call out')
		}) as unknown as typeof fetch
		try {
			const res = GET()
			expect(res.status).toBe(200)
			expect(await res.json()).toEqual({ status: 'ok' })
			expect(res.headers.get('cache-control')).toBe('no-store')
			expect(fetched).toBe(false)
		} finally {
			globalThis.fetch = realFetch
		}
	})
})
