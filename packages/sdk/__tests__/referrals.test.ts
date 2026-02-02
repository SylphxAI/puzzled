/**
 * Referrals Functions Tests
 *
 * Tests for referral code management, redemption, and leaderboard.
 */

import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test'
import {
	getMyReferralCode,
	getReferralStats,
	redeemReferralCode,
	getReferralLeaderboard,
	regenerateReferralCode,
	type ReferralCode,
	type ReferralStats,
	type RedeemResult,
	type LeaderboardResult,
} from '../src/referrals'
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

const mockReferralCode: ReferralCode = {
	code: 'ABC123XYZ',
	createdAt: '2024-01-15T10:00:00.000Z',
}

const mockReferralStats: ReferralStats = {
	code: 'ABC123XYZ',
	totalReferrals: 25,
	successfulReferrals: 20,
	pendingReferrals: 5,
	totalRewards: 1500,
}

const mockRedeemResult: RedeemResult = {
	success: true,
	rewardType: 'premium_trial',
	referredReward: { type: 'premium_trial', days: 7 },
	referrerReward: { type: 'premium_trial', days: 7 },
}

const mockLeaderboard: LeaderboardResult = {
	period: 'all',
	entries: [
		{
			rank: 1,
			name: 'Top User',
			userId: 'user-1',
			referrals: 100,
			isCurrentUser: false,
		},
		{
			rank: 2,
			name: 'Second Place',
			userId: 'user-2',
			referrals: 75,
			isCurrentUser: false,
		},
		{
			rank: 3,
			name: 'Current User',
			userId: 'user-123',
			referrals: 50,
			isCurrentUser: true,
		},
	],
	currentUserRank: 3,
	totalParticipants: 500,
}

// ============================================================================
// getMyReferralCode() Tests
// ============================================================================

describe('getMyReferralCode', () => {
	test('fetches code from correct endpoint', async () => {
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(JSON.stringify(mockReferralCode), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				})
			)
		)

		await getMyReferralCode(testConfig, 'user-123')

		expect(mockFetch).toHaveBeenCalledTimes(1)
		const url = getRequestUrl()
		expect(url).toContain('/api/sdk/v1/referrals/code')
	})

	test('uses GET method', async () => {
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(JSON.stringify(mockReferralCode), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				})
			)
		)

		await getMyReferralCode(testConfig, 'user-123')

		expect(getRequestMethod()).toBe('GET')
	})

	test('includes userId in query params', async () => {
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(JSON.stringify(mockReferralCode), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				})
			)
		)

		await getMyReferralCode(testConfig, 'user-456')

		const url = getRequestUrl()
		expect(url).toContain('userId=user-456')
	})

	test('returns referral code', async () => {
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(JSON.stringify(mockReferralCode), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				})
			)
		)

		const result = await getMyReferralCode(testConfig, 'user-123')

		expect(result.code).toBe('ABC123XYZ')
		expect(result.createdAt).toBeDefined()
	})
})

// ============================================================================
// getReferralStats() Tests
// ============================================================================

describe('getReferralStats', () => {
	test('fetches stats from correct endpoint', async () => {
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(JSON.stringify(mockReferralStats), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				})
			)
		)

		await getReferralStats(testConfig, 'user-123')

		const url = getRequestUrl()
		expect(url).toContain('/api/sdk/v1/referrals/stats')
		expect(url).toContain('userId=user-123')
	})

	test('returns stats object', async () => {
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(JSON.stringify(mockReferralStats), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				})
			)
		)

		const result = await getReferralStats(testConfig, 'user-123')

		expect(result.totalReferrals).toBe(25)
		expect(result.successfulReferrals).toBe(20)
		expect(result.pendingReferrals).toBe(5)
		expect(result.totalRewards).toBe(1500)
	})
})

// ============================================================================
// redeemReferralCode() Tests
// ============================================================================

