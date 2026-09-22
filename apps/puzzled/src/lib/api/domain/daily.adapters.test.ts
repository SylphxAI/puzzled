/**
 * TD-08: both surfaces run the same GetDaily mapping.
 *
 * - getServerDailyStatus (cache()d, lib/api/server.ts) is pinned against a
 *   Connect response fixture served over a stubbed fetch (real connect-web
 *   client path, JSON codec).
 * - fetchDailyStatusForClient / fetchTodaysPuzzleForClient (lib/api/hooks.ts)
 *   are pinned against the same fixture through the admission client.
 *
 * Mocking follows the house rule (lib/identity/react.test.ts): capture the
 * real module, spread a superset, restore in afterAll - bun module mocks live
 * for the whole test run.
 */

import { afterAll, afterEach, describe, expect, mock, test } from 'bun:test'
import { create, toJson } from '@bufbuild/protobuf'
import {
	DailyCompletionSchema,
	type GetDailyResponse,
	GetDailyResponseSchema,
} from '@/gen/connect/puzzled/v1/puzzle_pb'
import type { DailyStatus } from './daily'

const PUZZLE_ID = '6f1e2d3c-4b5a-4c7d-8e9f-0a1b2c3d4e5f'
const COMPLETED_AT_MS = Date.UTC(2026, 8, 21, 9, 30, 0)

function fixture(): GetDailyResponse {
	return create(GetDailyResponseSchema, {
		gameSlug: 'word-guess',
		puzzleNumber: 956,
		puzzleDate: '2026-09-21',
		puzzleId: PUZZLE_ID,
		difficulty: 'medium',
		hasCompleted: true,
		canPlay: false,
		mode: 'daily',
		slice: 'S2-daily-connect',
		stub: false,
		puzzleDataJson: '{"answer":"APPLE"}',
		completedSession: create(DailyCompletionSchema, {
			status: 'lost',
			score: 42,
			attempts: 6,
			completedAtMs: BigInt(COMPLETED_AT_MS),
		}),
	})
}

const EXPECTED_DAILY = {
	hasCompleted: true,
	completedSession: {
		status: 'lost',
		score: 42,
		attempts: 6,
		completedAt: new Date(COMPLETED_AT_MS),
	},
	puzzle: {
		id: PUZZLE_ID,
		puzzleNumber: 956,
		puzzleDate: '2026-09-21',
		puzzleData: { answer: 'APPLE' },
		difficulty: 'medium',
	},
	canPlay: false,
	mode: 'daily',
} satisfies DailyStatus

// --- server surface ---------------------------------------------------------

const realNextHeaders = await import('next/headers')
mock.module('next/headers', () => ({
	...realNextHeaders,
	cookies: async () => ({
		toString: () => 'puzzled_guest_id=guest-1',
		get: (name: string) => (name === 'puzzled_guest_id' ? { name, value: 'guest-1' } : undefined),
		getAll: () => [{ name: 'puzzled_guest_id', value: 'guest-1' }],
	}),
}))

const ENV_KEY = 'API_INTERNAL_URL'
const previousInternalUrl = process.env[ENV_KEY]
process.env[ENV_KEY] = 'http://api.internal.test'

const realFetch = globalThis.fetch
const requests: { url: string; body: string; cookie: string }[] = []
afterEach(() => {
	globalThis.fetch = realFetch
	requests.length = 0
})

function bodyText(body: RequestInit['body']): string {
	if (typeof body === 'string') return body
	if (body instanceof Uint8Array) return new TextDecoder().decode(body)
	if (body instanceof ArrayBuffer) return new TextDecoder().decode(new Uint8Array(body))
	return ''
}

function stubConnectFetch(response: GetDailyResponse) {
	globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
		requests.push({
			url: String(input),
			body: bodyText(init?.body),
			cookie: new Headers(init?.headers).get('cookie') ?? '',
		})
		return new Response(JSON.stringify(toJson(GetDailyResponseSchema, response)), {
			status: 200,
			headers: { 'content-type': 'application/json' },
		})
	}) as typeof fetch
}

