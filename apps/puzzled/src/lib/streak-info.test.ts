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
				daysUntilNextFreeze: 4,
				freezeUsedYesterday: false,
				playedDays: 9,
			}),
		).toEqual({
			currentStreak: 3,
			maxStreak: 5,
			hasPlayedToday: true,
			totalGamesPlayed: 12,
			freezesAvailable: 1,
			autoFreezeEnabled: false,
			daysUntilNextFreeze: 4,
			freezeUsedYesterday: false,
			playedDays: 9,
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
				daysUntilNextFreeze: BigInt(7),
				freezeUsedYesterday: true,
				playedDays: BigInt(5),
			}),
		).toEqual({
			currentStreak: 2,
			maxStreak: 4,
			hasPlayedToday: false,
			totalGamesPlayed: 7,
			freezesAvailable: 0,
			autoFreezeEnabled: true,
			daysUntilNextFreeze: 7,
			freezeUsedYesterday: true,
			playedDays: 5,
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
				daysUntilNextFreeze: 7,
				freezeUsedYesterday: false,
			}),
		).toThrow('streak_payload_unavailable:currentStreak')
	})

	test('fails closed when the distinct played days are absent', () => {
		expect(() =>
			projectStreakInfo({
				currentStreak: 1,
				maxStreak: 1,
				hasPlayedToday: false,
				totalGamesPlayed: 1,
				freezesAvailable: 0,
				autoFreezeEnabled: true,
				daysUntilNextFreeze: 7,
				freezeUsedYesterday: false,
			}),
		).toThrow('streak_payload_unavailable:playedDays')
	})

	test('fails closed when the freeze fields are absent', () => {
		const base = {
			currentStreak: 1,
			maxStreak: 1,
			hasPlayedToday: false,
			totalGamesPlayed: 1,
			freezesAvailable: 0,
			autoFreezeEnabled: true,
		}
		expect(() => projectStreakInfo({ ...base, freezeUsedYesterday: false })).toThrow(
			'streak_payload_unavailable:daysUntilNextFreeze',
		)
		expect(() => projectStreakInfo({ ...base, daysUntilNextFreeze: 3 })).toThrow(
			'streak_payload_unavailable:freezeUsedYesterday',
		)
	})
})
