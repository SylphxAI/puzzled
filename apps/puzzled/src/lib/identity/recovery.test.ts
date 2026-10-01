import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { POST } from '../../app/api/identity/recovery/complete/route'

const originalFetch = globalThis.fetch
const names = ['SYLPHX_AUTH_URL', 'SYLPHX_AUTH_SECRET_KEY', 'SYLPHX_AUTH_ORGANIZATION_ID'] as const
const originalEnv = Object.fromEntries(names.map((name) => [name, process.env[name]]))

function recovery(body: unknown) {
	return POST(
		new Request('https://puzzled.test/api/identity/recovery/complete', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body),
		}),
	)
}

describe('existing password recovery completion route', () => {
	beforeEach(() => {
		process.env.SYLPHX_AUTH_URL = 'https://identity.test'
		process.env.SYLPHX_AUTH_SECRET_KEY = 'identity_org_key_fixture'
		process.env.SYLPHX_AUTH_ORGANIZATION_ID = 'organization-fixture'
	})

	afterEach(() => {
		globalThis.fetch = originalFetch
		for (const name of names) {
			if (originalEnv[name] === undefined) delete process.env[name]
			else process.env[name] = originalEnv[name]
		}
	})

	test('forwards the email challenge identifier separately from its secret', async () => {
		const calls: Array<{ url: string; init?: RequestInit }> = []
		globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
			calls.push({ url: String(url), init })
			return new Response('{}', { status: 200 })
		}) as unknown as typeof fetch

		const response = await recovery({
			challengeId: 'challenge-fixture',
			secret: 'proof-fixture',
			password: 'new-password-fixture',
		})
		expect(response.status).toBe(200)
		expect(await response.json()).toEqual({ accepted: true })
		expect(calls).toHaveLength(1)
		expect(calls[0]?.url).toBe('https://identity.test/v1/account-recovery/complete')
		expect(calls[0]?.init?.method).toBe('POST')
		expect((calls[0]?.init?.headers as Record<string, string>).Authorization).toBe(
			'Bearer identity_org_key_fixture',
		)
		const body = JSON.parse(String(calls[0]?.init?.body))
		expect(body.idempotency_key).toMatch(/^[0-9a-f-]{36}$/)
		expect(body).toEqual({
			idempotency_key: body.idempotency_key,
			challenge_id: 'challenge-fixture',
			secret: 'proof-fixture',
			step_up_grant_jws: '',
			new_password: 'new-password-fixture',
		})
	})

	test('missing, blank or wrong-type fields refuse locally without calling Auth', async () => {
		let calls = 0
		globalThis.fetch = (async () => {
			calls++
			throw new Error('unexpected network call')
		}) as unknown as typeof fetch
		for (const body of [
			{ secret: 'proof-fixture', password: 'new-password-fixture' },
			{ challengeId: 'challenge-fixture', password: 'new-password-fixture' },
			{ challengeId: 'challenge-fixture', secret: 'proof-fixture' },
			{
				token: 'proof-fixture',
				secret: 'proof-fixture',
				password: 'new-password-fixture',
			},
			{
				challengeId: ' ',
				secret: 'proof-fixture',
				password: 'new-password-fixture',
			},
			{
				challengeId: 'challenge-fixture',
				secret: ' ',
				password: 'new-password-fixture',
			},
			{
				challengeId: 123,
				secret: 'proof-fixture',
				password: 'new-password-fixture',
			},
			{
				challengeId: 'challenge-fixture',
				secret: {},
				password: 'new-password-fixture',
			},
			{
				challengeId: 'challenge-fixture',
				secret: 'proof-fixture',
				password: [],
			},
			null,
		]) {
			const response = await recovery(body)
			expect(response.status).toBe(400)
			expect(await response.json()).toEqual({ error: 'invalid_recovery' })
		}
		expect(calls).toBe(0)
	})

	for (const reason of ['wrong_secret', 'challenge_expired', 'challenge_already_used']) {
		test(`Auth ${reason} never becomes accepted recovery`, async () => {
			globalThis.fetch = (async () =>
				new Response(JSON.stringify({ error: reason }), {
					status: 401,
				})) as unknown as typeof fetch
			const response = await recovery({
				challenge_id: 'challenge-fixture',
				secret: 'proof-fixture',
				password: 'new-password-fixture',
			})
			expect(response.status).toBe(401)
			expect(await response.json()).toEqual({ error: 'identity_rejected' })
		})
	}
})
