/**
 * TD-08: pins for the single GetDaily mapping (lib/api/domain/daily).
 *
 * A Connect response fixture in, exact DailyStatus / TodaysPuzzle out - the
 * same mapper the server accessors and the client hooks run.
 */

import { describe, expect, test } from 'bun:test'
import { create } from '@bufbuild/protobuf'
import {
	DailyCompletionSchema,
	type GetDailyResponse,
	GetDailyResponseSchema,
} from '@/gen/connect/puzzled/v1/puzzle_pb'
import { mapDailyStatus, mapTodaysPuzzle } from './daily'

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
		puzzleDataJson: '{"answer":"APPLE","clue":"fruit"}',
		completedSession: create(DailyCompletionSchema, {
			status: 'lost',
			score: 42,
			attempts: 6,
			completedAtMs: BigInt(COMPLETED_AT_MS),
		}),
	})
}

describe('mapDailyStatus', () => {
	test('pins every field of a completed lost session', () => {
		const out = mapDailyStatus(fixture(), 'easy')
		expect(out).toEqual({
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
				puzzleData: { answer: 'APPLE', clue: 'fruit' },
				difficulty: 'medium',
			},
			canPlay: false,
			mode: 'daily',
		})
	})

	test('a completion that is not won/lost fails closed to null', () => {
		const res = fixture()
		res.completedSession = create(DailyCompletionSchema, {
			status: 'abandoned',
			score: 1,
			attempts: 1,
		})
		expect(mapDailyStatus(res).completedSession).toBeNull()
	})

	test('hasCompleted without a completion payload yields null', () => {
		const res = fixture()
		res.completedSession = undefined
		expect(mapDailyStatus(res).completedSession).toBeNull()
	})

	test('a zero timestamp stays the epoch date (unchanged semantics)', () => {
		// completedAtMs is a proto3 scalar with create() default 0n; BigInt(0) is
		// a valid instant and the NaN guard only catches out-of-range values.
		// TD-08 keeps field values identical - this pins the current behaviour.
		const res = fixture()
		res.completedSession = create(DailyCompletionSchema, {
			status: 'won',
			score: 7,
			attempts: 3,
			completedAtMs: BigInt(0),
		})
		expect(mapDailyStatus(res).completedSession?.completedAt).toEqual(new Date(0))
	})

	test('an out-of-range completedAtMs collapses to null', () => {
		const res = fixture()
		res.completedSession = create(DailyCompletionSchema, {
			status: 'won',
			completedAtMs: BigInt(Number.MAX_SAFE_INTEGER),
		})
		expect(mapDailyStatus(res).completedSession?.completedAt).toBeNull()
	})

	test('non-UUID puzzle id is omitted; difficulty falls back to the request', () => {
		const res = fixture()
		res.puzzleId = '956'
		res.difficulty = ''
		const out = mapDailyStatus(res, 'hard')
		expect(out.puzzle.id).toBe('')
		expect(out.puzzle.difficulty).toBe('hard')
	})

	test('both difficulties empty yield null', () => {
		const res = fixture()
		res.difficulty = ''
		expect(mapDailyStatus(res).puzzle.difficulty).toBeNull()
	})

	test('invalid puzzleDataJson yields null, never a throw', () => {
		const res = fixture()
		res.puzzleDataJson = '{not json'
		expect(mapDailyStatus(res).puzzle.puzzleData).toBeNull()
	})

	test('empty puzzleDataJson yields null', () => {
		const res = fixture()
		res.puzzleDataJson = ''
		expect(mapDailyStatus(res).puzzle.puzzleData).toBeNull()
	})
})

describe('mapTodaysPuzzle', () => {
	test('pins the puzzle projection of the same fixture', () => {
		const out = mapTodaysPuzzle(fixture(), 'easy')
		expect(out).toEqual({
			puzzleId: PUZZLE_ID,
			puzzleNumber: 956,
			puzzleDate: '2026-09-21',
			puzzleData: { answer: 'APPLE', clue: 'fruit' },
			difficulty: 'medium',
		})
	})

	test('served puzzle id gate and difficulty fallback match DailyStatus', () => {
		const res = fixture()
		res.puzzleId = '956'
		res.difficulty = ''
		const out = mapTodaysPuzzle(res, 'hard')
		expect(out.puzzleId).toBe('')
		expect(out.difficulty).toBe('hard')
	})
})
