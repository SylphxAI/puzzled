import { describe, expect, test } from 'bun:test'
import {
	clampLeaderboardLimit,
	leaderboardPeriodToProto,
	leaderboardTypeToProto,
	validateGetLeaderboardInput,
} from './stats-domain'

describe('stats domain pure (puzzled.v1.StatsService)', () => {
	test('validate + clamp', () => {
		expect(
			validateGetLeaderboardInput({ gameSlug: '', type: 'score', period: 'today', limit: 10 }),
		).toBe('game_slug_required')
		expect(
			validateGetLeaderboardInput({ gameSlug: 'daily', type: 'score', period: 'today', limit: 10 }),
		).toBe(null)
		expect(clampLeaderboardLimit(0)).toBe(10)
		expect(clampLeaderboardLimit(500)).toBe(100)
		expect(clampLeaderboardLimit(25)).toBe(25)
	})
	test('proto enum maps', () => {
		expect(leaderboardTypeToProto('streak')).toBe(1)
		expect(leaderboardPeriodToProto('week')).toBe(2)
	})
})
