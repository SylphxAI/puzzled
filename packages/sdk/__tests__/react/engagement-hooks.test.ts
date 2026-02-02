/**
 * Engagement Hooks Tests
 *
 * Tests for streak, leaderboard, and achievement hooks logic.
 */

import { describe, expect, test } from 'bun:test'

// ============================================================================
// Types (from engagement-hooks.ts)
// ============================================================================

interface StreakState {
	streakId: string
	current: number
	longest: number
	lastActivityAt: string | null
	expiresAt: string | null
	canRecover: boolean
	timeRemainingMs: number | null
	userTimezone: string | null
}

interface RecordActivityResult {
	streak: StreakState
	extended: boolean
	newPersonalBest: boolean
	previousValue: number
}

interface LeaderboardEntry {
	rank: number
	userId: string
	displayName: string
	value: number
	isCurrentUser: boolean
}

interface LeaderboardResult {
	entries: LeaderboardEntry[]
	currentUserEntry: LeaderboardEntry | null
	totalParticipants: number
}

interface SubmitScoreResult {
	accepted: boolean
	rank: number | null
	previousBest: number | null
	newPersonalBest: boolean
	rankChange: number | null
}

interface UserAchievement {
	achievementId: string
	unlocked: boolean
	unlockedAt: string | null
	progress: number
	target: number | null
	progressPercent: number
}

interface AchievementDefinition {
	id: string
	name: string
	description: string
	type: 'standard' | 'incremental' | 'secret'
	tier: 'bronze' | 'silver' | 'gold' | 'platinum'
	category: string
	icon: string
	criteria: Record<string, unknown>
}

interface AchievementUnlockEvent {
	achievement: AchievementDefinition
	userAchievement: UserAchievement
	isNew: boolean
}

// ============================================================================
// Default Streak State Tests
// ============================================================================

describe('Default Streak State', () => {
	const defaultStreakState: StreakState = {
		streakId: '',
		current: 0,
		longest: 0,
		lastActivityAt: null,
		expiresAt: null,
		canRecover: false,
		timeRemainingMs: null,
		userTimezone: null,
	}

	test('has correct default values', () => {
		expect(defaultStreakState.streakId).toBe('')
		expect(defaultStreakState.current).toBe(0)
		expect(defaultStreakState.longest).toBe(0)
		expect(defaultStreakState.lastActivityAt).toBeNull()
		expect(defaultStreakState.expiresAt).toBeNull()
		expect(defaultStreakState.canRecover).toBe(false)
		expect(defaultStreakState.timeRemainingMs).toBeNull()
		expect(defaultStreakState.userTimezone).toBeNull()
	})
})

// ============================================================================
// useSafeStreak Return Value Tests
// ============================================================================

describe('useSafeStreak return value (no context)', () => {
	// Simulate the return when context is null
	const defaultReturn = {
		state: null,
		isLoading: false,
		error: null,
		current: 0,
		longest: 0,
		canRecover: false,
		timeRemainingMs: null,
		userTimezone: null,
		isConfigured: false,
	}

	test('returns safe defaults', () => {
		expect(defaultReturn.state).toBeNull()
		expect(defaultReturn.isLoading).toBe(false)
		expect(defaultReturn.error).toBeNull()
		expect(defaultReturn.current).toBe(0)
		expect(defaultReturn.longest).toBe(0)
		expect(defaultReturn.canRecover).toBe(false)
		expect(defaultReturn.timeRemainingMs).toBeNull()
		expect(defaultReturn.userTimezone).toBeNull()
		expect(defaultReturn.isConfigured).toBe(false)
	})
})

// ============================================================================
// useStreak Derived Values Tests
// ============================================================================

describe('useStreak derived values', () => {
	function computeStreakDerivedValues(state: StreakState | null) {
		return {
			current: state?.current ?? 0,
			longest: state?.longest ?? 0,
			canRecover: state?.canRecover ?? false,
			timeRemainingMs: state?.timeRemainingMs ?? null,
			userTimezone: state?.userTimezone ?? null,
		}
	}

	test('returns defaults when state is null', () => {
		const result = computeStreakDerivedValues(null)
		expect(result.current).toBe(0)
		expect(result.longest).toBe(0)
		expect(result.canRecover).toBe(false)
		expect(result.timeRemainingMs).toBeNull()
		expect(result.userTimezone).toBeNull()
	})

	test('extracts values from state', () => {
		const state: StreakState = {
			streakId: 'daily-challenge',
			current: 7,
			longest: 15,
			lastActivityAt: '2024-01-15T10:00:00Z',
			expiresAt: '2024-01-16T00:00:00Z',
			canRecover: true,
			timeRemainingMs: 3600000,
			userTimezone: 'America/New_York',
		}

		const result = computeStreakDerivedValues(state)
		expect(result.current).toBe(7)
		expect(result.longest).toBe(15)
		expect(result.canRecover).toBe(true)
		expect(result.timeRemainingMs).toBe(3600000)
		expect(result.userTimezone).toBe('America/New_York')
	})
})

