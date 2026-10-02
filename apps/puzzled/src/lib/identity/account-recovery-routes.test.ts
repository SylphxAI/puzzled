import { afterAll, afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'

/**
 * The account recovery and email verification doors, with only the upstream
 * (Sylphx Auth) mocked: request path, credential, User-Agent, exact body,
 * the answers the browser sees, and the cookies.
 */

const deleted: string[] = []
let requestHeaders: Record<string, string> = {}
let cookieValues: Record<string, string> = {}

mock.module('next/headers', () => ({
	cookies: async () => ({
		get: (name: string) => (cookieValues[name] ? { value: cookieValues[name] } : undefined),
		set: () => undefined,
		delete: (name: string) => {
			deleted.push(name)
		},
	}),
	headers: async () => new Headers(requestHeaders),
}))

const { POST: startRecovery } = await import('@/app/api/identity/recovery/route')
const { POST: completeRecovery } = await import('@/app/api/identity/recovery/complete/route')
const { POST: verifyEmail } = await import('@/app/api/identity/verify-email/route')
const { POST: resendVerification } = await import('@/app/api/identity/verify-email/resend/route')
const { POST: logout } = await import('@/app/api/identity/logout/route')
const { POST: signup } = await import('@/app/api/identity/signup/route')

const originalFetch = globalThis.fetch
const envKeys = [
	'SYLPHX_AUTH_SECRET_KEY',
	'SYLPHX_AUTH_ORGANIZATION_ID',
	'SYLPHX_AUTH_URL',
	'SYLPHX_PUBLISHABLE_KEY',
	'SYLPHX_PUBLIC_URL',
] as const
const savedEnv: Record<string, string | undefined> = {}

type Call = { url: string; headers: Headers; body: Record<string, unknown> | null }
let calls: Call[] = []
let upstream: (call: Call) => Response = () => new Response('{}', { status: 200 })

function mockUpstream(handler: (call: Call) => Response) {
	upstream = handler
}

beforeEach(() => {
	for (const key of envKeys) savedEnv[key] = process.env[key]
	process.env.SYLPHX_AUTH_SECRET_KEY = 'sylphx_sk_test_secret'
	process.env.SYLPHX_AUTH_ORGANIZATION_ID = 'organization-00000000-0000-7000-8000-000000000001'
	process.env.SYLPHX_PUBLISHABLE_KEY = 'sylphx_pk_test_public'
	process.env.SYLPHX_PUBLIC_URL = 'https://puzzled.gg'
	delete process.env.SYLPHX_AUTH_URL
	calls = []
	deleted.length = 0
	cookieValues = {}
	requestHeaders = { host: 'puzzled.gg', 'user-agent': 'TestBrowser/1.0' }
	upstream = () => new Response('{}', { status: 200 })
	globalThis.fetch = (async (url: string, init?: RequestInit) => {
		const text = typeof init?.body === 'string' ? init.body : null
		const call: Call = {
			url: String(url),
			headers: new Headers(init?.headers),
			body: text ? (JSON.parse(text) as Record<string, unknown>) : null,
		}
		calls.push(call)
		return upstream(call)
	}) as typeof fetch
})

afterEach(() => {
	globalThis.fetch = originalFetch
	for (const key of envKeys) {
		if (savedEnv[key] === undefined) delete process.env[key]
		else process.env[key] = savedEnv[key]
	}
})

afterAll(() => {
	mock.restore()
})

function jsonPost(path: string, body: unknown, headers: Record<string, string> = {}) {
	return new Request(`https://puzzled.gg${path}`, {
		method: 'POST',
		headers: { 'content-type': 'application/json', ...headers },
		body: JSON.stringify(body),
	})
}

const GOOD_PASSWORD = 'a-long-new-password'

describe('forgot password (recovery start)', () => {
	test('starts recovery with the product key, the site reset URL, and no client address', async () => {
		const response = await startRecovery(
			jsonPost(
				'/api/identity/recovery',
				{ email: ' Player@Example.com ' },
				{ 'x-forwarded-for': '203.0.113.9' },
			),
		)
		expect(response.status).toBe(200)
		expect(await response.json()).toEqual({ accepted: true })
		expect(calls).toHaveLength(1)
		expect(calls[0]?.url).toBe('https://api.sylphx.com/v1/account-recovery/start')
		expect(calls[0]?.headers.get('authorization')).toBe('Bearer sylphx_sk_test_secret')
		expect(calls[0]?.headers.get('x-forwarded-for')).toBeNull()
		expect(calls[0]?.body).toEqual({
			project_id: 'organization-00000000-0000-7000-8000-000000000001',
			principal_hint: 'Player@Example.com',
			redirect_url: 'https://puzzled.gg/reset-password',
		})
	})

	test('answers the same for every address Auth accepts', async () => {
		mockUpstream((call) =>
			String(call.body?.principal_hint).startsWith('known')
				? new Response('{"accepted":true,"principal_id":"p_1"}', { status: 202 })
				: new Response('{"accepted":true}', { status: 202 }),
		)
		const known = await startRecovery(jsonPost('/api/identity/recovery', { email: 'known@x.test' }))
		const unknown = await startRecovery(
			jsonPost('/api/identity/recovery', { email: 'nobody@x.test' }),
		)
		expect(known.status).toBe(unknown.status)
		expect(await known.json()).toEqual(await unknown.json())
	})

	test('refuses a blank or malformed address without calling Auth', async () => {
		for (const email of ['', '   ', 'no-at-sign', 42, `${'a'.repeat(320)}@x.test`]) {
			const response = await startRecovery(jsonPost('/api/identity/recovery', { email }))
			expect(response.status).toBe(400)
		}
		expect(calls).toHaveLength(0)
	})

	test('passes a send limit through with Retry-After; any other failure is unavailable', async () => {
		mockUpstream(
			() =>
				new Response('{"code":"rate_limited","error":"x"}', {
					status: 429,
					headers: { 'retry-after': '30' },
				}),
		)
		const limited = await startRecovery(jsonPost('/api/identity/recovery', { email: 'a@x.test' }))
		expect(limited.status).toBe(429)
		expect(limited.headers.get('retry-after')).toBe('30')
		expect(await limited.json()).toEqual({ error: 'rate_limited' })

		for (const status of [403, 422, 500, 503]) {
			mockUpstream(() => new Response('{"code":"x","error":"a@x.test is secret"}', { status }))
			const failed = await startRecovery(jsonPost('/api/identity/recovery', { email: 'a@x.test' }))
			expect(failed.status).toBe(502)
			expect(JSON.stringify(await failed.json())).not.toContain('a@x.test')
		}
	})

	test('is unconfigured without the key, and refuses a cross-site or non-JSON post', async () => {
		delete process.env.SYLPHX_AUTH_SECRET_KEY
		const unconfigured = await startRecovery(
			jsonPost('/api/identity/recovery', { email: 'a@x.test' }),
		)
		expect(unconfigured.status).toBe(503)

		process.env.SYLPHX_AUTH_SECRET_KEY = 'sylphx_sk_test_secret'
		const crossSite = await startRecovery(
			jsonPost('/api/identity/recovery', { email: 'a@x.test' }, { origin: 'https://evil.test' }),
		)
		expect(crossSite.status).toBe(403)
		const notJson = await startRecovery(
			new Request('https://puzzled.gg/api/identity/recovery', {
				method: 'POST',
				headers: { 'content-type': 'text/plain' },
				body: '{"email":"a@x.test"}',
			}),
		)
		expect(notJson.status).toBe(415)
		expect(calls).toHaveLength(0)
	})
})

describe('reset password (recovery complete)', () => {
	const link = { challengeId: 'chal_1', secret: 'mailed-secret', password: GOOD_PASSWORD }

	test('completes with the mailed challenge and secret, clears both cookies, never signs in', async () => {
		const response = await completeRecovery(jsonPost('/api/identity/recovery/complete', link))
		expect(response.status).toBe(200)
		expect(await response.json()).toEqual({ accepted: true })
		expect(calls).toHaveLength(1)
		expect(calls[0]?.url).toBe('https://api.sylphx.com/v1/account-recovery/complete')
		expect(calls[0]?.headers.get('authorization')).toBe('Bearer sylphx_sk_test_secret')
		const { idempotency_key, ...rest } = calls[0]?.body ?? {}
		expect(typeof idempotency_key).toBe('string')
		expect(rest).toEqual({
			challenge_id: 'chal_1',
			secret: 'mailed-secret',
			step_up_grant_jws: '',
			new_password: GOOD_PASSWORD,
		})
		expect(deleted.sort()).toEqual(['puzzled_session', 'sylphx_identity_session'])
		expect(response.headers.get('set-cookie')).toBeNull()
	})

	test('does not use the token as the challenge id', async () => {
		const response = await completeRecovery(
			jsonPost('/api/identity/recovery/complete', {
				token: 'only-a-token',
				secret: 'mailed-secret',
				password: GOOD_PASSWORD,
			}),
		)
		expect(response.status).toBe(400)
		expect(await response.json()).toEqual({ error: 'reset_link_invalid' })
		expect(calls).toHaveLength(0)
	})

	test('refuses a password outside 12..1024 UTF-8 bytes before calling Auth', async () => {
		for (const password of ['short', 'x'.repeat(1025), '密'.repeat(4), undefined]) {
			const response = await completeRecovery(
				jsonPost('/api/identity/recovery/complete', { ...link, password }),
			)
			// 4 x 3 bytes = 12 bytes is allowed; everything else here is refused.
			if (password === '密'.repeat(4)) {
				expect(response.status).toBe(200)
			} else {
				expect(response.status).toBe(400)
				expect(await response.json()).toEqual({ error: 'password_rejected' })
			}
		}
		expect(calls).toHaveLength(1)
	})

	test('uses the same retry key for the same command and a new one for a new password', async () => {
		await completeRecovery(jsonPost('/api/identity/recovery/complete', link))
		await completeRecovery(jsonPost('/api/identity/recovery/complete', link))
		await completeRecovery(
			jsonPost('/api/identity/recovery/complete', { ...link, password: `${GOOD_PASSWORD}-2` }),
		)
		const keys = calls.map((call) => call.body?.idempotency_key)
		expect(keys[0]).toBe(keys[1])
		expect(keys[2]).not.toBe(keys[0])
	})

	test('maps Auth failures to fixed answers by code and status, keeps the browser signed as is', async () => {
		const run = async (status: number, body: string, headers: Record<string, string> = {}) => {
			mockUpstream(() => new Response(body, { status, headers }))
			deleted.length = 0
			const response = await completeRecovery(jsonPost('/api/identity/recovery/complete', link))
			return {
				status: response.status,
				body: await response.json(),
				response,
				cleared: deleted.length,
			}
		}
		for (const status of [401, 404, 409]) {
			const r = await run(status, '{"code":"unauthorized","error":"challenge chal_1 expired"}')
			expect(r.status).toBe(400)
			expect(r.body).toEqual({ error: 'reset_link_invalid' })
			expect(r.cleared).toBe(0)
		}
		const weak = await run(400, '{"code":"invalid_request","error":"password found in a breach"}')
		expect(weak.status).toBe(400)
		expect(weak.body).toEqual({ error: 'password_rejected' })

		const limited = await run(429, '{"code":"rate_limited"}', { 'retry-after': '12' })
		expect(limited.status).toBe(429)
		expect(limited.response.headers.get('retry-after')).toBe('12')

		for (const status of [403, 500, 503]) {
			const down = await run(status, '{"code":"store_unavailable"}')
			expect(down.status).toBe(502)
			expect(down.body).toEqual({ error: 'identity_recovery_unavailable' })
		}
	})

	test('refuses a cross-site post', async () => {
		const response = await completeRecovery(
			jsonPost('/api/identity/recovery/complete', link, { 'sec-fetch-site': 'cross-site' }),
		)
		expect(response.status).toBe(403)
		expect(calls).toHaveLength(0)
	})
})

describe('verify email', () => {
	test('confirms on the public completion door with the mailed challenge and secret, no credential', async () => {
		const response = await verifyEmail(
			jsonPost('/api/identity/verify-email', { challengeId: 'chal_v', secret: 'mailed' }),
		)
		expect(response.status).toBe(200)
		expect(await response.json()).toEqual({ verified: true })
		expect(calls[0]?.url).toBe('https://api.sylphx.com/v1/signup/email-verification/complete')
		expect(calls[0]?.headers.get('authorization')).toBeNull()
		const { idempotency_key, ...rest } = calls[0]?.body ?? {}
		expect(typeof idempotency_key).toBe('string')
		expect(rest).toEqual({ challenge_id: 'chal_v', secret: 'mailed' })
	})

	test('needs both link fields and maps refusals to a fixed answer', async () => {
		const missing = await verifyEmail(jsonPost('/api/identity/verify-email', { secret: 'mailed' }))
		expect(missing.status).toBe(400)
		expect(calls).toHaveLength(0)

		for (const status of [400, 401, 404, 409]) {
			mockUpstream(() => new Response('{"code":"unauthorized","error":"detail"}', { status }))
			const r = await verifyEmail(
				jsonPost('/api/identity/verify-email', { challengeId: 'c', secret: 's' }),
			)
			expect(r.status).toBe(400)
			expect(await r.json()).toEqual({ error: 'verification_link_invalid' })
		}
		mockUpstream(() => new Response('{}', { status: 500 }))
		const down = await verifyEmail(
			jsonPost('/api/identity/verify-email', { challengeId: 'c', secret: 's' }),
		)
		expect(down.status).toBe(502)
	})
})

describe('resend verification', () => {
	test('is refused without a session cookie and never calls Auth', async () => {
		const response = await resendVerification(
			new Request('https://puzzled.gg/api/identity/verify-email/resend', { method: 'POST' }),
		)
		expect(response.status).toBe(401)
		expect(calls).toHaveLength(0)
	})

	test('sends with the player own session bearer and browser User-Agent; names no address', async () => {
		cookieValues = { puzzled_session: 'identity_org_session_abc' }
		const response = await resendVerification(
			new Request('https://puzzled.gg/api/identity/verify-email/resend', {
				method: 'POST',
				headers: { 'user-agent': 'TestBrowser/1.0', 'content-type': 'application/json' },
				body: JSON.stringify({ email: 'someone-else@x.test' }),
			}),
		)
		expect(response.status).toBe(200)
		expect(calls[0]?.url).toBe('https://api.sylphx.com/v1/email-verification/start')
		expect(calls[0]?.headers.get('authorization')).toBe('Bearer identity_org_session_abc')
		expect(calls[0]?.headers.get('user-agent')).toBe('TestBrowser/1.0')
		const { idempotency_key, ...rest } = calls[0]?.body ?? {}
		expect(typeof idempotency_key).toBe('string')
		expect(rest).toEqual({ redirect_url: 'https://puzzled.gg/verify-email' })
	})

	test('passes a send limit through and reports other failures as unavailable', async () => {
		cookieValues = { puzzled_session: 'identity_org_session_abc' }
		const post = () =>
			resendVerification(
				new Request('https://puzzled.gg/api/identity/verify-email/resend', { method: 'POST' }),
			)
		mockUpstream(() => new Response('{}', { status: 429, headers: { 'retry-after': '30' } }))
		const limited = await post()
		expect(limited.status).toBe(429)
		expect(limited.headers.get('retry-after')).toBe('30')
		mockUpstream(() => new Response('{}', { status: 401 }))
		expect((await post()).status).toBe(502)
	})
})

describe('sign out', () => {
	test('ends the session on the supported client sign-out with own bearer and UA, then clears both cookies', async () => {
		cookieValues = { puzzled_session: 'identity_org_session_abc' }
		const response = await logout(
			new Request('https://puzzled.gg/api/identity/logout', {
				method: 'POST',
				headers: { 'user-agent': 'TestBrowser/1.0' },
			}),
		)
		expect(response.status).toBe(200)
		expect(calls).toHaveLength(1)
		expect(calls[0]?.url).toBe('https://api.sylphx.com/v1/client/sign-out')
		expect(calls[0]?.headers.get('authorization')).toBe('Bearer identity_org_session_abc')
		expect(calls[0]?.headers.get('user-agent')).toBe('TestBrowser/1.0')
		expect(deleted.sort()).toEqual(['puzzled_session', 'sylphx_identity_session'])
	})

	test('clears the cookies even when Auth refuses (an unverified account, or Auth down)', async () => {
		cookieValues = { puzzled_session: 'identity_org_session_abc' }
		mockUpstream(() => new Response('{"code":"email_unverified"}', { status: 403 }))
		const response = await logout(
			new Request('https://puzzled.gg/api/identity/logout', { method: 'POST' }),
		)
		expect(response.status).toBe(200)
		expect(deleted.sort()).toEqual(['puzzled_session', 'sylphx_identity_session'])
	})
})

describe('sign up', () => {
	test('asks Auth to mail a link that lands on the real verify-email page', async () => {
		mockUpstream((call) =>
			call.url.endsWith('/v1/client/sign-up')
				? new Response('{}', { status: 202 })
				: new Response('{"code":"unauthorized"}', { status: 401 }),
		)
		await signup(
			jsonPost('/api/identity/signup', {
				email: 'new@x.test',
				password: GOOD_PASSWORD,
				name: 'New',
			}),
		)
		expect(calls[0]?.url).toBe('https://api.sylphx.com/v1/client/sign-up')
		expect(calls[0]?.body?.redirect_url).toBe('https://puzzled.gg/verify-email')
	})
})
