import { afterAll, afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'

// Exercise the real routes, session resolution and transport; mock only Next's
// request context and the remote Auth service.
let cookieValues: Record<string, string> = {}
mock.module('next/headers', () => ({
	cookies: async () => ({
		get: (name: string) => (cookieValues[name] ? { value: cookieValues[name] } : undefined),
	}),
	headers: async () => new Headers({ host: 'puzzled.gg', 'user-agent': 'TestBrowser/1.0' }),
}))

const { GET, POST } = await import('@/app/api/identity/policy-consent/route')
const { policyConsentRequest } = await import('./policy-consent-server')
const { POLICY_ACCEPTANCE, isPolicyAcceptance, isPolicyConsentStatus, hasCurrentPolicyConsent } =
	await import('./policy-consent')

const token = 'identity_org_session_test'
const userId = 'principal-own'
const organization = 'organization-00000000-0000-7000-8000-000000000001'
const originalFetch = globalThis.fetch
const envKeys = [
	'SYLPHX_AUTH_URL',
	'SYLPHX_AUTH_SECRET_KEY',
	'SYLPHX_AUTH_ORGANIZATION_ID',
	'SYLPHX_PUBLISHABLE_KEY',
	'SYLPHX_PUBLIC_URL',
] as const
const savedEnv: Record<string, string | undefined> = {}
const currentStatus = {
	user_id: userId,
	current_terms_version: '2026-11-14',
	current_privacy_version: '2026-11-14',
	accepted_terms_version: '2026-11-14',
	accepted_privacy_version: '2026-11-14',
	accepted_at: '2026-11-14T00:00:00Z',
	needs_reconsent: false,
}
const staleStatus = {
	...currentStatus,
	accepted_terms_version: null,
	accepted_privacy_version: null,
	accepted_at: null,
	needs_reconsent: true,
}
type Call = { url: string; headers: Headers; init: RequestInit; body: unknown }
let calls: Call[] = []
let consentUpstream: () => Response = () => Response.json(currentStatus)
let sessionOrganization = organization

beforeEach(() => {
	for (const key of envKeys) savedEnv[key] = process.env[key]
	process.env.SYLPHX_AUTH_URL = 'https://bound-auth.example/'
	process.env.SYLPHX_AUTH_SECRET_KEY = 'sylphx_sk_test_secret'
	process.env.SYLPHX_AUTH_ORGANIZATION_ID = organization
	process.env.SYLPHX_PUBLISHABLE_KEY = 'sylphx_pk_test_public'
	process.env.SYLPHX_PUBLIC_URL = 'https://puzzled.gg'
	cookieValues = { puzzled_session: token }
	calls = []
	sessionOrganization = organization
	consentUpstream = () => Response.json(currentStatus)
	globalThis.fetch = (async (url: string | URL | Request, init: RequestInit = {}) => {
		const call: Call = {
			url: String(url),
			headers: new Headers(init.headers),
			init,
			body: typeof init.body === 'string' ? JSON.parse(init.body) : null,
		}
		calls.push(call)
		if (call.url.endsWith('/v1/sessions/current'))
			return Response.json({
				session: { principal: { principal_id: userId, project_id: sessionOrganization } },
			})
		return consentUpstream()
	}) as typeof fetch
})
afterEach(() => {
	globalThis.fetch = originalFetch
	for (const key of envKeys) {
		if (savedEnv[key] === undefined) delete process.env[key]
		else process.env[key] = savedEnv[key]
	}
})
afterAll(() => mock.restore())

function getRequest() {
	return new Request('https://puzzled.gg/api/identity/policy-consent', {
		headers: { 'user-agent': 'TestBrowser/1.0' },
	})
}
function postRequest(body: unknown = POLICY_ACCEPTANCE, headers: Record<string, string> = {}) {
	return new Request(getRequest().url, {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			origin: 'https://puzzled.gg',
			'user-agent': 'TestBrowser/1.0',
			...headers,
		},
		body: JSON.stringify(body),
	})
}
function consentCalls() {
	return calls.filter((call) => !call.url.endsWith('/v1/sessions/current'))
}

