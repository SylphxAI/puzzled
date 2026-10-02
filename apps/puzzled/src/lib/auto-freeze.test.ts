import { describe, expect, mock, test } from 'bun:test'
import { create } from '@bufbuild/protobuf'
import {
	StreakInfoSchema,
	ToggleAutoFreezeRequestSchema,
	ToggleAutoFreezeResponseSchema,
} from '@/gen/connect/puzzled/v1/gamification_pb'
import { requestAutoFreeze } from './auto-freeze'
import { type GamificationServiceClient, setAutoFreeze } from './connect/gamification-client'

function infoWith(autoFreezeEnabled: boolean) {
	return create(StreakInfoSchema, {
		currentStreak: 3,
		maxStreak: 5,
		hasPlayedToday: false,
		totalGamesPlayed: 9,
		freezesAvailable: 1,
		autoFreezeEnabled,
		daysUntilNextFreeze: 4,
		freezeUsedYesterday: false,
		playedDays: 9,
	})
}

describe('setAutoFreeze', () => {
	test('calls ToggleAutoFreeze with the requested value and returns the server state', async () => {
		const toggleAutoFreeze = mock(async (req: unknown) => {
			const { enabled } = req as { enabled: boolean }
			return create(ToggleAutoFreezeResponseSchema, { info: infoWith(enabled) })
		})
		const client = { toggleAutoFreeze } as unknown as GamificationServiceClient
		expect(await setAutoFreeze(false, client)).toBe(false)
		expect(await setAutoFreeze(true, client)).toBe(true)
		expect(toggleAutoFreeze).toHaveBeenCalledTimes(2)
		const first = toggleAutoFreeze.mock.calls[0]?.[0] as { enabled: boolean }
		expect(first.enabled).toBe(false)
		expect(create(ToggleAutoFreezeRequestSchema, { enabled: true }).enabled).toBe(true)
	})

	test('returns the server answer even when it differs from the request', async () => {
		const client = {
			toggleAutoFreeze: async () =>
				create(ToggleAutoFreezeResponseSchema, { info: infoWith(true) }),
		} as unknown as GamificationServiceClient
		expect(await setAutoFreeze(false, client)).toBe(true)
	})

	test('a response without streak info throws instead of claiming a state', async () => {
		const client = {
			toggleAutoFreeze: async () => create(ToggleAutoFreezeResponseSchema, {}),
		} as unknown as GamificationServiceClient
		await expect(setAutoFreeze(true, client)).rejects.toThrow('streak_payload_unavailable')
	})
})

describe('requestAutoFreeze', () => {
	test('success adopts the server state', async () => {
		const save = mock(async (enabled: boolean) => enabled)
		expect(await requestAutoFreeze(true, save)).toEqual({ enabled: false, failed: false })
		expect(save).toHaveBeenCalledWith(false)
		expect(await requestAutoFreeze(false, save)).toEqual({ enabled: true, failed: false })
	})

	test('failure keeps the previous state and reports it', async () => {
		const save = async () => {
			throw new Error('freeze_update_failed')
		}
		expect(await requestAutoFreeze(true, save)).toEqual({ enabled: true, failed: true })
		expect(await requestAutoFreeze(false, save)).toEqual({ enabled: false, failed: true })
	})
})
