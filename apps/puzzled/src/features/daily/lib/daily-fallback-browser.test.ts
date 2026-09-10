/**
 * Browser-transport behaviour of the game-page GetDaily fallback: the read must
 * carry the stable guest-day id (X-Puzzled-Guest-Id) so a guest's completion is
 * resolved by the server exactly like the SSR path does.
 */

import { afterEach, expect, test } from 'bun:test'
import { create, toJson } from '@bufbuild/protobuf'
import { GetDailyResponseSchema } from '@/gen/connect/puzzled/v1/puzzle_pb'
import { createPuzzleServiceClient } from '@/lib/connect/puzzle-client'
import { resetConnectTransportCache } from '@/lib/connect/transport'
import { GUEST_DAY_ID_KEY } from '@/lib/storage-keys'
import { loadDailySnapshot } from './daily-fallback'

const CONNECT_BASE = 'https://guest-transport.test'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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

test('the fallback GetDaily carries the persisted guest-day id', async () => {
	const store = new Map<string, string>()
	globals.window = globalThis
	globals.localStorage = {
		getItem: (key: string) => store.get(key) ?? null,
		setItem: (key: string, value: string) => {
			store.set(key, value)
		},
	}
	globals.document = { cookie: '' }

	const sentHeaders: Headers[] = []
	globalThis.fetch = ((_input: RequestInfo | URL, init?: RequestInit) => {
		sentHeaders.push(new Headers(init?.headers))
		return new Response(
			JSON.stringify(
				toJson(
					GetDailyResponseSchema,
					create(GetDailyResponseSchema, {
						gameSlug: 'sudoku',
						puzzleDate: '2026-09-10',
						canPlay: true,
						puzzleDataJson: JSON.stringify({ grid: [1, 2, 3] }),
					}),
				),
			),
			{ status: 200, headers: { 'content-type': 'application/json' } },
		)
	}) as unknown as typeof fetch

	const snapshot = await loadDailySnapshot(
		{ gameSlug: 'sudoku' },
		createPuzzleServiceClient(CONNECT_BASE),
	)

	const guestId = sentHeaders[0]?.get('x-puzzled-guest-id')
	expect(guestId).toBeString()
	expect(UUID_RE.test(String(guestId))).toBe(true)
	// The same id is persisted so a later SSR read resolves the same guest.
	expect(store.get(GUEST_DAY_ID_KEY)).toBe(String(guestId))
	expect(snapshot).toMatchObject({ kind: 'playable', puzzleDate: '2026-09-10' })
})
