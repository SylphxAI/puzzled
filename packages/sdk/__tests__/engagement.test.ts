/**
 * Engagement Functions Tests
 *
 * Tests for streaks, leaderboards, and achievements.
 */

import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test'
import {
	// Streak functions
	getStreak,
	getAllStreaks,
	recordStreakActivity,
	recoverStreak,
	// Leaderboard functions
	getLeaderboard,
	submitScore,
	getUserLeaderboardRank,
	// Achievement functions
	getAchievements,
	getAchievement,
	unlockAchievement,
	incrementAchievementProgress,
	getAchievementPoints,
} from '../src/engagement'
import { type SylphxConfig, createConfig } from '../src/config'

// ============================================================================
// Test Setup
// ============================================================================

let mockFetch: ReturnType<typeof mock>
let originalFetch: typeof globalThis.fetch
let testConfig: SylphxConfig

beforeEach(() => {
	originalFetch = globalThis.fetch
	mockFetch = mock(() =>
		Promise.resolve(
			new Response(JSON.stringify({ success: true }), {
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			})
		)
	)
	globalThis.fetch = mockFetch as unknown as typeof fetch

	testConfig = createConfig({
		secretKey: 'sk_dev_test123',
		platformUrl: 'https://test.sylphx.com',
	})
})

afterEach(() => {
	globalThis.fetch = originalFetch
	mockFetch.mockClear()
})

// Helper to extract request details from mock call
function getRequestBody(callIndex: number = 0): Record<string, unknown> {
	const call = mockFetch.mock.calls[callIndex]
	const options = call?.[1] as RequestInit
	if (!options.body) return {}
	return JSON.parse(options.body as string)
}

function getRequestUrl(callIndex: number = 0): string {
	const call = mockFetch.mock.calls[callIndex]
	return call?.[0] as string
}

function getRequestMethod(callIndex: number = 0): string {
	const call = mockFetch.mock.calls[callIndex]
	const options = call?.[1] as RequestInit
	return options.method || 'GET'
}

// ============================================================================
// Mock Data
// ============================================================================

const mockStreakState = {
	streakId: 'daily-login',
	userId: 'user-123',
	current: 7,
	longest: 30,
	lastActivityAt: '2024-01-15T10:00:00.000Z',
	expiresAt: '2024-01-16T23:59:59.999Z',
	timeRemainingMs: 86400000,
	isActive: true,
	atRisk: false,
}

const mockRecordResult = {
	streak: mockStreakState,
	extended: true,
	newPersonalBest: false,
	firstActivity: false,
	recovered: false,
}

const mockLeaderboardEntry = {
	rank: 1,
	userId: 'user-123',
	displayName: 'Player One',
	value: 1500,
	metadata: { level: 'hard' },
	createdAt: '2024-01-15T10:00:00.000Z',
}

const mockLeaderboardResult = {
	leaderboardId: 'high-scores',
	entries: [mockLeaderboardEntry],
	currentUserEntry: mockLeaderboardEntry,
	total: 100,
}

const mockSubmitResult = {
	entry: mockLeaderboardEntry,
	rank: 1,
	newPersonalBest: true,
	previousBest: 1200,
	isOnLeaderboard: true,
}

const mockUserAchievement = {
	achievementId: 'first-win',
	userId: 'user-123',
	name: 'First Win',
	description: 'Won your first game',
	tier: 'bronze',
	points: 100,
	unlocked: true,
	unlockedAt: '2024-01-15T10:00:00.000Z',
	progress: 1,
	target: 1,
}

const mockUnlockEvent = {
	achievement: mockUserAchievement,
	isNew: true,
	pointsAwarded: 100,
}

const mockAchievementPoints = {
	total: 500,
	thisMonth: 200,
	rank: 42,
}

// ============================================================================
// Streak Functions Tests
// ============================================================================

describe('getStreak', () => {
	test('fetches streak from correct endpoint', async () => {
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(JSON.stringify(mockStreakState), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				})
			)
		)

		await getStreak(testConfig, 'daily-login', 'user-123')

		expect(mockFetch).toHaveBeenCalledTimes(1)
		const url = getRequestUrl()
		expect(url).toContain('/api/sdk/v1/engagement/streaks/get')
	})

	test('uses GET method', async () => {
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(JSON.stringify(mockStreakState), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				})
			)
		)

		await getStreak(testConfig, 'daily-login', 'user-123')

		expect(getRequestMethod()).toBe('GET')
	})

	test('includes streakId and userId in query params', async () => {
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(JSON.stringify(mockStreakState), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				})
			)
		)

		await getStreak(testConfig, 'daily-challenge', 'user-456')

		const url = getRequestUrl()
		expect(url).toContain('streakId=daily-challenge')
		expect(url).toContain('userId=user-456')
	})

	test('returns streak state', async () => {
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(JSON.stringify(mockStreakState), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				})
			)
		)

		const result = await getStreak(testConfig, 'daily-login', 'user-123')

		expect(result).toEqual(mockStreakState)
	})
})

