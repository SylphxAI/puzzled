import { beforeEach, describe, expect, mock, test } from 'bun:test'

let user: { id: string } | null = { id: 'viewer / local' }
let calls: {
	path: string
	init: { method?: string; body?: unknown; headers?: Record<string, string> }
}[] = []
let pages: unknown[] = []
mock.module('@/lib/identity/server', () => ({ currentUser: async () => user }))
mock.module('@/lib/identity/peels', () => ({
	destEventsJson: async (path: string, init: (typeof calls)[number]['init']) => {
		calls.push({ path, init })
		const response = pages.shift()
		if (response instanceof Error) throw response
		return response ?? {}
	},
}))
const { GET, POST } = await import('./route')
const owned = {
	device_id: 'own-device',
	user_id: 'viewer / local',
	platform: 'DEVICE_PLATFORM_WEB_PUSH',
}
const foreign = { ...owned, device_id: 'foreign-device', user_id: 'other' }
const page = (devices: unknown[], next = '') => ({
	devices,
	page: { has_more: Boolean(next), next_cursor: next },
})
const post = (body: unknown) =>
	new Request('https://puzzled.test/api/events/devices', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(body),
	})

beforeEach(() => {
	user = { id: owned.user_id }
	calls = []
	pages = []
})

describe('verified viewer device adapter', () => {
	test('unauthenticated list and write return 401 without upstream calls', async () => {
		user = null
		expect((await GET()).status).toBe(401)
		expect((await POST(post({ unregister: true, deviceId: owned.device_id }))).status).toBe(401)
		expect(calls).toHaveLength(0)
	})

	test('list is user scoped and filters unexpected foreign results', async () => {
		pages = [page([owned, foreign])]
		const response = await GET()
		expect(await response.json()).toEqual({ devices: [owned] })
		const url = new URL(calls[0]!.path, 'https://events.test')
		expect(url.searchParams.get('user_id')).toBe(owned.user_id)
		expect(url.searchParams.get('limit')).toBe('100')
	})

	test('only owned web-push device is unregistered, with identical UUIDv7 header/body', async () => {
		pages = [page([owned]), {}]
		expect((await POST(post({ unregister: true, deviceId: owned.device_id }))).status).toBe(200)
		expect(calls).toHaveLength(2)
		expect(new URL(calls[0]!.path, 'https://events.test').searchParams.get('platform')).toBe(
			'DEVICE_PLATFORM_WEB_PUSH',
		)
		const removal = calls[1]!
		expect(removal.path).toBe('/v1/devices/own-device/unregister')
		const key = removal.init.headers?.['Idempotency-Key']
		expect(key).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
		expect(removal.init.body).toEqual({ idempotency_key: key, device_id: owned.device_id })
	})

	for (const devices of [[foreign], [], [{ ...owned, platform: 'DEVICE_PLATFORM_FCM' }]]) {
		test(`unknown or non-owned device returns the same 404 with no removal`, async () => {
			pages = [page(devices)]
			const response = await POST(
				post({ unregister: true, deviceId: devices[0]?.device_id ?? 'missing' }),
			)
			expect(response.status).toBe(404)
			expect(await response.json()).toEqual({ error: 'device_not_found' })
			expect(calls).toHaveLength(1)
		})
	}

	test('owned second page follows only the user-scoped cursor', async () => {
		pages = [page([foreign], 'page / two'), page([owned]), {}]
		expect((await POST(post({ unregister: true, deviceId: owned.device_id }))).status).toBe(200)
		const next = new URL(calls[1]!.path, 'https://events.test')
		expect(next.searchParams.get('user_id')).toBe(owned.user_id)
		expect(next.searchParams.get('cursor')).toBe('page / two')
	})

	test('upstream failure, looping cursor and bounded exhaustion are unavailable, not not-found', async () => {
		for (const responses of [
			[new Error('offline')],
			[page([], 'same'), page([], 'same')],
			Array.from({ length: 10 }, (_, i) => page([], `page${i}`)),
		]) {
			calls = []
			pages = responses
			const response = await POST(post({ unregister: true, deviceId: 'missing' }))
			expect(response.status).toBe(502)
			expect(calls.every((call) => call.init.method === 'GET')).toBe(true)
			expect(calls.length).toBeLessThanOrEqual(10)
		}
	})

	test('invalid device id is rejected before listing', async () => {
		for (const deviceId of ['', 'x'.repeat(129), 123]) {
			expect((await POST(post({ unregister: true, deviceId }))).status).toBe(400)
		}
		expect(calls).toHaveLength(0)
	})

	test('registration binds verified user and shares one server operation key', async () => {
		pages = [{ device: owned }]
		expect((await POST(post({ token: 'test-token-material', user_id: 'other' }))).status).toBe(200)
		const body = calls[0]!.init.body as { idempotency_key: string; device: { user_id: string } }
		expect(body.device.user_id).toBe(owned.user_id)
		expect(calls[0]!.init.headers?.['Idempotency-Key']).toBe(body.idempotency_key)
	})
})
