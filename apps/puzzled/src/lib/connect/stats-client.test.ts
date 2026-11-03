import { describe, expect, test } from 'bun:test'
import { create, toJson } from '@bufbuild/protobuf'
import {
	type GetTodayPercentileRequest,
	GetTodayPercentileRequestSchema,
	GetTodayPercentileResponseSchema,
} from '@/gen/connect/puzzled/v1/stats_pb'
import { getTodayPercentile, type StatsServiceClient } from './stats-client'
import { validateGetTodayPercentileInput } from './stats-domain'

describe('accepted daily comparison client', () => {
	test('sends the served game/day, never score or fixture authority', async () => {
		let sent: unknown
		const client = {
			getTodayPercentile: async (input: unknown) => {
				sent = input
				return create(GetTodayPercentileResponseSchema, {
					percentile: 0,
					totalPlayers: 12,
					dayKey: '2026-10-29',
					dispatch: 'product_db_sessions',
				})
			},
		} as unknown as StatsServiceClient
		const result = await getTodayPercentile(
			// Extra runtime fields from a stale caller must not get forwarded.
			Object.assign(
				{ gameSlug: ' sudoku ', dayKey: '2026-10-29' },
				{
					score: 999999,
					totalPlayers: 100,
					betterThan: 100,
					status: 'won',
					timeSpentMs: 0,
				},
			),
			client,
		)
		const wire = toJson(GetTodayPercentileRequestSchema, sent as GetTodayPercentileRequest)
		expect(wire).toMatchObject({ gameSlug: 'sudoku', dayKey: '2026-10-29' })
		expect(wire).not.toHaveProperty('score')
		expect(wire).not.toHaveProperty('totalPlayers')
		expect(wire).not.toHaveProperty('betterThan')
		expect(wire).not.toHaveProperty('timeSpentMs')
		expect(result.percentile).toBe(0)
	})

	test('will not request a comparison for a screen with no served day', () => {
		expect(validateGetTodayPercentileInput({ gameSlug: 'sudoku', dayKey: '' })).toBe(
			'day_key_required',
		)
		expect(validateGetTodayPercentileInput({ gameSlug: 'sudoku', dayKey: '2026-10-29' })).toBeNull()
	})
})
