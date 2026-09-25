import { afterEach, describe, expect, mock, test } from 'bun:test'
import { getAppConfig } from './app-config'
import {
	destEventsCredential,
	destIdentityProjectId,
	destObservabilityCredential,
} from './credentials'
import {
	DEST_PEELS,
	destIdentityJson,
	destIdentityOrigin,
	destIdentityPrincipal,
	destJson,
} from './dest'
import { destEventsJson, destObservabilityJson, destSessionReplayChunksPath } from './peels'

const originalFetch = globalThis.fetch

// `unstable_cache` needs Next's incremental cache; under bun test it runs the loader.
mock.module('next/cache', () => ({ unstable_cache: <T>(load: T) => load }))

describe('Identity dest HTTP', () => {
	afterEach(() => {
		globalThis.fetch = originalFetch
		delete process.env.IDENTITY_API_ORIGIN
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
		expect(destIdentityOrigin('https://puzzled.api.sylphx.com')).toBe('https://api.sylphx.com')
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
		expect(Object.keys(headers).some((name) => name.toLowerCase().includes('binding'))).toBe(false)
	})

	test('destJson refuses Binding headers', async () => {
		await expect(
			destJson('https://api.observability.sylphx.com', '/v1/analytics:track', {
				credential: 'obs_key',
				headers: { 'sylphx-project-binding': 'binding-jws' },
			}),
		).rejects.toThrow('Binding')
	})

	test('getAppConfig lists dest Identity OIDC federations', async () => {
		process.env.IDENTITY_API_KEY = 'identity_org_key_a'
		const fetchMock = mockFetch({
			ok: true,
			body: { providers: [{ federation_id: 'google' }] },
		})
		const config = await getAppConfig()
		// Identity is the only config read; Puzzled sells no paid tier, so no
		// price list is fetched from anywhere.
		expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
			'https://api.sylphx.com/v1/oidc/federations:list',
		])
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
				device: {
					platform: 'DEVICE_PLATFORM_WEB_PUSH',
					user_id: 'principal-a',
					token: 'endpoint-a',
				},
			},
		})
		await destObservabilityJson('/v1/analytics:track', {
			method: 'POST',
			body: {
				idempotency_key: 'idem-track',
				event: { event: 'puzzle_complete', name: 'puzzle_complete' },
			},
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

	test('each dest product uses its own credential without sibling fallback', () => {
		const sibling = {
			IDENTITY_API_KEY: 'identity_org_key_a',
			SYLPHX_PROJECT_ID: 'proj_x',
			SYLPHX_SECRET_KEY: 'sk_prod_x',
		}
		expect(destEventsCredential(sibling)).toBeUndefined()
		expect(destObservabilityCredential(sibling)).toBeUndefined()
		expect(destIdentityProjectId(sibling)).toBeUndefined()
		expect(destIdentityProjectId({ IDENTITY_ORGANIZATION_ID: 'org_x' })).toBe('org_x')
		expect(destSessionReplayChunksPath('session-a')).toBe('/v1/session-replays/session-a:chunks')
	})

	test('no dest peel names a commerce product', () => {
		expect(Object.keys(DEST_PEELS)).not.toContain('commerce')
		expect(Object.values(DEST_PEELS).some((origin) => origin.includes('commerce'))).toBe(false)
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
