import { afterEach, describe, expect, test } from 'bun:test'
import { destIdentityJson } from './dest'

const originalFetch = globalThis.fetch

describe('Identity dest login and recovery doors', () => {
	afterEach(() => {
		globalThis.fetch = originalFetch
	})

	test('login begin/complete uses Identity product credential, not Binding', async () => {
		const calls: Array<[string, RequestInit]> = []
		globalThis.fetch = (async (url: string, init?: RequestInit) => {
			calls.push([url, init ?? {}])
			const path = String(url)
			const body = path.endsWith('/begin')
				? { challenge: { challenge_id: 'challenge-a' } }
				: { session: { access_token: 'identity_org_session_a' } }
			return { ok: true, status: 200, text: async () => JSON.stringify(body) } as Response
		}) as typeof fetch

		await destIdentityJson('https://identity.test', '/v1/authentication/begin', {
			method: 'POST',
			credential: 'identity_org_key_puzzled',
			body: {
				project_id: 'project-puzzled',
				principal_hint: 'a@example.com',
				purpose: 'login',
				device: { device_id: 'puzzled-web', display_name: 'Puzzled', user_agent: 'test' },
			},
		})
		await destIdentityJson('https://identity.test', '/v1/authentication/complete', {
			method: 'POST',
			credential: 'identity_org_key_puzzled',
			body: {
				idempotency_key: 'idem-a',
				challenge_id: 'challenge-a',
				factor_proofs: [{ factor_type: 'password', factor_id: '', response: 'correct-horse' }],
			},
		})
		expect(calls.map(([url]) => url)).toEqual([
			'https://identity.test/v1/authentication/begin',
			'https://identity.test/v1/authentication/complete',
		])
		for (const [, init] of calls) {
			const headers = init.headers as Record<string, string>
			expect(headers.Authorization).toBe('Bearer identity_org_key_puzzled')
			expect(Object.keys(headers).some((name) => name.toLowerCase().includes('binding'))).toBe(
				false,
			)
		}
	})

	test('recovery posts dest /v1/account-recovery/start with product credential', async () => {
		const calls: Array<[string, RequestInit]> = []
		globalThis.fetch = (async (url: string, init?: RequestInit) => {
			calls.push([url, init ?? {}])
			return { ok: true, status: 200, text: async () => '{"accepted":true}' } as Response
		}) as typeof fetch
		await destIdentityJson('https://identity.test', '/v1/account-recovery/start', {
			method: 'POST',
			credential: 'identity_org_key_puzzled',
			body: { project_id: 'project-puzzled', principal_hint: 'a@example.com' },
		})
		expect(calls[0]?.[0]).toBe('https://identity.test/v1/account-recovery/start')
		expect(JSON.parse(String(calls[0]?.[1].body))).toEqual({
			project_id: 'project-puzzled',
			principal_hint: 'a@example.com',
		})
	})

	test('signup posts dest /v1/signup', async () => {
		const calls: Array<[string, RequestInit]> = []
		globalThis.fetch = (async (url: string, init?: RequestInit) => {
			calls.push([url, init ?? {}])
			return {
				ok: true,
				status: 200,
				text: async () => JSON.stringify({ session: { access_token: 'identity_org_session_b' } }),
			} as Response
		}) as typeof fetch
		await destIdentityJson('https://identity.test', '/v1/signup', {
			method: 'POST',
			body: {
				idempotency_key: 'idem-b',
				email: 'b@example.com',
				password: 'correct-horse-battery',
				display_name: 'Bee',
				organization_name: 'Puzzled',
				captcha_token: '',
			},
		})
		expect(calls[0]?.[0]).toBe('https://identity.test/v1/signup')
		expect((calls[0]?.[1].headers as Record<string, string>).Authorization).toBeUndefined()
	})
})