describe('getAllStreaks', () => {
	test('fetches all streaks from correct endpoint', async () => {
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(JSON.stringify([mockStreakState]), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				})
			)
		)

		await getAllStreaks(testConfig, 'user-123')

		const url = getRequestUrl()
		expect(url).toContain('/api/sdk/v1/engagement/streaks')
		expect(url).toContain('userId=user-123')
	})

	test('returns array of streak states', async () => {
		const streaks = [mockStreakState, { ...mockStreakState, streakId: 'weekly-quest' }]
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(JSON.stringify(streaks), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				})
			)
		)

		const result = await getAllStreaks(testConfig, 'user-123')

		expect(result).toHaveLength(2)
	})
})

describe('recordStreakActivity', () => {
	test('posts to correct endpoint', async () => {
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(JSON.stringify(mockRecordResult), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				})
			)
		)

		await recordStreakActivity(testConfig, { streakId: 'daily-login' }, 'user-123')

		const url = getRequestUrl()
		expect(url).toContain('/api/sdk/v1/engagement/streaks/record')
		expect(getRequestMethod()).toBe('POST')
	})

	test('includes streakId and userId in body', async () => {
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(JSON.stringify(mockRecordResult), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				})
			)
		)

		await recordStreakActivity(testConfig, { streakId: 'daily-challenge' }, 'user-456')

		const body = getRequestBody()
		expect(body.streakId).toBe('daily-challenge')
		expect(body.userId).toBe('user-456')
	})

	test('includes defaults for auto-discovery', async () => {
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(JSON.stringify(mockRecordResult), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				})
			)
		)

		const defaults = {
			name: 'Daily Challenge',
			frequency: 'daily' as const,
			gracePeriodHours: 12,
		}

		await recordStreakActivity(testConfig, { streakId: 'daily-challenge' }, 'user-123', defaults)

		const body = getRequestBody()
		expect(body.defaults).toEqual(defaults)
	})

	test('returns activity result', async () => {
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(JSON.stringify(mockRecordResult), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				})
			)
		)

		const result = await recordStreakActivity(
			testConfig,
			{ streakId: 'daily-login' },
			'user-123'
		)

		expect(result.extended).toBe(true)
		expect(result.streak.current).toBe(7)
	})
})

describe('recoverStreak', () => {
	test('posts to correct endpoint', async () => {
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(JSON.stringify({ success: true, streak: mockStreakState }), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				})
			)
		)

		await recoverStreak(testConfig, 'daily-login', 'user-123')

		const url = getRequestUrl()
		expect(url).toContain('/api/sdk/v1/engagement/streaks/recover')
		expect(getRequestMethod()).toBe('POST')
	})

	test('includes streakId and userId in body', async () => {
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(JSON.stringify({ success: true, streak: mockStreakState }), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				})
			)
		)

		await recoverStreak(testConfig, 'weekly-quest', 'user-456')

		const body = getRequestBody()
		expect(body.streakId).toBe('weekly-quest')
		expect(body.userId).toBe('user-456')
	})
})

// ============================================================================
// Leaderboard Functions Tests
// ============================================================================