const invalidStatuses: [string, unknown][] = [
	['abbreviated success', { accepted: true }],
	['foreign player', { ...currentStatus, user_id: 'principal-other' }],
	['missing accepted evidence', { ...currentStatus, accepted_at: undefined }],
	['invalid acceptance timestamp', { ...currentStatus, accepted_at: 'not-a-date' }],
	['non-boolean flag', { ...currentStatus, needs_reconsent: 'false' }],
	['outdated current policy', { ...currentStatus, current_terms_version: '2025-01-01' }],
	['impossible policy date', { ...currentStatus, current_privacy_version: '2026-02-30' }],
	['malformed accepted version', { ...currentStatus, accepted_terms_version: '2.03.0' }],
]

describe('policy consent assertion and receipt helpers', () => {
	test('requires exactly the current four-field affirmative assertion', () => {
		expect(POLICY_ACCEPTANCE).toEqual({
			terms_accepted: true,
			terms_version: '2026-11-14',
			privacy_version: '2026-11-14',
			surface: 'puzzled_web',
		})
		expect(isPolicyAcceptance(POLICY_ACCEPTANCE)).toBe(true)
		for (const invalid of [
			null,
			[],
			{},
			{ ...POLICY_ACCEPTANCE, terms_accepted: false },
			{ ...POLICY_ACCEPTANCE, terms_accepted: 'true' },
			{ ...POLICY_ACCEPTANCE, terms_version: '2025-01-01' },
			{ ...POLICY_ACCEPTANCE, privacy_version: '' },
			{ ...POLICY_ACCEPTANCE, surface: 'other' },
			{ ...POLICY_ACCEPTANCE, user_id: 'principal-other' },
		])
			expect(isPolicyAcceptance(invalid)).toBe(false)
	})
	test('accepts full stale receipts but never treats them as clearance', () => {
		expect(isPolicyConsentStatus(staleStatus, userId)).toBe(true)
		expect(hasCurrentPolicyConsent(staleStatus)).toBe(false)
		expect(hasCurrentPolicyConsent({ ...staleStatus, needs_reconsent: false })).toBe(false)
		expect(hasCurrentPolicyConsent({ ...currentStatus, needs_reconsent: true })).toBe(false)
	})
	test('trusts Auth compatibility rather than requiring local version equality', () => {
		const compatible = {
			...currentStatus,
			current_terms_version: '2027-01-01',
			current_privacy_version: '2027-01-01',
			accepted_terms_version: '2.3.0',
			accepted_privacy_version: '2.5.0',
		}
		expect(isPolicyConsentStatus(compatible, userId)).toBe(true)
		expect(hasCurrentPolicyConsent(compatible)).toBe(true)
	})
	for (const [name, status] of invalidStatuses)
		test(`rejects ${name}`, () => {
			expect(isPolicyConsentStatus(status, userId)).toBe(false)
		})
})

describe('policy consent session transport', () => {
	test('uses session bearer, organization and browser fingerprint without a product secret', async () => {
		expect(await policyConsentRequest(token, userId, 'TestBrowser/1.0')).toEqual(currentStatus)
		const call = calls[0]
		expect(call?.url).toBe('https://bound-auth.example/v1/auth/consent:status')
		expect(call?.init.method).toBe('GET')
		expect(call?.headers.get('authorization')).toBe(['Bearer', token].join(' '))
		expect(call?.headers.get('x-sylphx-organization')).toBe(organization)
		expect(call?.headers.get('user-agent')).toBe('TestBrowser/1.0')
		expect(call?.headers.get('x-sylphx-caller-key')).toBeNull()
		expect(call?.body).toBeNull()
		expect(call?.init.cache).toBe('no-store')
		expect(call?.init.signal).toBeInstanceOf(AbortSignal)
	})
	test('accepts only with the exact assertion and preserves the full receipt', async () => {
		expect(await policyConsentRequest(token, userId, 'TestBrowser/1.0', POLICY_ACCEPTANCE)).toEqual(
			currentStatus,
		)
		expect(calls[0]?.url).toBe('https://bound-auth.example/v1/auth/consent:accept')
		expect(calls[0]?.init.method).toBe('POST')
		expect(calls[0]?.headers.get('content-type')).toBe('application/json')
		expect(calls[0]?.body).toEqual(POLICY_ACCEPTANCE)
	})
	test('fails closed when the organization is unavailable', async () => {
		delete process.env.SYLPHX_AUTH_ORGANIZATION_ID
		await expect(policyConsentRequest(token, userId, 'TestBrowser/1.0')).rejects.toThrow(
			'policy_consent_unconfigured',
		)
		expect(calls).toHaveLength(0)
	})
})