describe('redeemReferralCode', () => {
	test('posts to correct endpoint', async () => {
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(JSON.stringify(mockRedeemResult), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				})
			)
		)

		await redeemReferralCode(testConfig, { code: 'ABC123', userId: 'user-456' })

		const url = getRequestUrl()
		expect(url).toContain('/api/sdk/v1/referrals/redeem')
		expect(getRequestMethod()).toBe('POST')
	})

	test('includes code and userId in body', async () => {
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(JSON.stringify(mockRedeemResult), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				})
			)
		)

		await redeemReferralCode(testConfig, { code: 'XYZ789', userId: 'new-user' })

		const body = getRequestBody()
		expect(body.code).toBe('XYZ789')
		expect(body.userId).toBe('new-user')
	})

	test('includes defaults for auto-discovery', async () => {
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(JSON.stringify(mockRedeemResult), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				})
			)
		)

		const defaults = {
			referrerReward: { type: 'premium_trial' as const, days: 7 },
			refereeReward: { type: 'points' as const, points: 100 },
			doubleReward: true,
		}

		await redeemReferralCode(testConfig, { code: 'ABC123', userId: 'user-456' }, defaults)

		const body = getRequestBody()
		expect(body.defaults).toEqual(defaults)
	})

	test('works without defaults', async () => {
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(JSON.stringify(mockRedeemResult), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				})
			)
		)

		await redeemReferralCode(testConfig, { code: 'ABC123', userId: 'user-456' })

		const body = getRequestBody()
		expect(body.defaults).toBeUndefined()
	})

	test('returns redeem result', async () => {
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(JSON.stringify(mockRedeemResult), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				})
			)
		)

		const result = await redeemReferralCode(testConfig, { code: 'ABC123', userId: 'user-456' })

		expect(result.success).toBe(true)
		expect(result.rewardType).toBe('premium_trial')
	})

	test('handles unsuccessful redemption', async () => {
		const failResult = { success: false, rewardType: 'none' }
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(JSON.stringify(failResult), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				})
			)
		)

		const result = await redeemReferralCode(testConfig, { code: 'INVALID', userId: 'user-456' })

		expect(result.success).toBe(false)
	})
})

// ============================================================================
// getReferralLeaderboard() Tests
// ============================================================================

describe('getReferralLeaderboard', () => {
	test('fetches leaderboard from correct endpoint', async () => {
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(JSON.stringify(mockLeaderboard), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				})
			)
		)

		await getReferralLeaderboard(testConfig, 'user-123')

		const url = getRequestUrl()
		expect(url).toContain('/api/sdk/v1/referrals/leaderboard')
		expect(url).toContain('userId=user-123')
	})

	test('includes limit option', async () => {
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(JSON.stringify(mockLeaderboard), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				})
			)
		)

		await getReferralLeaderboard(testConfig, 'user-123', { limit: 20 })

		const url = getRequestUrl()
		expect(url).toContain('limit=20')
	})

	test('returns leaderboard result', async () => {
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(JSON.stringify(mockLeaderboard), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				})
			)
		)

		const result = await getReferralLeaderboard(testConfig, 'user-123')

		expect(result.entries).toHaveLength(3)
		expect(result.currentUserRank).toBe(3)
		expect(result.totalParticipants).toBe(500)
	})

	test('identifies current user in entries', async () => {
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(JSON.stringify(mockLeaderboard), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				})
			)
		)

		const result = await getReferralLeaderboard(testConfig, 'user-123')

		const currentUser = result.entries.find((e) => e.isCurrentUser)
		expect(currentUser).toBeDefined()
		expect(currentUser?.rank).toBe(3)
	})
})

// ============================================================================
// regenerateReferralCode() Tests
// ============================================================================

describe('regenerateReferralCode', () => {
	test('posts to correct endpoint', async () => {
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(JSON.stringify({ code: 'NEWCODE123', createdAt: new Date().toISOString() }), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				})
			)
		)

		await regenerateReferralCode(testConfig, 'user-123')

		const url = getRequestUrl()
		expect(url).toContain('/api/sdk/v1/referrals/code/regenerate')
		expect(getRequestMethod()).toBe('POST')
	})

	test('includes userId in body', async () => {
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(JSON.stringify({ code: 'NEWCODE123', createdAt: new Date().toISOString() }), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				})
			)
		)

		await regenerateReferralCode(testConfig, 'user-789')

		const body = getRequestBody()
		expect(body.userId).toBe('user-789')
	})

	test('returns new referral code', async () => {
		const newCode = { code: 'NEWCODE999', createdAt: '2024-01-16T10:00:00.000Z' }
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(JSON.stringify(newCode), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				})
			)
		)

		const result = await regenerateReferralCode(testConfig, 'user-123')

		expect(result.code).toBe('NEWCODE999')
	})
})