describe('getLeaderboard', () => {
	test('fetches leaderboard from correct endpoint', async () => {
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(JSON.stringify(mockLeaderboardResult), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				})
			)
		)

		await getLeaderboard(testConfig, 'high-scores', 'user-123')

		const url = getRequestUrl()
		expect(url).toContain('/api/sdk/v1/engagement/leaderboards/get')
		expect(getRequestMethod()).toBe('GET')
	})

	test('includes leaderboardId and userId in query', async () => {
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(JSON.stringify(mockLeaderboardResult), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				})
			)
		)

		await getLeaderboard(testConfig, 'weekly-scores', 'user-456')

		const url = getRequestUrl()
		expect(url).toContain('leaderboardId=weekly-scores')
		expect(url).toContain('userId=user-456')
	})

	test('handles null userId', async () => {
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(JSON.stringify(mockLeaderboardResult), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				})
			)
		)

		await getLeaderboard(testConfig, 'high-scores', null)

		const url = getRequestUrl()
		expect(url).toContain('leaderboardId=high-scores')
	})

	test('includes query options', async () => {
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(JSON.stringify(mockLeaderboardResult), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				})
			)
		)

		await getLeaderboard(testConfig, 'high-scores', 'user-123', {
			limit: 10,
			includeSurrounding: true,
		})

		const url = getRequestUrl()
		expect(url).toContain('limit=10')
		expect(url).toContain('includeSurrounding=true')
	})

	test('returns leaderboard result', async () => {
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(JSON.stringify(mockLeaderboardResult), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				})
			)
		)

		const result = await getLeaderboard(testConfig, 'high-scores', 'user-123')

		expect(result.entries).toHaveLength(1)
		expect(result.currentUserEntry).toBeDefined()
	})
})

describe('submitScore', () => {
	test('posts to correct endpoint', async () => {
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(JSON.stringify(mockSubmitResult), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				})
			)
		)

		await submitScore(testConfig, { leaderboardId: 'high-scores', value: 1500 }, 'user-123')

		const url = getRequestUrl()
		expect(url).toContain('/api/sdk/v1/engagement/leaderboards/submit')
		expect(getRequestMethod()).toBe('POST')
	})

	test('includes score data in body', async () => {
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(JSON.stringify(mockSubmitResult), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				})
			)
		)

		await submitScore(
			testConfig,
			{
				leaderboardId: 'high-scores',
				value: 2000,
				metadata: { level: 'expert' },
			},
			'user-123'
		)

		const body = getRequestBody()
		expect(body.leaderboardId).toBe('high-scores')
		expect(body.value).toBe(2000)
		expect(body.metadata).toEqual({ level: 'expert' })
		expect(body.userId).toBe('user-123')
	})

	test('includes defaults for auto-discovery', async () => {
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(JSON.stringify(mockSubmitResult), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				})
			)
		)

		const defaults = {
			name: 'High Scores',
			sortDirection: 'desc' as const,
			resetPeriod: 'weekly' as const,
			aggregation: 'max' as const,
		}

		await submitScore(
			testConfig,
			{ leaderboardId: 'high-scores', value: 1500 },
			'user-123',
			defaults
		)

		const body = getRequestBody()
		expect(body.defaults).toEqual(defaults)
	})

	test('returns submit result', async () => {
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(JSON.stringify(mockSubmitResult), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				})
			)
		)

		const result = await submitScore(
			testConfig,
			{ leaderboardId: 'high-scores', value: 1500 },
			'user-123'
		)

		expect(result.newPersonalBest).toBe(true)
		expect(result.rank).toBe(1)
	})
})

describe('getUserLeaderboardRank', () => {
	test('fetches rank from correct endpoint', async () => {
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(JSON.stringify({ rank: 42, value: 1200 }), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				})
			)
		)

		await getUserLeaderboardRank(testConfig, 'high-scores', 'user-123')

		const url = getRequestUrl()
		expect(url).toContain('/api/sdk/v1/engagement/leaderboards/rank')
		expect(url).toContain('leaderboardId=high-scores')
		expect(url).toContain('userId=user-123')
	})

	test('returns rank and value', async () => {
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(JSON.stringify({ rank: 42, value: 1200 }), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				})
			)
		)

		const result = await getUserLeaderboardRank(testConfig, 'high-scores', 'user-123')

		expect(result?.rank).toBe(42)
		expect(result?.value).toBe(1200)
	})

	test('returns null for unranked user', async () => {
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(JSON.stringify(null), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				})
			)
		)

		const result = await getUserLeaderboardRank(testConfig, 'high-scores', 'user-123')

		expect(result).toBeNull()
	})
})

// ============================================================================
// Achievement Functions Tests
// ============================================================================

describe('getAchievements', () => {
	test('fetches achievements from correct endpoint', async () => {
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(JSON.stringify([mockUserAchievement]), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				})
			)
		)

		await getAchievements(testConfig, 'user-123')

		const url = getRequestUrl()
		expect(url).toContain('/api/sdk/v1/engagement/achievements')
		expect(url).toContain('userId=user-123')
	})

	test('returns array of achievements', async () => {
		const achievements = [
			mockUserAchievement,
			{ ...mockUserAchievement, achievementId: 'collector', unlocked: false },
		]
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(JSON.stringify(achievements), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				})
			)
		)

		const result = await getAchievements(testConfig, 'user-123')

		expect(result).toHaveLength(2)
	})
})