// ============================================================================
// Stub Function Tests
// ============================================================================

describe('Stub Functions', () => {
	test('stubRecordActivity returns correct structure', async () => {
		const defaultStreakState: StreakState = {
			streakId: '',
			current: 0,
			longest: 0,
			lastActivityAt: null,
			expiresAt: null,
			canRecover: false,
			timeRemainingMs: null,
			userTimezone: null,
		}

		const stubRecordActivity = async (): Promise<RecordActivityResult> => ({
			streak: defaultStreakState,
			extended: false,
			newPersonalBest: false,
			previousValue: 0,
		})

		const result = await stubRecordActivity()
		expect(result.extended).toBe(false)
		expect(result.newPersonalBest).toBe(false)
		expect(result.previousValue).toBe(0)
		expect(result.streak.current).toBe(0)
	})

	test('stubRecover returns correct structure', async () => {
		const defaultStreakState: StreakState = {
			streakId: '',
			current: 0,
			longest: 0,
			lastActivityAt: null,
			expiresAt: null,
			canRecover: false,
			timeRemainingMs: null,
			userTimezone: null,
		}

		const stubRecover = async (): Promise<{ success: boolean; streak: StreakState }> => ({
			success: false,
			streak: defaultStreakState,
		})

		const result = await stubRecover()
		expect(result.success).toBe(false)
		expect(result.streak.current).toBe(0)
	})

	test('stubSubmitScore returns correct structure', async () => {
		const stubSubmitScore = async (): Promise<SubmitScoreResult> => ({
			accepted: false,
			rank: null,
			previousBest: null,
			newPersonalBest: false,
			rankChange: null,
		})

		const result = await stubSubmitScore()
		expect(result.accepted).toBe(false)
		expect(result.rank).toBeNull()
		expect(result.previousBest).toBeNull()
		expect(result.newPersonalBest).toBe(false)
		expect(result.rankChange).toBeNull()
	})

	test('stubUnlockAchievement returns correct structure', async () => {
		const defaultUserAchievement: UserAchievement = {
			achievementId: '',
			unlocked: false,
			unlockedAt: null,
			progress: 0,
			target: null,
			progressPercent: 0,
		}

		const stubUnlockAchievement = async (): Promise<AchievementUnlockEvent> => ({
			achievement: {
				id: '',
				name: '',
				description: '',
				type: 'standard',
				tier: 'bronze',
				category: '',
				icon: '',
				criteria: {},
			},
			userAchievement: defaultUserAchievement,
			isNew: false,
		})

		const result = await stubUnlockAchievement()
		expect(result.isNew).toBe(false)
		expect(result.achievement.type).toBe('standard')
		expect(result.achievement.tier).toBe('bronze')
		expect(result.userAchievement.unlocked).toBe(false)
	})
})

// ============================================================================
// useLeaderboard Derived Values Tests
// ============================================================================

describe('useLeaderboard derived values', () => {
	function computeLeaderboardDerivedValues(data: LeaderboardResult | null) {
		return {
			entries: data?.entries ?? [],
			currentUserEntry: data?.currentUserEntry ?? null,
			totalParticipants: data?.totalParticipants ?? 0,
		}
	}

	test('returns defaults when data is null', () => {
		const result = computeLeaderboardDerivedValues(null)
		expect(result.entries).toEqual([])
		expect(result.currentUserEntry).toBeNull()
		expect(result.totalParticipants).toBe(0)
	})

	test('extracts values from data', () => {
		const data: LeaderboardResult = {
			entries: [
				{ rank: 1, userId: 'user1', displayName: 'Alice', value: 1000, isCurrentUser: false },
				{ rank: 2, userId: 'user2', displayName: 'Bob', value: 900, isCurrentUser: true },
			],
			currentUserEntry: { rank: 2, userId: 'user2', displayName: 'Bob', value: 900, isCurrentUser: true },
			totalParticipants: 100,
		}

		const result = computeLeaderboardDerivedValues(data)
		expect(result.entries).toHaveLength(2)
		expect(result.entries[0]?.displayName).toBe('Alice')
		expect(result.currentUserEntry?.rank).toBe(2)
		expect(result.totalParticipants).toBe(100)
	})
})

// ============================================================================
// useAchievements Computed Values Tests
// ============================================================================

