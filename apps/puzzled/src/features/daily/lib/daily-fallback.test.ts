import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { create, toJson } from '@bufbuild/protobuf'
import { DailyCompletionSchema, GetDailyResponseSchema } from '@/gen/connect/puzzled/v1/puzzle_pb'
import { createPuzzleServiceClient } from '@/lib/connect/puzzle-client'
import { resetConnectTransportCache } from '@/lib/connect/transport'
import {
	classifyDailyResponse,
	dailyLoadReducer,
	initialDailyLoadState,
	loadDailySnapshot,
} from './daily-fallback'

const CONNECT_BASE = 'https://connect.test'

const playableResponse = () =>
	create(GetDailyResponseSchema, {
		gameSlug: 'sudoku',
		puzzleNumber: 12,
		puzzleDate: '2026-09-10',
		difficulty: 'easy',
		hasCompleted: false,
		canPlay: true,
		mode: 'daily',
		slice: 'daily',
		stub: false,
		puzzleDataJson: JSON.stringify({ grid: [1, 2, 3] }),
	})

const connectJson = (body: unknown) =>
	new Response(JSON.stringify(body), {
		status: 200,
		headers: { 'content-type': 'application/json' },
	})

type FetchCall = {
	url: string
	method: string
	body: string | null
	contentType: string | null
}

const realFetch = globalThis.fetch
let calls: FetchCall[] = []

function stubConnectFetch(handler: (call: FetchCall) => Response | Promise<Response>) {
	globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
		const url =
			typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
		const rawBody = init?.body
		const call: FetchCall = {
			url,
			method: init?.method ?? 'GET',
			body:
				typeof rawBody === 'string'
					? rawBody
					: rawBody instanceof Uint8Array
						? new TextDecoder().decode(rawBody)
						: null,
			contentType: new Headers(init?.headers).get('content-type'),
		}
		calls.push(call)
		return handler(call)
	}) as typeof fetch
}

describe('daily snapshot classification', () => {
	test('a served board is playable with the server day key', () => {
		expect(classifyDailyResponse(playableResponse())).toEqual({
			kind: 'playable',
			puzzleId: '',
			puzzleData: { grid: [1, 2, 3] },
			puzzleDate: '2026-09-10',
		})
	})

	test('a served puzzle id is carried through; synthetic numbers are dropped', () => {
		const served = create(GetDailyResponseSchema, {
			...playableResponse(),
			puzzleId: '3f1c2a1e-1111-4222-8333-444455556666',
		})
		expect(classifyDailyResponse(served)).toMatchObject({
			kind: 'playable',
			puzzleId: '3f1c2a1e-1111-4222-8333-444455556666',
		})
	})

	test('a server-accepted finish is never playable, even with a served board', () => {
		const completed = create(GetDailyResponseSchema, {
			...playableResponse(),
			hasCompleted: true,
			canPlay: false,
			completedSession: create(DailyCompletionSchema, {
				status: 'won',
				score: 500,
				attempts: 3,
				completedAtMs: BigInt(1757500000000),
			}),
		})

		expect(classifyDailyResponse(completed)).toEqual({
			kind: 'completed',
			puzzleDate: '2026-09-10',
			session: {
				status: 'won',
				score: 500,
				attempts: 3,
				completedAt: new Date(1757500000000),
			},
		})
	})

	test('a finish without a result payload stays closed and unplayed', () => {
		const completed = create(GetDailyResponseSchema, {
			...playableResponse(),
			hasCompleted: true,
			canPlay: false,
		})

		expect(classifyDailyResponse(completed)).toEqual({
			kind: 'closed',
			puzzleDate: '2026-09-10',
		})
	})

	test('an incomplete session payload is not invented into a result', () => {
		const completed = create(GetDailyResponseSchema, {
			...playableResponse(),
			hasCompleted: true,
			canPlay: false,
			completedSession: create(DailyCompletionSchema, { status: 'pending' }),
		})

		expect(classifyDailyResponse(completed)).toEqual({
			kind: 'closed',
			puzzleDate: '2026-09-10',
		})
	})

	test('an empty or unparsable board is unavailable, never playable', () => {
		expect(
			classifyDailyResponse(
				create(GetDailyResponseSchema, { ...playableResponse(), puzzleDataJson: '' }),
			),
		).toEqual({ kind: 'unavailable' })
		expect(
			classifyDailyResponse(
				create(GetDailyResponseSchema, { ...playableResponse(), puzzleDataJson: '{oops' }),
			),
		).toEqual({ kind: 'unavailable' })
	})
})