describe('getAchievement', () => {
	test('fetches single achievement from correct endpoint', async () => {
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(JSON.stringify(mockUserAchievement), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				})
			)
		)

		await getAchievement(testConfig, 'first-win', 'user-123')

		const url = getRequestUrl()
		expect(url).toContain('/api/sdk/v1/engagement/achievements/get')
		expect(url).toContain('achievementId=first-win')
		expect(url).toContain('userId=user-123')
	})

	test('returns achievement or null', async () => {
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(JSON.stringify(mockUserAchievement), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				})
			)
		)

		const result = await getAchievement(testConfig, 'first-win', 'user-123')

		expect(result?.achievementId).toBe('first-win')
		expect(result?.unlocked).toBe(true)
	})
})

describe('unlockAchievement', () => {
	test('posts to correct endpoint', async () => {
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(JSON.stringify(mockUnlockEvent), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				})
			)
		)

		await unlockAchievement(testConfig, 'first-purchase', 'user-123')

		const url = getRequestUrl()
		expect(url).toContain('/api/sdk/v1/engagement/achievements/unlock')
		expect(getRequestMethod()).toBe('POST')
	})

	test('includes achievementId and userId in body', async () => {
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(JSON.stringify(mockUnlockEvent), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				})
			)
		)

		await unlockAchievement(testConfig, 'speed-demon', 'user-456')

		const body = getRequestBody()
		expect(body.achievementId).toBe('speed-demon')
		expect(body.userId).toBe('user-456')
	})

	test('includes defaults for auto-discovery', async () => {
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(JSON.stringify(mockUnlockEvent), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				})
			)
		)

		const defaults = {
			name: 'First Purchase',
			description: 'Made your first purchase',
			points: 100,
			tier: 'bronze' as const,
		}

		await unlockAchievement(testConfig, 'first-purchase', 'user-123', defaults)

		const body = getRequestBody()
		expect(body.defaults).toEqual(defaults)
	})

	test('returns unlock event', async () => {
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(JSON.stringify(mockUnlockEvent), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				})
			)
		)

		const result = await unlockAchievement(testConfig, 'first-win', 'user-123')

		expect(result.isNew).toBe(true)
		expect(result.pointsAwarded).toBe(100)
	})
})

describe('incrementAchievementProgress', () => {
	test('posts to correct endpoint', async () => {
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(JSON.stringify({ ...mockUserAchievement, progress: 50, target: 100 }), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				})
			)
		)

		await incrementAchievementProgress(testConfig, 'collector-100', 1, 'user-123')

		const url = getRequestUrl()
		expect(url).toContain('/api/sdk/v1/engagement/achievements/progress')
		expect(getRequestMethod()).toBe('POST')
	})

	test('includes achievementId, amount, and userId in body', async () => {
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(JSON.stringify({ ...mockUserAchievement, progress: 50, target: 100 }), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				})
			)
		)

		await incrementAchievementProgress(testConfig, 'collector-100', 5, 'user-456')

		const body = getRequestBody()
		expect(body.achievementId).toBe('collector-100')
		expect(body.amount).toBe(5)
		expect(body.userId).toBe('user-456')
	})

	test('includes defaults for auto-discovery', async () => {
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(JSON.stringify({ ...mockUserAchievement, progress: 50, target: 100 }), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				})
			)
		)

		const defaults = {
			name: 'Collector',
			description: 'Collect 100 items',
			type: 'incremental' as const,
			target: 100,
			tier: 'silver' as const,
		}

		await incrementAchievementProgress(testConfig, 'collector-100', 1, 'user-123', defaults)

		const body = getRequestBody()
		expect(body.defaults).toEqual(defaults)
	})

	test('returns updated achievement', async () => {
		const updatedAchievement = { ...mockUserAchievement, progress: 50, target: 100, unlocked: false }
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(JSON.stringify(updatedAchievement), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				})
			)
		)

		const result = await incrementAchievementProgress(testConfig, 'collector-100', 1, 'user-123')

		expect(result.progress).toBe(50)
		expect(result.target).toBe(100)
	})
})

