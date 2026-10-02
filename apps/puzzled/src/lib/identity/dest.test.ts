import { afterEach, describe, expect, mock, test } from 'bun:test'
import { getAppConfig } from './app-config'
import { destEventsCredential, destIdentityProjectId } from './credentials'
import {
	authIdValue,
	DEST_PEELS,
	destIdentityJson,
	destIdentityOrigin,
	destIdentityPrincipal,
	destJson,
} from './dest'
import { destEventsJson } from './peels'

const originalFetch = globalThis.fetch
const OWN = 'organization-0199aa10-7b2c-7d3e-8f00-00000000c0de'

// `unstable_cache` needs Next's incremental cache; under bun test it runs the loader.
mock.module('next/cache', () => ({ unstable_cache: <T>(load: T) => load }))

describe('Identity dest HTTP', () => {
	afterEach(() => {
		globalThis.fetch = originalFetch
		delete process.env.SYLPHX_AUTH_URL
		delete process.env.SYLPHX_AUTH_SECRET_KEY
		delete process.env.SYLPHX_PUBLISHABLE_KEY
		delete process.env.EVENTS_API_KEY
	})

	test('parses dest snake_case principal_id', () => {
		expect(
			destIdentityPrincipal(
				{
					session: {
						session_id: 'session-a',
						principal: {
							principal_id: 'principal-puzzled-a',
							project_id: OWN,
							primary_email: 'a@example.com',
							primary_email_verified: true,
						},
					},
				},
				OWN,
			),
		).toEqual({
			principalId: 'principal-puzzled-a',
			primaryEmail: 'a@example.com',
			displayName: undefined,
			primaryEmailVerified: true,
		})
	})

	test("only a session of this product's own Auth instance is a principal", () => {
		const session = (project?: string) => ({
			session: {
				principal: {
					principal_id: 'usr_a',
					primary_email: 'a@example.com',
					...(project === undefined ? {} : { project_id: project }),
				},
			},
		})
		// (a) Our own instance, in either key case.
		expect(destIdentityPrincipal(session(OWN), OWN)?.principalId).toBe('usr_a')
		expect(
			destIdentityPrincipal({ principal: { principalId: 'usr_a', projectId: OWN } }, OWN),
		).not.toBeNull()
		// (b) Another tenant's instance, even with the same email.
		expect(
			destIdentityPrincipal(session('organization-0199aa10-7b2c-7d3e-8f00-00000000bad0'), OWN),
		).toBeNull()
		// (c) No or empty project id.
		expect(destIdentityPrincipal(session(), OWN)).toBeNull()
		expect(destIdentityPrincipal(session(''), OWN)).toBeNull()
		// (d) Our own id unset.
		expect(destIdentityPrincipal(session(OWN), undefined)).toBeNull()
		expect(destIdentityPrincipal(session(OWN), ' ')).toBeNull()
	})

	test('Auth ids compare by value across organization, TypeID and uuid forms', () => {
		// TypeID spec v0.3 vectors.
		expect(authIdValue('org_00000000000000000000000000')).toBe('0'.repeat(32))
		expect(authIdValue('org_01h455vb4pex5vsknk084sn02q')).toBe('01890a5dac96774bbcceb302099a8057')
		expect(authIdValue('aorg_01h455vb4pex5vsknk084sn02q')).toBe(
			authIdValue('organization-01890a5d-ac96-774b-bcce-b302099a8057'),
		)
		expect(authIdValue('organization-01890a5d-ac96-774b-bcce-b302099a8057')).toBe(
			'01890a5dac96774bbcceb302099a8057',
		)
		expect(authIdValue('organization-01890A5D-AC96-774B-BCCE-B302099A8057')).toBe(
			'01890a5dac96774bbcceb302099a8057',
		)
		expect(authIdValue('01890a5d-ac96-774b-bcce-b302099a8057')).toBe(
			'01890a5dac96774bbcceb302099a8057',
		)
		for (const malformed of [
			'',
			undefined,
			'org_puzzled',
			'org_81h455vb4pex5vsknk084sn02q',
			'org_01h455vb4pex5vsknk084sn02',
			'org_01h455vb4pex5vsknk084sn02u',
			'org_01H455VB4PEX5VSKNK084SN02Q',
			'o_01h455vb4pex5vsknk084sn02q',
			'organization_01h455vb4pex5vsknk084sn02q',
			'organization-01890a5dac96774bbcceb302099a8057',
			'organization-01890a5d-ac96-774b-bcce-b302099a805g',
		]) {
			expect(authIdValue(malformed)).toBeUndefined()
		}
		const legacy = 'organization-01890a5d-ac96-774b-bcce-b302099a8057'
		const typeid = 'org_01h455vb4pex5vsknk084sn02q'
		const session = (project: string) => ({
			principal: { principal_id: 'usr_a', project_id: project },
		})
		expect(destIdentityPrincipal(session(typeid), legacy)).not.toBeNull()
		expect(destIdentityPrincipal(session(legacy), typeid)).not.toBeNull()
		expect(
			destIdentityPrincipal(session('organization-01890a5d-ac96-774b-bcce-b302099a8058'), typeid),
		).toBeNull()
		expect(destIdentityPrincipal(session('org_01h455vb4pex5vsknk084sn02r'), legacy)).toBeNull()
		expect(destIdentityPrincipal(session('org_puzzled'), legacy)).toBeNull()
		expect(destIdentityPrincipal(session(legacy), 'org_puzzled')).toBeNull()
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
			destJson('https://api.events.sylphx.com', '/v1/devices', {
				credential: 'events_key',
				headers: { 'sylphx-project-binding': 'binding-jws' },
			}),
		).rejects.toThrow('Binding')
	})

	test("getAppConfig lists the social providers from Auth's client config", async () => {
		process.env.SYLPHX_AUTH_SECRET_KEY = 'identity_org_key_a'
		process.env.SYLPHX_PUBLISHABLE_KEY = 'sylphx_pk_test_a'
		const fetchMock = mockFetch({
			ok: true,
			body: { social: [{ provider: 'google', name: 'Google' }] },
		})
		const config = await getAppConfig()
		// Auth's client config is the only config read.
		expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
			'https://api.sylphx.com/v1/client/config?publishable_key=sylphx_pk_test_a',
		])
		expect(config.oauthProviders).toEqual(['google'])
		expect(config.consentTypes).toContain('analytics')
	})

	test('the Events dest peel accepts its product credential', async () => {
		process.env.EVENTS_API_KEY = 'events_key_a'
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
		expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
			'https://api.events.sylphx.com/v1/devices',
		])
		expect((fetchMock.mock.calls[0]?.[1] as RequestInit).headers).toEqual(
			expect.objectContaining({ Authorization: 'Bearer events_key_a' }),
		)
	})

	test('each dest product uses its own credential without sibling fallback', () => {
		const sibling = {
			SYLPHX_AUTH_SECRET_KEY: 'identity_org_key_a',
			SYLPHX_PROJECT_ID: 'proj_x',
			SYLPHX_SECRET_KEY: 'sk_prod_x',
		}
		expect(destEventsCredential(sibling)).toBeUndefined()
		expect(destIdentityProjectId(sibling)).toBeUndefined()
		expect(destIdentityProjectId({ SYLPHX_AUTH_ORGANIZATION_ID: 'org_x' })).toBe('org_x')
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