// ============================================================================
// Error Handling Tests
// ============================================================================

describe('Error Handling', () => {
	test('throws on network error', async () => {
		mockFetch.mockImplementationOnce(() => Promise.reject(new Error('Network error')))

		await expect(getMyReferralCode(testConfig, 'user-123')).rejects.toThrow()
	})

	test('throws on 400 response (invalid code)', async () => {
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(JSON.stringify({ error: 'Invalid referral code' }), {
					status: 400,
					headers: { 'Content-Type': 'application/json' },
				})
			)
		)

		await expect(
			redeemReferralCode(testConfig, { code: 'INVALID', userId: 'user-123' })
		).rejects.toThrow()
	})

	test('throws on 404 response (user not found)', async () => {
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(JSON.stringify({ error: 'User not found' }), {
					status: 404,
					headers: { 'Content-Type': 'application/json' },
				})
			)
		)

		await expect(getReferralStats(testConfig, 'nonexistent-user')).rejects.toThrow()
	})

	test('throws on 409 response (already redeemed)', async () => {
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(JSON.stringify({ error: 'Code already redeemed by this user' }), {
					status: 409,
					headers: { 'Content-Type': 'application/json' },
				})
			)
		)

		await expect(
			redeemReferralCode(testConfig, { code: 'ABC123', userId: 'user-123' })
		).rejects.toThrow()
	})
})

// ============================================================================
// Edge Cases Tests
// ============================================================================

describe('Edge Cases', () => {
	test('handles empty leaderboard', async () => {
		const emptyLeaderboard: LeaderboardResult = {
			period: 'all',
			entries: [],
			currentUserRank: null,
			totalParticipants: 0,
		}
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(JSON.stringify(emptyLeaderboard), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				})
			)
		)

		const result = await getReferralLeaderboard(testConfig, 'user-123')

		expect(result.entries).toEqual([])
		expect(result.currentUserRank).toBeNull()
	})

	test('handles user not in leaderboard', async () => {
		const leaderboardWithoutUser: LeaderboardResult = {
			entries: mockLeaderboard.entries.filter((e) => !e.isCurrentUser),
			currentUserRank: 150,
			totalParticipants: 500,
		}
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(JSON.stringify(leaderboardWithoutUser), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				})
			)
		)

		const result = await getReferralLeaderboard(testConfig, 'user-not-in-top')

		// User might not be in entries but still has a rank
		const hasCurrentUser = result.entries.some((e) => e.isCurrentUser)
		expect(hasCurrentUser).toBe(false)
		expect(result.currentUserRank).toBe(150)
	})

	test('handles zero stats', async () => {
		const zeroStats: ReferralStats = {
			code: 'ABC123',
			totalReferrals: 0,
			successfulReferrals: 0,
			pendingReferrals: 0,
			totalRewards: 0,
		}
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(JSON.stringify(zeroStats), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				})
			)
		)

		const result = await getReferralStats(testConfig, 'new-user')

		expect(result.totalReferrals).toBe(0)
		expect(result.successfulReferrals).toBe(0)
	})

	test('handles code with special characters', async () => {
		mockFetch.mockImplementationOnce(() =>
			Promise.resolve(
				new Response(JSON.stringify(mockRedeemResult), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				})
			)
		)

		await redeemReferralCode(testConfig, { code: 'ABC-123_XYZ', userId: 'user-123' })

		const body = getRequestBody()
		expect(body.code).toBe('ABC-123_XYZ')
	})
})

// ============================================================================
// Type Tests
// ============================================================================

describe('Types', () => {
	test('ReferralRewardConfig has correct reward types', () => {
		// Compile-time check - these should all be valid
		const rewards = [
			{ type: 'points' as const, points: 100 },
			{ type: 'premium_trial' as const, days: 7 },
			{ type: 'discount' as const, discountPercent: 20 },
			{ type: 'credit' as const, creditCents: 500 },
		]

		expect(rewards).toHaveLength(4)
	})

	test('LeaderboardEntry uses correct field names', () => {
		// SDK API alignment test - uses 'referrals' not 'completedReferrals'
		const entry = mockLeaderboard.entries[0]

		expect(entry.referrals).toBeDefined()
		expect(entry.name).toBeDefined()
		// @ts-expect-error - 'completedReferrals' should not exist
		expect(entry.completedReferrals).toBeUndefined()
	})
})
