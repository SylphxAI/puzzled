import { afterEach, describe, expect, test } from 'bun:test'
import { getAppConfig } from './app-config'
import {
	destCommerceCredential,
	destEventsCredential,
	destIdentityProjectId,
	destObservabilityCredential,
} from './credentials'
import {
	destIdentityJson,
	destIdentityOrigin,
	destIdentityPrincipal,
	destJson,
} from './dest'
import { createCheckout, getLeaderboard, getPlans, getSubscription, openPortal } from './index'
import { destEventsJson, destObservabilityJson, destSessionReplayChunksPath } from './peels'

const originalFetch = globalThis.fetch

describe('Identity dest HTTP', () => {
	afterEach(() => {
		globalThis.fetch = originalFetch
		delete process.env.IDENTITY_API_ORIGIN
		delete process.env.COMMERCE_API_ORIGIN
		delete process.env.COMMERCE_API_KEY
		delete process.env.IDENTITY_API_KEY
		delete process.env.EVENTS_API_KEY
		delete process.env.OBSERVABILITY_API_KEY
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
			destJson('https://api.observability.sylphx.com', '/v1/analytics:track', {
				credential: 'obs_key',
				headers: { 'sylphx-project-binding': 'binding-jws' },
			}),
		).rejects.toThrow('Binding')
	})

	test('getLeaderboard calls Commerce dest with board activity_kind', async () => {
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
		const init = fetchMock.mock.calls[0]?.[1] as RequestInit
		const headers = init.headers as Record<string, string>
		expect(headers.Authorization).toBe('Bearer commerce_key_a')
		expect(JSON.parse(String(init.body))).toEqual(
			expect.objectContaining({
				activity_kind: 'puzzled-sudoku-all',
				page: expect.objectContaining({ page_size: 5 }),
			}),
		)
		expect(result.entries[0]?.userId).toBe('principal-a')
		expect(result.entries[0]?.value).toBe(9)
		expect(result.currentUserEntry?.isCurrentUser).toBe(true)
	})

	test('getPlans and checkout hit Commerce dest ListPrices', async () => {
		process.env.COMMERCE_API_KEY = 'commerce_key_a'
		const fetchMock = mockFetch({
			ok: true,
			body: {
				prices: [
					{
						price_code: 'premium',
						display_name: 'Premium',
						cadence: { unit: 'BILLING_CADENCE_UNIT_MONTH' },
						tiers: [{ unit_minor: { numerator: 499, denominator: 1 } }],
					},
				],
			},
		})
		const plans = await getPlans({})
		expect(fetchMock.mock.calls[0]?.[0]).toBe(
			'https://api.commerce.sylphx.com/v1/sylphx.commerce.v1.InvoicingService/ListPrices',
		)
		expect(plans[0]).toEqual(
			expect.objectContaining({ slug: 'premium', name: 'Premium', monthlyPrice: 499 }),
		)
		await expect(createCheckout({}, { planSlug: 'premium', interval: 'monthly' })).rejects.toThrow(
			'commerce_checkout_unconfigured',
		)
	})

	test('openPortal lists dest Commerce invoices', async () => {
		process.env.COMMERCE_API_KEY = 'commerce_key_a'
		const fetchMock = mockFetch({ ok: true, body: { invoices: [] } })
		const url = await openPortal({}, 'principal-a')
		expect(fetchMock.mock.calls[0]?.[0]).toBe(
			'https://api.commerce.sylphx.com/v1/sylphx.commerce.v1.InvoicingService/ListInvoices',
		)
		expect(url).toBe('/settings/subscription')
	})

	test('getAppConfig lists dest Identity OIDC federations', async () => {
		process.env.IDENTITY_API_KEY = 'identity_org_key_a'
		process.env.COMMERCE_API_KEY = 'commerce_key_a'
		const fetchMock = mockFetch({
			ok: true,
			body: { providers: [{ federation_id: 'google' }], prices: [] },
		})
		const config = await getAppConfig()
		expect(fetchMock.mock.calls.map((call) => call[0])).toEqual(
			expect.arrayContaining([
				'https://api.identity.sylphx.com/v1/oidc/federations:list',
				'https://api.commerce.sylphx.com/v1/sylphx.commerce.v1.InvoicingService/ListPrices',
			]),
		)
		expect(config.oauthProviders).toEqual(['google'])
		expect(config.consentTypes).toContain('analytics')
	})

	test('Events and Observability dest peels accept product credentials', async () => {
		process.env.EVENTS_API_KEY = 'events_key_a'
		process.env.OBSERVABILITY_API_KEY = 'obs_key_a'
		const fetchMock = mockFetch({ ok: true, body: { devices: [] } })
		await destEventsJson('/v1/devices', {
			method: 'POST',
			body: {
				idempotency_key: 'idem-device',
				device: { platform: 'DEVICE_PLATFORM_WEB_PUSH', user_id: 'principal-a', token: 'endpoint-a' },
			},
		})
		await destObservabilityJson('/v1/analytics:track', {
			method: 'POST',
			body: { idempotency_key: 'idem-track', event: { event: 'puzzle_complete', name: 'puzzle_complete' } },
		})
		expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
			'https://api.events.sylphx.com/v1/devices',
			'https://api.observability.sylphx.com/v1/analytics:track',
		])
		expect((fetchMock.mock.calls[0]?.[1] as RequestInit).headers).toEqual(
			expect.objectContaining({ Authorization: 'Bearer events_key_a' }),
		)
		expect((fetchMock.mock.calls[1]?.[1] as RequestInit).headers).toEqual(
			expect.objectContaining({ Authorization: 'Bearer obs_key_a' }),
		)
	})

	test('getSubscription evaluates Commerce dest entitlement', async () => {
		process.env.COMMERCE_API_KEY = 'commerce_key_a'
		const fetchMock = mockFetch({
			ok: true,
			body: { entitlement: { value: { enabled: true }, entitlement_code: 'premium' } },
		})
		const subscription = await getSubscription({}, 'principal-a')
		expect(fetchMock.mock.calls[0]?.[0]).toBe(
			'https://api.commerce.sylphx.com/v1/sylphx.commerce.v1.EntitlementService/EvaluateEntitlement',
		)
		expect(subscription).toEqual({ planSlug: 'premium', status: 'active' })
	})

	test('each dest product uses its own credential without sibling fallback', () => {
		const sibling = {
			IDENTITY_API_KEY: 'identity_org_key_a',
			SYLPHX_PROJECT_ID: 'proj_x',
			SYLPHX_SECRET_KEY: 'sk_prod_x',
		}
		expect(destCommerceCredential(sibling)).toBeUndefined()
		expect(destEventsCredential(sibling)).toBeUndefined()
		expect(destObservabilityCredential(sibling)).toBeUndefined()
		expect(destIdentityProjectId(sibling)).toBeUndefined()
		expect(destIdentityProjectId({ IDENTITY_ORGANIZATION_ID: 'org_x' })).toBe('org_x')
		expect(destSessionReplayChunksPath('session-a')).toBe('/v1/session-replays/session-a:chunks')
	})

	test('commerce dest does not fall back to IDENTITY_API_KEY', async () => {
		process.env.IDENTITY_API_KEY = 'identity_org_key_a'
		await expect(getPlans({})).rejects.toThrow('COMMERCE_API_KEY')
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