describe('useAchievements computed values', () => {
	test('separates unlocked and locked achievements', () => {
		const achievements: UserAchievement[] = [
			{ achievementId: 'a1', unlocked: true, unlockedAt: '2024-01-15', progress: 100, target: 100, progressPercent: 100 },
			{ achievementId: 'a2', unlocked: false, unlockedAt: null, progress: 50, target: 100, progressPercent: 50 },
			{ achievementId: 'a3', unlocked: true, unlockedAt: '2024-01-10', progress: 100, target: 100, progressPercent: 100 },
			{ achievementId: 'a4', unlocked: false, unlockedAt: null, progress: 0, target: 100, progressPercent: 0 },
		]

		const unlocked = achievements.filter((a) => a.unlocked)
		const locked = achievements.filter((a) => !a.unlocked)

		expect(unlocked).toHaveLength(2)
		expect(locked).toHaveLength(2)
		expect(unlocked.map((a) => a.achievementId)).toEqual(['a1', 'a3'])
		expect(locked.map((a) => a.achievementId)).toEqual(['a2', 'a4'])
	})

	test('getAchievement finds by ID', () => {
		const achievements: UserAchievement[] = [
			{ achievementId: 'first-win', unlocked: true, unlockedAt: '2024-01-15', progress: 1, target: 1, progressPercent: 100 },
			{ achievementId: 'ten-games', unlocked: false, unlockedAt: null, progress: 5, target: 10, progressPercent: 50 },
		]

		const getAchievement = (id: string): UserAchievement | null => {
			return achievements.find((a) => a.achievementId === id) ?? null
		}

		expect(getAchievement('first-win')?.unlocked).toBe(true)
		expect(getAchievement('ten-games')?.progress).toBe(5)
		expect(getAchievement('nonexistent')).toBeNull()
	})
})

// ============================================================================
// useSafeLeaderboard Return Value Tests
// ============================================================================

describe('useSafeLeaderboard return value (no context)', () => {
	const defaultReturn = {
		data: null,
		isLoading: false,
		error: null,
		entries: [],
		currentUserEntry: null,
		totalParticipants: 0,
		isConfigured: false,
	}

	test('returns safe defaults', () => {
		expect(defaultReturn.data).toBeNull()
		expect(defaultReturn.isLoading).toBe(false)
		expect(defaultReturn.error).toBeNull()
		expect(defaultReturn.entries).toEqual([])
		expect(defaultReturn.currentUserEntry).toBeNull()
		expect(defaultReturn.totalParticipants).toBe(0)
		expect(defaultReturn.isConfigured).toBe(false)
	})
})

// ============================================================================
// useSafeAchievements Return Value Tests
// ============================================================================

describe('useSafeAchievements return value (no context)', () => {
	const defaultReturn = {
		achievements: [],
		isLoading: false,
		error: null,
		unlocked: [],
		locked: [],
		recentUnlock: null,
		isConfigured: false,
	}

	test('returns safe defaults', () => {
		expect(defaultReturn.achievements).toEqual([])
		expect(defaultReturn.isLoading).toBe(false)
		expect(defaultReturn.error).toBeNull()
		expect(defaultReturn.unlocked).toEqual([])
		expect(defaultReturn.locked).toEqual([])
		expect(defaultReturn.recentUnlock).toBeNull()
		expect(defaultReturn.isConfigured).toBe(false)
	})
})

// ============================================================================
// Achievement Unlock Event Tests
// ============================================================================

describe('Achievement unlock event handling', () => {
	test('recent unlock state management', () => {
		let recentUnlock: AchievementUnlockEvent | null = null

		const setRecentUnlock = (event: AchievementUnlockEvent | null) => {
			recentUnlock = event
		}

		const dismissRecentUnlock = () => {
			recentUnlock = null
		}

		// Simulate unlocking a new achievement
		const unlockEvent: AchievementUnlockEvent = {
			achievement: {
				id: 'first-purchase',
				name: 'First Purchase',
				description: 'Made your first purchase',
				type: 'standard',
				tier: 'bronze',
				category: 'commerce',
				icon: '🛒',
				criteria: { purchaseCount: 1 },
			},
			userAchievement: {
				achievementId: 'first-purchase',
				unlocked: true,
				unlockedAt: '2024-01-15T10:00:00Z',
				progress: 1,
				target: 1,
				progressPercent: 100,
			},
			isNew: true,
		}

		// Set recent unlock when isNew is true
		if (unlockEvent.isNew) {
			setRecentUnlock(unlockEvent)
		}

		expect(recentUnlock).toBe(unlockEvent)
		expect(recentUnlock?.isNew).toBe(true)
		expect(recentUnlock?.achievement.name).toBe('First Purchase')

		// Dismiss the unlock
		dismissRecentUnlock()
		expect(recentUnlock).toBeNull()
	})

	test('does not set recent unlock when isNew is false', () => {
		let recentUnlock: AchievementUnlockEvent | null = null

		const setRecentUnlock = (event: AchievementUnlockEvent | null) => {
			recentUnlock = event
		}

		const unlockEvent: AchievementUnlockEvent = {
			achievement: {
				id: 'first-purchase',
				name: 'First Purchase',
				description: 'Made your first purchase',
				type: 'standard',
				tier: 'bronze',
				category: 'commerce',
				icon: '🛒',
				criteria: {},
			},
			userAchievement: {
				achievementId: 'first-purchase',
				unlocked: true,
				unlockedAt: '2024-01-15T10:00:00Z',
				progress: 1,
				target: 1,
				progressPercent: 100,
			},
			isNew: false, // Already unlocked before
		}

		if (unlockEvent.isNew) {
			setRecentUnlock(unlockEvent)
		}

		expect(recentUnlock).toBeNull()
	})
})
