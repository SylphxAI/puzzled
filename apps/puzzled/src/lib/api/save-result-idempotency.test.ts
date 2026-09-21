/**
 * TD-19: the ritual-finish submit carries one idempotency key per intent.
 *
 * The retry is mocked the way react-query performs it: the mutation function is
 * re-invoked with the SAME variables (lib/api/provider.tsx `mutations.retry = 1`).
 * The first attempt here fails at the network layer; the retry must present the
 * same key — and a second intent must mint a new one. The duplicate path pins
 * the existing unique-violation → already_played → accepted mapping.
 */
import { afterEach, describe, expect, test } from 'bun:test'
import { IDEMPOTENCY_KEY_HEADER, withIdempotencyKey } from '@/lib/idempotency-key'
import { submitSaveResult } from './hooks'

const originalFetch = globalThis.fetch
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type Captured = { url: string; headers: Headers; body: string }

/** connect-web sends the JSON body as bytes; decode so assertions read text. */
function decodeBody(body: BodyInit | null | undefined): string {
	if (typeof body === 'string') return body
	if (body instanceof Uint8Array) return new TextDecoder().decode(body)
	return body ? String(body) : ''
}

/** Stub fetch; a null plan entry rejects like a request that never answered. */
function installFetch(plan: Array<Response | null>) {
	const captured: Captured[] = []
	let call = 0
	globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
		captured.push({
			url: String(input),
			headers: new Headers(init?.headers),
			body: decodeBody(init?.body),
		})
		const next = plan[Math.min(call, plan.length - 1)]
		call += 1
		if (!next) throw new TypeError('fetch failed')
		return next
	}) as typeof fetch
	return captured
}

function accepted(score: number): Response {
	return new Response(
		JSON.stringify({
			valid: true,
			status: 'won',
			score,
			gameSlug: 'sudoku',
			slice: 'S2-puzzle-solution-connect',
		}),
		{ status: 200, headers: { 'content-type': 'application/json' } },
	)
}

function alreadyPlayed(): Response {
	return new Response(JSON.stringify({ code: 'already_exists', message: 'already_played' }), {
		status: 409,
		headers: { 'content-type': 'application/json' },
	})
}

const INTENT = {
	gameSlug: 'sudoku',
	status: 'won' as const,
	attempts: 1,
	timeSpentMs: 42_000,
	data: { finalGrid: [[1]] },
}

afterEach(() => {
	globalThis.fetch = originalFetch
})

describe('submitSaveResult idempotency (TD-19)', () => {
	test('mocked retry re-sends the same key; a later intent mints a new one', async () => {
		const captured = installFetch([null, accepted(120), accepted(90)])
		const firstIntent = withIdempotencyKey(INTENT)

		await expect(submitSaveResult(firstIntent)).rejects.toThrow()
		const retried = await submitSaveResult(firstIntent)
		expect(retried.success).toBe(true)
		expect(retried.score).toBe(120)

		const next = await submitSaveResult(withIdempotencyKey({ ...INTENT, attempts: 2 }))
		expect(next.score).toBe(90)

		expect(captured.length).toBe(3)
		expect(captured[1].url).toContain('SubmitGuess')
		const retryKey = captured[0].headers.get(IDEMPOTENCY_KEY_HEADER)
		expect(retryKey).toMatch(UUID_RE)
		expect(captured[1].headers.get(IDEMPOTENCY_KEY_HEADER)).toBe(retryKey)
		expect(captured[2].headers.get(IDEMPOTENCY_KEY_HEADER)).not.toBe(retryKey)
		expect(captured[1].body).toContain('sudoku')
	})

	test('an already_played duplicate is accepted and still carries the key', async () => {
		const captured = installFetch([alreadyPlayed()])
		const intent = withIdempotencyKey(INTENT)

		const result = await submitSaveResult(intent)
		expect(result.success).toBe(true)
		expect(result.error).toBe('already_played')
		expect(captured[0].headers.get(IDEMPOTENCY_KEY_HEADER)).toBe(intent.idempotencyKey)
	})
})