const { getServerDailyStatus, getServerTodaysPuzzle } = await import('@/lib/api/server')

describe('getServerDailyStatus against a Connect fixture', () => {
	test('maps the fixture to the pinned DailyStatus (server cache()d accessor)', async () => {
		stubConnectFetch(fixture())
		const out = await getServerDailyStatus({ gameSlug: 'word-guess', difficulty: 'easy' })
		expect(out).toEqual(EXPECTED_DAILY)
		expect(requests.length).toBe(1)
		expect(requests[0].url.endsWith('/puzzled.v1.PuzzleService/GetDaily')).toBe(true)
		expect(JSON.parse(requests[0].body)).toEqual({
			gameSlug: 'word-guess',
			difficulty: 'easy',
		})
		expect(requests[0].cookie).toBe('puzzled_guest_id=guest-1')
	})

	test('difficulty empty on the wire falls back to the request difficulty', async () => {
		const res = fixture()
		res.difficulty = ''
		stubConnectFetch(res)
		const out = await getServerDailyStatus({ gameSlug: 'sudoku', difficulty: 'hard' })
		expect(out.puzzle.difficulty).toBe('hard')
	})
})

describe('getServerTodaysPuzzle against the same fixture', () => {
	test('maps the fixture to the pinned TodaysPuzzle', async () => {
		stubConnectFetch(fixture())
		const out = await getServerTodaysPuzzle({ gameSlug: 'word-guess' })
		expect(out).toEqual({
			puzzleId: PUZZLE_ID,
			puzzleNumber: 956,
			puzzleDate: '2026-09-21',
			puzzleData: { answer: 'APPLE' },
			difficulty: 'medium',
		})
	})
})

// --- client surface ---------------------------------------------------------

const realAdmission = await import('@/lib/connect/puzzle-admission')
let admitOk = true
let admitResponse = fixture()
mock.module('@/lib/connect/puzzle-admission', () => ({
	...realAdmission,
	admitGetDailyViaConnect: async () =>
		admitOk
			? { mode: 'connect' as const, ok: true as const, response: admitResponse, failClosed: true }
			: {
					mode: 'connect' as const,
					ok: false as const,
					error: 'connect_offline',
					failClosed: true,
				},
}))

const { fetchDailyStatusForClient, fetchTodaysPuzzleForClient, ApiError } = await import(
	'@/lib/api/hooks'
)

describe('client surface runs the same mapper over the same fixture', () => {
	test('fetchDailyStatusForClient equals the server mapping plus adapter fields', async () => {
		admitOk = true
		admitResponse = fixture()
		const out = await fetchDailyStatusForClient({ gameSlug: 'word-guess', difficulty: 'easy' })
		expect(out).toEqual({
			...EXPECTED_DAILY,
			slice: 'S2-daily-connect',
			authority: 'connect' as const,
		})
	})

	test('fetchTodaysPuzzleForClient pins the puzzle projection plus adapter fields', async () => {
		admitOk = true
		admitResponse = fixture()
		const out = await fetchTodaysPuzzleForClient({ gameSlug: 'word-guess' })
		expect(out).toEqual({
			puzzleId: PUZZLE_ID,
			puzzleNumber: 956,
			puzzleDate: '2026-09-21',
			puzzleData: { answer: 'APPLE' },
			difficulty: 'medium',
			slice: 'S2-daily-connect',
			stub: false,
			authority: 'connect',
		})
	})

	test('admission failure keeps the fail-closed ApiError surface', async () => {
		admitOk = false
		await expect(fetchDailyStatusForClient({ gameSlug: 'word-guess' })).rejects.toThrow(ApiError)
		await expect(fetchDailyStatusForClient({ gameSlug: 'word-guess' })).rejects.toThrow(
			'connect_offline',
		)
	})
})

afterAll(() => {
	globalThis.fetch = realFetch
	if (previousInternalUrl === undefined) {
		delete process.env[ENV_KEY]
	} else {
		process.env[ENV_KEY] = previousInternalUrl
	}
	mock.module('next/headers', () => realNextHeaders)
	mock.module('@/lib/connect/puzzle-admission', () => realAdmission)
})
