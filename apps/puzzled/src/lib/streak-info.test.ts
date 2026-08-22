import { describe, expect, test } from 'bun:test'
import { projectStreakInfo } from './streak-info'

describe('projectStreakInfo', () => {
	test('maps a complete accepted-session payload', () => {
		expect(
			projectStreakInfo({
				currentStreak: 3,
				maxStreak: 5,
				hasPlayedToday: true,
				totalGamesPlayed: 12,
				freezesAvailable: 1,
				autoFreezeEnabled: false,
			}),
		).toEqual({
			currentStreak: 3,
			maxStreak: 5,
			hasPlayedToday: true,
			totalGamesPlayed: 12,
			freezesAvailable: 1,
			autoFreezeEnabled: false,
		})
	})

	test('fails closed when the envelope is missing', () => {
		expect(() => projectStreakInfo(undefined)).toThrow('streak_payload_unavailable')
		expect(() => projectStreakInfo(null)).toThrow('streak_payload_unavailable')
	})

	test('accepts integer bigint fields from protobuf JSON', () => {
		expect(
			projectStreakInfo({
				currentStreak: BigInt(2),
				maxStreak: BigInt(4),
				hasPlayedToday: false,
				totalGamesPlayed: BigInt(7),
				freezesAvailable: BigInt(0),
				autoFreezeEnabled: true,
			}),
		).toEqual({
			currentStreak: 2,
			maxStreak: 4,
			hasPlayedToday: false,
			totalGamesPlayed: 7,
			freezesAvailable: 0,
			autoFreezeEnabled: true,
		})
	})

	test('fails closed when a field is absent rather than coercing to zero', () => {
		expect(() =>
			projectStreakInfo({
				maxStreak: 1,
				hasPlayedToday: false,
				totalGamesPlayed: 1,
				freezesAvailable: 0,
				autoFreezeEnabled: false,
			}),
		).toThrow('streak_payload_unavailable:currentStreak')
	})
})
