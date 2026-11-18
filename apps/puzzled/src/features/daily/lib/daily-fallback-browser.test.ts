/** Passive browser fallback sends existing cookies without bootstrapping a guest or taking a pick. */
import { afterEach, expect, test } from 'bun:test'
import { create, toJson } from '@bufbuild/protobuf'
import { GetDailyResponseSchema } from '@/gen/connect/puzzled/v1/puzzle_pb'
import { createPuzzleServiceClient } from '@/lib/connect/puzzle-client'
import { resetConnectTransportCache } from '@/lib/connect/transport'
import { GUEST_DAY_ID_KEY } from '@/lib/storage-keys'
import { loadDailySnapshot } from './daily-fallback'

const CONNECT_BASE = 'https://guest-transport.test'
type BrowserGlobals = {
	window?: unknown
	localStorage?: unknown
	document?: unknown
	fetch: typeof fetch
}
const globals = globalThis as unknown as BrowserGlobals
const original = {
	window: globals.window,
	localStorage: globals.localStorage,
	document: globals.document,
	fetch: globalThis.fetch,
}
afterEach(() => {
	globals.window = original.window
	globals.localStorage = original.localStorage
	globals.document = original.document
	globalThis.fetch = original.fetch
	resetConnectTransportCache()
})

test('fallback GetDaily does not bootstrap a guest or mutate stored progress', async () => {
	resetConnectTransportCache()
	const legacyData = 'test-local-progress-reference'
	const store = new Map<string, string>([[GUEST_DAY_ID_KEY, legacyData]])
	globals.window = globalThis
	globals.localStorage = {
		getItem: (key: string) => store.get(key) ?? null,
		setItem: (key: string, value: string) => {
			store.set(key, value)
		},
	}
	globals.document = { cookie: 'puzzled_guest_id=legacy-data-only' }
	const requests: Request[] = []
	globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
		const request = new Request(input, init)
		requests.push(request)
		return new Response(
			JSON.stringify(
				toJson(
					GetDailyResponseSchema,
					create(GetDailyResponseSchema, {
						gameSlug: 'sudoku',
						puzzleDate: '2026-09-10',
						canPlay: true,
						requiresStart: true,
					}),
				),
			),
			{ headers: { 'content-type': 'application/json' } },
		)
	}) as typeof fetch

	const snapshot = await loadDailySnapshot(
		{ gameSlug: 'sudoku' },
		createPuzzleServiceClient(CONNECT_BASE),
	)
	expect(requests).toHaveLength(1)
	expect(requests[0]?.url).toBe(`${CONNECT_BASE}/puzzled.v1.PuzzleService/GetDaily`)
	expect(requests[0]?.credentials).toBe('include')
	expect(requests.every((request) => request.headers.get('x-puzzled-guest-id') === null)).toBe(true)
	expect(store.get(GUEST_DAY_ID_KEY)).toBe(legacyData)
	expect((globals.document as { cookie: string }).cookie).toBe('puzzled_guest_id=legacy-data-only')
	expect(snapshot).toMatchObject({ kind: 'startable', puzzleDate: '2026-09-10' })
})