describe('getAchievementPoints', () => {
	test('fetches points from correct endpoint', async () => {
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(JSON.stringify(mockAchievementPoints), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				})
			)
		)

		await getAchievementPoints(testConfig, 'user-123')

		const url = getRequestUrl()
		expect(url).toContain('/api/sdk/v1/engagement/achievements/points')
		expect(url).toContain('userId=user-123')
	})

	test('returns points summary', async () => {
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(JSON.stringify(mockAchievementPoints), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				})
			)
		)

		const result = await getAchievementPoints(testConfig, 'user-123')

		expect(result.total).toBe(500)
		expect(result.thisMonth).toBe(200)
		expect(result.rank).toBe(42)
	})
})

// ============================================================================
// Error Handling Tests
// ============================================================================

describe('Error Handling', () => {
	test('streak functions throw on network error', async () => {
		mockFetch.mockImplementationOnce(() => Promise.reject(new Error('Network error')))
		await expect(getStreak(testConfig, 'test', 'user-123')).rejects.toThrow()

		mockFetch.mockImplementationOnce(() => Promise.reject(new Error('Network error')))
		await expect(getAllStreaks(testConfig, 'user-123')).rejects.toThrow()

		mockFetch.mockImplementationOnce(() => Promise.reject(new Error('Network error')))
		await expect(
			recordStreakActivity(testConfig, { streakId: 'test' }, 'user-123')
		).rejects.toThrow()
	})

	test('leaderboard functions throw on network error', async () => {
		mockFetch.mockImplementationOnce(() => Promise.reject(new Error('Network error')))
		await expect(getLeaderboard(testConfig, 'test', 'user-123')).rejects.toThrow()

		mockFetch.mockImplementationOnce(() => Promise.reject(new Error('Network error')))
		await expect(
			submitScore(testConfig, { leaderboardId: 'test', value: 100 }, 'user-123')
		).rejects.toThrow()
	})

	test('achievement functions throw on network error', async () => {
		mockFetch.mockImplementationOnce(() => Promise.reject(new Error('Network error')))
		await expect(getAchievements(testConfig, 'user-123')).rejects.toThrow()

		mockFetch.mockImplementationOnce(() => Promise.reject(new Error('Network error')))
		await expect(unlockAchievement(testConfig, 'test', 'user-123')).rejects.toThrow()
	})

	test('throws on 400 response', async () => {
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(JSON.stringify({ error: 'Invalid input' }), {
					status: 400,
					headers: { 'Content-Type': 'application/json' },
				})
			)
		)

		await expect(getStreak(testConfig, '', 'user-123')).rejects.toThrow()
	})

	test('throws on 404 response', async () => {
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(JSON.stringify({ error: 'Not found' }), {
					status: 404,
					headers: { 'Content-Type': 'application/json' },
				})
			)
		)

		await expect(getStreak(testConfig, 'nonexistent', 'user-123')).rejects.toThrow()
	})
})

// ============================================================================
// Edge Cases Tests
// ============================================================================

describe('Edge Cases', () => {
	test('handles special characters in IDs', async () => {
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(JSON.stringify(mockStreakState), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				})
			)
		)

		await getStreak(testConfig, 'streak-with-dash', 'user_with_underscore')

		const url = getRequestUrl()
		expect(url).toContain('streakId=streak-with-dash')
		expect(url).toContain('userId=user_with_underscore')
	})

	test('handles zero values in leaderboard', async () => {
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(JSON.stringify(mockSubmitResult), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				})
			)
		)

		await submitScore(testConfig, { leaderboardId: 'test', value: 0 }, 'user-123')

		const body = getRequestBody()
		expect(body.value).toBe(0)
	})

	test('handles negative values in leaderboard', async () => {
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(JSON.stringify(mockSubmitResult), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				})
			)
		)

		await submitScore(testConfig, { leaderboardId: 'test', value: -100 }, 'user-123')

		const body = getRequestBody()
		expect(body.value).toBe(-100)
	})

	test('handles large increment amounts', async () => {
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(JSON.stringify(mockUserAchievement), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				})
			)
		)

		await incrementAchievementProgress(testConfig, 'test', 1000000, 'user-123')

		const body = getRequestBody()
		expect(body.amount).toBe(1000000)
	})

	test('handles empty metadata in leaderboard submission', async () => {
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(JSON.stringify(mockSubmitResult), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				})
			)
		)

		await submitScore(testConfig, { leaderboardId: 'test', value: 100 }, 'user-123')

		const body = getRequestBody()
		expect(body.metadata).toBeUndefined()
	})
})
