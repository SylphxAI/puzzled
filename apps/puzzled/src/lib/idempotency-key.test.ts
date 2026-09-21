import { describe, expect, test } from 'bun:test'
import {
	IDEMPOTENCY_KEY_HEADER,
	isIdempotencyKey,
	mintIdempotencyKey,
	withIdempotencyKey,
} from './idempotency-key'

describe('mintIdempotencyKey', () => {
	test('mints UUID-shaped keys', () => {
		expect(isIdempotencyKey(mintIdempotencyKey())).toBe(true)
	})

	test('mints a fresh key per call', () => {
		expect(mintIdempotencyKey()).not.toBe(mintIdempotencyKey())
	})
})

describe('withIdempotencyKey', () => {
	test('stamps once and keeps the key when the same intent is re-issued (retry reuse)', () => {
		const intent = { gameSlug: 'sudoku', status: 'won' as const }
		const stamped = withIdempotencyKey(intent)
		expect(isIdempotencyKey(stamped.idempotencyKey)).toBe(true)
		expect(withIdempotencyKey(stamped).idempotencyKey).toBe(stamped.idempotencyKey)
	})

	test('a new intent gets a new key', () => {
		const first = withIdempotencyKey({ gameSlug: 'sudoku' })
		const second = withIdempotencyKey({ gameSlug: 'sudoku' })
		expect(first.idempotencyKey).not.toBe(second.idempotencyKey)
	})

	test('pins the protocol header name', () => {
		expect(IDEMPOTENCY_KEY_HEADER).toBe('X-Puzzled-Idempotency-Key')
	})
})
