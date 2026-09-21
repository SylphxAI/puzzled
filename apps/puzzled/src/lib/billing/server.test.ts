/**
 * TD-18: the server surface is the one resolver of the premium fact.
 *
 * The layout threads `getServerBilling` to the client as data and every page
 * gate reads the same request-cached read; these tests pin that the fact comes
 * from Commerce EvaluateEntitlement on the request that acts, and that an
 * unreadable authority answers free (fail-closed) - never from a cached or
 * client-supplied claim.
 */

import { afterEach, describe, expect, test } from 'bun:test'
import { FREE_GAME_ROTATION } from '../free-rotation'
import { canAccessGame, getServerBilling, getTodaysFreeGame, hasPremiumAccess } from './server'

const originalFetch = globalThis.fetch

afterEach(() => {
	globalThis.fetch = originalFetch
	delete process.env.COMMERCE_API_KEY
})

const today = getTodaysFreeGame()
/** A rotation module that is not today's free one. */
const lockedModule = FREE_GAME_ROTATION.find((slug) => slug !== today) as string

describe('the access gate re-evaluates the authority on the request', () => {
	test('an enabled answer admits a premium module', async () => {
		process.env.COMMERCE_API_KEY = 'commerce_key_a'
		const fetchMock = mockFetch({
			ok: true,
			body: { entitlement: { value: { enabled: true }, entitlement_code: 'premium' } },
		})

		expect(await canAccessGame('principal-a', lockedModule)).toBe(true)
		expect(fetchMock.mock.calls[0]?.[0]).toBe(
			'https://api.commerce.sylphx.com/v1/sylphx.commerce.v1.EntitlementService/EvaluateEntitlement',
		)
	})

	test('a disabled answer locks the same module', async () => {
		process.env.COMMERCE_API_KEY = 'commerce_key_a'
		mockFetch({
			ok: true,
			body: { entitlement: { value: { enabled: false }, entitlement_code: 'premium' } },
		})

		expect(await canAccessGame('principal-a', lockedModule)).toBe(false)
		// The free rotation stays playable regardless.
		expect(await canAccessGame('principal-a', today)).toBe(true)
	})
})

describe('the threaded snapshot', () => {
	test('carries the plan the chrome renders, from the same answer', async () => {
		process.env.COMMERCE_API_KEY = 'commerce_key_a'
		mockFetch({
			ok: true,
			body: { entitlement: { value: { enabled: true }, entitlement_code: 'custom' } },
		})

		expect(await getServerBilling('principal-a')).toEqual({
			isPremium: true,
			subscription: { planSlug: 'custom', status: 'active' },
		})
		expect(await hasPremiumAccess('principal-a')).toBe(true)
	})

	test('an unreachable authority answers free, never premium', async () => {
		process.env.COMMERCE_API_KEY = 'commerce_key_a'
		globalThis.fetch = (async () => {
			throw new Error('commerce unreachable')
		}) as unknown as typeof fetch

		expect(await getServerBilling('principal-a')).toEqual({
			isPremium: false,
			subscription: null,
		})
		expect(await hasPremiumAccess('principal-a')).toBe(false)
		expect(await canAccessGame('principal-a', lockedModule)).toBe(false)
	})
})

function mockFetch(result: { ok: boolean; body: unknown }) {
	const fetchMock = Object.assign(
		async () =>
			({
				ok: result.ok,
				status: result.ok ? 200 : 500,
				text: async () => JSON.stringify(result.body),
			}) as Response,
		{ mock: { calls: [] as Array<[string, RequestInit]> } },
	)
	const wrapped = ((url: string, init?: RequestInit) => {
		wrapped.mock.calls.push([url, init ?? {}])
		return fetchMock()
	}) as typeof fetch & { mock: { calls: Array<[string, RequestInit]> } }
	wrapped.mock = { calls: [] }
	globalThis.fetch = wrapped as typeof fetch
	return wrapped
}
