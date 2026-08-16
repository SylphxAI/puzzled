import { describe, expect, test } from 'bun:test'
import { create } from '@bufbuild/protobuf'
import { StreakInfoSchema } from '@/gen/connect/puzzled/v1/gamification_pb'
import { mapStreakInfo } from './gamification-client'

describe('GamificationService Connect projection', () => {
	test('maps Rust-owned streak fields without client derivation', () => {
		expect(
			mapStreakInfo(
				create(StreakInfoSchema, {
					currentStreak: 4,
					maxStreak: 9,
					hasPlayedToday: true,
					totalGamesPlayed: 12,
					freezesAvailable: 2,
					autoFreezeEnabled: true,
				}),
			),
		).toEqual({
			currentStreak: 4,
			maxStreak: 9,
			hasPlayedToday: true,
			totalGamesPlayed: 12,
			freezesAvailable: 2,
			autoFreezeEnabled: true,
		})
	})

	test('fails closed to zero projection when Connect omits info', () => {
		expect(mapStreakInfo()).toEqual({
			currentStreak: 0,
			maxStreak: 0,
			hasPlayedToday: false,
			totalGamesPlayed: 0,
			freezesAvailable: 0,
			autoFreezeEnabled: false,
		})
	})
})