describe('policy consent browser routes', () => {
	test('GET returns a validated full receipt', async () => {
		const response = await GET(getRequest())
		expect(response.status).toBe(200)
		expect(await response.json()).toEqual(currentStatus)
		expect(consentCalls()).toHaveLength(1)
	})
	test('GET returns stale evidence without fabricating acceptance', async () => {
		consentUpstream = () => Response.json(staleStatus)
		const response = await GET(getRequest())
		expect(response.status).toBe(200)
		expect(await response.json()).toEqual(staleStatus)
	})
	test('GET and POST reject a missing session without calling Auth', async () => {
		cookieValues = {}
		expect((await GET(getRequest())).status).toBe(401)
		expect((await POST(postRequest())).status).toBe(401)
		expect(calls).toHaveLength(0)
	})
	test('GET and POST reject a session bound to another organization', async () => {
		sessionOrganization = 'organization-other'
		expect((await GET(getRequest())).status).toBe(401)
		expect((await POST(postRequest())).status).toBe(401)
		expect(consentCalls()).toHaveLength(0)
	})
	test('POST forwards exactly the affirmative assertion with session credentials', async () => {
		const response = await POST(postRequest())
		expect(response.status).toBe(200)
		expect(await response.json()).toEqual(currentStatus)
		const call = consentCalls()[0]
		expect(call?.url).toBe('https://bound-auth.example/v1/auth/consent:accept')
		expect(call?.body).toEqual(POLICY_ACCEPTANCE)
		expect(call?.headers.get('authorization')).toBe(['Bearer', token].join(' '))
		expect(call?.headers.get('user-agent')).toBe('TestBrowser/1.0')
	})
	test('POST rejects false, stale, missing, foreign-surface and extra assertions', async () => {
		for (const body of [
			{},
			null,
			{ ...POLICY_ACCEPTANCE, terms_accepted: false },
			{ ...POLICY_ACCEPTANCE, terms_version: '2025-01-01' },
			{ ...POLICY_ACCEPTANCE, surface: 'other' },
			{ ...POLICY_ACCEPTANCE, user_id: 'principal-other' },
		])
			expect((await POST(postRequest(body))).status).toBe(400)
		expect(consentCalls()).toHaveLength(0)
	})
	test('POST refuses malformed JSON', async () => {
		const response = await POST(
			new Request(getRequest().url, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: '{',
			}),
		)
		expect(response.status).toBe(400)
		expect(consentCalls()).toHaveLength(0)
	})
	test('POST requires same-origin JSON', async () => {
		expect(
			(await POST(postRequest(POLICY_ACCEPTANCE, { origin: 'https://foreign.example' }))).status,
		).toBe(403)
		expect(
			(await POST(postRequest(POLICY_ACCEPTANCE, { 'sec-fetch-site': 'cross-site' }))).status,
		).toBe(403)
		expect(
			(await POST(postRequest(POLICY_ACCEPTANCE, { 'content-type': 'text/plain' }))).status,
		).toBe(415)
		expect(consentCalls()).toHaveLength(0)
	})
	for (const [name, status] of invalidStatuses)
		test(`GET and POST reject ${name} receipts`, async () => {
			consentUpstream = () => Response.json(status)
			expect((await GET(getRequest())).status).toBe(502)
			expect((await POST(postRequest())).status).toBe(502)
		})
	test('POST does not treat a still-stale 200 receipt as accepted', async () => {
		consentUpstream = () => Response.json(staleStatus)
		expect((await POST(postRequest())).status).toBe(502)
	})
	for (const [name, reply] of [
		['HTTP failure', () => new Response('private upstream details', { status: 503 })],
		['malformed JSON', () => new Response('{')],
		[
			'network failure',
			() => {
				throw new TypeError('private network details')
			},
		],
		[
			'timeout',
			() => {
				throw new DOMException('private timeout details', 'TimeoutError')
			},
		],
	] as const)
		test(`GET and POST hide ${name} and remain unavailable`, async () => {
			consentUpstream = reply
			for (const response of [await GET(getRequest()), await POST(postRequest())]) {
				expect(response.status).toBe(502)
				expect(await response.text()).not.toContain('private')
			}
		})
})