describe('daily load fallback', () => {
	beforeEach(() => {
		resetConnectTransportCache()
		calls = []
	})

	afterEach(() => {
		globalThis.fetch = realFetch
		resetConnectTransportCache()
	})

	test('reads GetDaily over the browser transport and renders the served board', async () => {
		stubConnectFetch(() => connectJson(toJson(GetDailyResponseSchema, playableResponse())))

		const snapshot = await loadDailySnapshot(
			{ gameSlug: 'sudoku', difficulty: 'easy' },
			createPuzzleServiceClient(CONNECT_BASE),
		)

		expect(calls).toHaveLength(1)
		expect(calls[0]?.url).toBe(`${CONNECT_BASE}/puzzled.v1.PuzzleService/GetDaily`)
		expect(calls[0]?.method).toBe('POST')
		// ProtoJSON over Connect: the browser default documented in transport.ts.
		expect(calls[0]?.contentType).toContain('application/json')
		expect(JSON.parse(calls[0]?.body ?? '{}')).toMatchObject({
			gameSlug: 'sudoku',
			difficulty: 'easy',
		})
		expect(snapshot).toMatchObject({ kind: 'playable', puzzleDate: '2026-09-10' })
	})

	test('a failed client fetch is an honest retry state, not a fake board', async () => {
		stubConnectFetch(() => {
			throw new TypeError('Failed to fetch')
		})

		// Same try/catch shape the fallback component uses.
		let state = initialDailyLoadState
		try {
			const snapshot = await loadDailySnapshot(
				{ gameSlug: 'sudoku' },
				createPuzzleServiceClient(CONNECT_BASE),
			)
			state = dailyLoadReducer(state, { type: 'load-succeeded', snapshot })
		} catch {
			state = dailyLoadReducer(state, { type: 'load-failed' })
		}
		expect(state).toEqual({ status: 'error' })

		// The retry action is client-side: it re-runs the fetch, no hard navigation.
		state = dailyLoadReducer(state, { type: 'retry' })
		expect(state).toEqual({ status: 'loading' })

		stubConnectFetch(() => connectJson(toJson(GetDailyResponseSchema, playableResponse())))
		const snapshot = await loadDailySnapshot(
			{ gameSlug: 'sudoku' },
			createPuzzleServiceClient(CONNECT_BASE),
		)
		state = dailyLoadReducer(state, { type: 'load-succeeded', snapshot })

		expect(state).toMatchObject({ status: 'ready', snapshot: { kind: 'playable' } })
		expect(calls).toHaveLength(2)
	})

	test('a premium gate is a denied snapshot, not a retry loop', async () => {
		stubConnectFetch(
			() =>
				new Response(JSON.stringify({ code: 'permission_denied', message: 'premium_required' }), {
					status: 403,
					headers: { 'content-type': 'application/json' },
				}),
		)

		const snapshot = await loadDailySnapshot(
			{ gameSlug: 'crossword' },
			createPuzzleServiceClient(CONNECT_BASE),
		)

		expect(snapshot).toEqual({ kind: 'denied' })

		const state = dailyLoadReducer(initialDailyLoadState, { type: 'load-succeeded', snapshot })
		expect(state).toEqual({ status: 'ready', snapshot: { kind: 'denied' } })
	})

	test('a non-permission failure is still a retry state, not a denied gate', async () => {
		stubConnectFetch(
			() =>
				new Response(JSON.stringify({ code: 'internal', message: 'boom' }), {
					status: 500,
					headers: { 'content-type': 'application/json' },
				}),
		)

		await expect(
			loadDailySnapshot({ gameSlug: 'crossword' }, createPuzzleServiceClient(CONNECT_BASE)),
		).rejects.toThrow()
	})

	test('a server-accepted finish reached by the fallback is rendered as completed', async () => {
		stubConnectFetch(() =>
			connectJson(
				toJson(
					GetDailyResponseSchema,
					create(GetDailyResponseSchema, {
						...playableResponse(),
						hasCompleted: true,
						canPlay: false,
						completedSession: create(DailyCompletionSchema, {
							status: 'lost',
							attempts: 4,
							completedAtMs: BigInt(1757500000000),
						}),
					}),
				),
			),
		)

		const snapshot = await loadDailySnapshot(
			{ gameSlug: 'sudoku', difficulty: 'easy' },
			createPuzzleServiceClient(CONNECT_BASE),
		)
		const state = dailyLoadReducer(initialDailyLoadState, { type: 'load-succeeded', snapshot })

		expect(state).toMatchObject({
			status: 'ready',
			snapshot: {
				kind: 'completed',
				session: { status: 'lost', attempts: 4, completedAt: new Date(1757500000000) },
			},
		})
	})
})
