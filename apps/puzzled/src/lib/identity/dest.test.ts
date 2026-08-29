import { afterEach, describe, expect, test } from 'bun:test'
import { getLeaderboard, getSubscription } from './index'
import {
	destIdentityJson,
	destIdentityOrigin,
	destIdentityPrincipal,
	destJson,
} from './dest'

const originalFetch = globalThis.fetch

describe('Identity dest HTTP', () => {
	afterEach(() => {
		globalThis.fetch = originalFetch
		delete process.env.IDENTITY_API_ORIGIN
		delete process.env.COMMERCE_API_ORIGIN
		delete process.env.COMMERCE_API_KEY
		delete process.env.IDENTITY_API_KEY
	})

	test('parses dest snake_case principal_id', () => {
		expect(
			destIdentityPrincipal({
				session: {
					session_id: 'session-a',
					principal: {
						principal_id: 'principal-puzzled-a',
						primary_email: 'a@example.com',
						primary_email_verified: true,
					},
				},
			}),
		).toEqual({
			principalId: 'principal-puzzled-a',
			primaryEmail: 'a@example.com',
			displayName: undefined,
			primaryEmailVerified: true,
		})
	})

	test('rejects suite-door {project}.api.sylphx.com as dest origin', () => {
		expect(destIdentityOrigin('https://puzzled.api.sylphx.com')).toBe(
			'https://api.identity.sylphx.com',
		)
	})

	test('never sends Binding on dest Identity', async () => {
		const fetchMock = mockFetch({
			ok: true,
			body: { session: { principal: { principal_id: 'principal-a' } } },
		})
		await destIdentityJson('https://identity.test', '/v1/sessions/current', {
			credential: 'identity_org_session_a',
		})
		expect(fetchMock.mock.calls).toHaveLength(1)
		const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
		expect(url).toBe('https://identity.test/v1/sessions/current')
		const headers = init.headers as Record<string, string>
		expect(headers.Authorization).toBe('Bearer identity_org_session_a')
		expect(Object.keys(headers).some((name) => name.toLowerCase().includes('binding'))).toBe(
			false,
		)
	})

	test('destJson refuses Binding headers', async () => {
		await expect(
			destJson('https://api.data.sylphx.com', '/v1/kv/ns/k', {
				credential: 'data_key',
				headers: { 'sylphx-project-binding': 'binding-jws' },
			}),
		).rejects.toThrow('Binding')
	})

	test('getLeaderboard calls Commerce dest, not an empty facsimile', async () => {
		process.env.COMMERCE_API_KEY = 'commerce_key_a'
		const fetchMock = mockFetch({
			ok: true,
			body: {
				entries: [{ rank: 1, account_id: 'principal-a', activity_count: 9 }],
			},
		})
		const result = await getLeaderboard({}, 'puzzled-sudoku-all', 'principal-a', { limit: 5 })
		expect(fetchMock.mock.calls[0]?.[0]).toBe(
			'https://api.commerce.sylphx.com/v1/sylphx.commerce.v1.EngagementService/ListEngagementLeaderboard',
		)
		const headers = (fetchMock.mock.calls[0]?.[1] as RequestInit).headers as Record<
			string,
			string
		>
		expect(headers.Authorization).toBe('Bearer commerce_key_a')
		expect(result.entries[0]?.userId).toBe('principal-a')
		expect(result.entries[0]?.value).toBe(9)
		expect(result.currentUserEntry?.isCurrentUser).toBe(true)
	})

	test('getSubscription evaluates Commerce dest entitlement', async () => {
		process.env.COMMERCE_API_KEY = 'commerce_key_a'
		mockFetch({
			ok: true,
			body: { entitlement: { value: { enabled: true }, entitlement_code: 'premium' } },
		})
		const subscription = await getSubscription({}, 'principal-a')
		expect(subscription).toEqual({ planSlug: 'premium', status: 'active' })
	})
})

function mockFetch(result: { ok: boolean; body: unknown; status?: number }) {
	const fetchMock = Object.assign(
		async () =>
			({
				ok: result.ok,
				status: result.status ?? (result.ok ? 200 : 500),
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
