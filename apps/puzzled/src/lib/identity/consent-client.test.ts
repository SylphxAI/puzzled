import { afterEach, describe, expect, spyOn, test } from 'bun:test'
import { recordConsent } from './consent-client'

const originalFetch = globalThis.fetch

describe('recordConsent', () => {
	afterEach(() => {
		globalThis.fetch = originalFetch
	})

	test('retries once on a non-ok response and succeeds', async () => {
		let calls = 0
		globalThis.fetch = (async () => {
			calls++
			return { ok: calls > 1, status: calls > 1 ? 200 : 502 } as Response
		}) as unknown as typeof fetch
		expect(await recordConsent('analytics', 'granted', 0)).toBe(true)
		expect(calls).toBe(2)
	})

	test('warns without ids after the retry also fails, and does not throw', async () => {
		let calls = 0
		globalThis.fetch = (async () => {
			calls++
			throw new Error('offline')
		}) as unknown as typeof fetch
		const warn = spyOn(console, 'warn').mockImplementation(() => undefined)
		expect(await recordConsent('marketing', 'denied', 0)).toBe(false)
		expect(calls).toBe(2)
		expect(warn).toHaveBeenCalledTimes(1)
		expect(JSON.stringify(warn.mock.calls[0])).toBe(
			JSON.stringify([
				'consent record not saved on the server',
				{ purpose: 'marketing', state: 'denied' },
			]),
		)
		warn.mockRestore()
	})

	test('does not retry when the first write is ok', async () => {
		let calls = 0
		globalThis.fetch = (async () => {
			calls++
			return { ok: true, status: 200 } as Response
		}) as unknown as typeof fetch
		expect(await recordConsent('functional', 'granted', 0)).toBe(true)
		expect(calls).toBe(1)
	})
})
