'use client'

/**
 * Puzzled API hooks - Stats domain (sole Connect authority, ADR-170).
 */

import { type UseQueryOptions, useQuery } from '@tanstack/react-query'
import { getTodayPercentile, getUserStats } from '@/lib/connect/stats-client'
import { type ApiError, queryKeys, toApiError } from './shared'

// ==========================================
// Stats (sole Connect)
// ==========================================

export type UserStatsEntry = {
	gameSlug: string
	gamesPlayed: number
	gamesWon: number
	currentStreak: number
	maxStreak: number
	totalScore: number
	averageAttempts: number | null
	guessDistribution: Record<string, number> | null
	perfectGames: number
}

export type UserStatsResponse = Record<string, UserStatsEntry>

export function useUserStats(
	options?: Omit<UseQueryOptions<UserStatsResponse, ApiError>, 'queryKey' | 'queryFn'>,
) {
	return useQuery({
		queryKey: queryKeys.userStats(),
		queryFn: async () => {
			try {
				const res = await getUserStats({})
				const out: UserStatsResponse = {}
				for (const g of res.games) {
					out[g.gameSlug] = {
						gameSlug: g.gameSlug,
						gamesPlayed: g.gamesPlayed,
						gamesWon: g.gamesWon,
						currentStreak: 0,
						maxStreak: 0,
						totalScore: g.bestScore,
						averageAttempts: null,
						guessDistribution: null,
						perfectGames: 0,
					}
				}
				return out
			} catch (e) {
				throw toApiError(e, 'USER_STATS_FAILED')
			}
		},
		...options,
	})
}

export type TodayPercentileResponse = {
	percentile: number | null
	totalPlayers: number
}

export function useTodayPercentile(
	params: {
		gameSlug: string
		status: 'won' | 'lost' | 'abandoned'
		attempts?: number
		score?: number
		mistakes?: number
		timeSpentMs?: number
	},
	options?: Omit<UseQueryOptions<TodayPercentileResponse, ApiError>, 'queryKey' | 'queryFn'>,
) {
	return useQuery({
		queryKey: queryKeys.todayPercentile(params),
		queryFn: async () => {
			try {
				const res = await getTodayPercentile({
					gameSlug: params.gameSlug,
					status: params.status,
					attempts: params.attempts,
					score: params.score,
					mistakes: params.mistakes,
					timeSpentMs: params.timeSpentMs,
				})
				return {
					percentile: res.percentile === undefined ? null : Number(res.percentile),
					totalPlayers: Number(res.totalPlayers),
				}
			} catch (e) {
				throw toApiError(e, 'PERCENTILE_FAILED')
			}
		},
		enabled: !!params.gameSlug && !!params.status,
		...options,
	})
}
