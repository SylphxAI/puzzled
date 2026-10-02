import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'

// Production repro (guest with an issued cookie and no finished game yet): the
// api answers every personal read 401 `identity_required_for_submit` because
// the player row is only issued on the first finished write (#325). The stats
// page must read that as an empty record, not as "Your stats did not load".
mock.module('next/headers', () => ({
	cookies: async () => ({
		get: (name: string) =>
			name === '__Host-puzzled_guest' ? { name, value: 'issued-guest-cookie' } : undefined,
		getAll: () => [{ name: '__Host-puzzled_guest', value: 'issued-guest-cookie' }],
	}),
	headers: async () => new Headers({ 'user-agent': 'browser-test-agent' }),
}))
const { getServerHistory, getServerStreakInfo, getServerUserStats, hasServerProgressIdentity } =
	await import('./server')
const { isNoIdentityRejection } = await import('./no-identity')
const originalFetch = globalThis.fetch
const originalBase = process.env.API_INTERNAL_URL

function respond(status: number, body: unknown): typeof fetch {
	return (async () =>
		new Response(JSON.stringify(body), {
			status,
			headers: { 'content-type': 'application/json' },
		})) as unknown as typeof fetch
}

beforeEach(() => {
	process.env.API_INTERNAL_URL = 'https://api.test'
})
afterEach(() => {
	globalThis.fetch = originalFetch
	if (originalBase === undefined) delete process.env.API_INTERNAL_URL
	else process.env.API_INTERNAL_URL = originalBase
})

describe('guest with an issued cookie and no finished game', () => {
	test('the personal reads reject as no-identity, which the stats page treats as empty', async () => {
		globalThis.fetch = respond(401, {
			code: 'unauthenticated',
			message: 'identity_required_for_submit',
		})
		expect(await hasServerProgressIdentity()).toBe(true)
		const settled = await Promise.allSettled([
			getServerUserStats(),
			getServerHistory({ limit: 100 }),
			getServerStreakInfo(),
		])
		expect(settled.map((result) => result.status)).toEqual(['rejected', 'rejected', 'rejected'])
		expect(settled.map(isNoIdentityRejection)).toEqual([true, true, true])
	})

	test('a real server failure is still a failed read', async () => {
		globalThis.fetch = respond(500, { code: 'internal', message: 'user_stats_read_failed' })
		const [result] = await Promise.allSettled([getServerUserStats()])
		expect(result?.status).toBe('rejected')
		expect(isNoIdentityRejection(result as PromiseSettledResult<unknown>)).toBe(false)
	})

	test('a fulfilled read is never a no-identity rejection', () => {
		expect(isNoIdentityRejection({ status: 'fulfilled', value: {} })).toBe(false)
	})
})
