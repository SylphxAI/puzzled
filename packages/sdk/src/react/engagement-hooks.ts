/**
 * Engagement React Hooks
 *
 * Hooks for streaks, leaderboards, and achievements.
 *
 * ## Architecture (ADR-004)
 *
 * Engagement uses **Auto-Discovery + Console Override**:
 * - Entities are auto-discovered when first referenced
 * - No config required - just use the hooks
 * - Console can override values without deployment
 *
 * ## React Query Integration
 *
 * All hooks use React Query for:
 * - Automatic caching and deduplication
 * - Stale-while-revalidate updates
 * - Background refetching
 */

'use client'

import { useCallback, useContext, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type {
	AchievementUnlockEvent,
	LeaderboardEntry,
	LeaderboardQueryOptions,
	LeaderboardResult,
	RecordActivityResult,
	StreakState,
	SubmitScoreResult,
	UserAchievement,
	StreakDefaults,
	LeaderboardDefaults,
	AchievementDefaults,
} from '../lib/engagement/types'
import { PlatformContext } from './platform-context'

// ============================================================================
// Context Hook
// ============================================================================

function useEngagementContext() {
	const context = useContext(PlatformContext)
	if (!context) {
		throw new Error('Engagement hooks must be used within a SylphxProvider')
	}
	return context
}

/**
 * Safe version that returns null if no provider (for SSR/prerendering)
 */
function useEngagementContextSafe() {
	return useContext(PlatformContext)
}

// ============================================================================
// useStreak
// ============================================================================

export interface UseStreakReturn {
	/** Current streak state */
	state: StreakState | null
	/** Whether loading */
	isLoading: boolean
	/** Error if any */
	error: Error | null
	/** Current streak value */
	current: number
	/** Longest streak ever */
	longest: number
	/** Whether streak can be recovered */
	canRecover: boolean
	/** Time remaining until expiry (ms) */
	timeRemainingMs: number | null
	/** User's stored timezone preference (IANA timezone) */
	userTimezone: string | null
	/** Record activity to extend streak */
	recordActivity: (metadata?: Record<string, unknown>) => Promise<RecordActivityResult>
	/** Recover streak (if within grace period) */
	recover: () => Promise<{ success: boolean; streak: StreakState }>
	/** Refresh streak state */
	refresh: () => Promise<void>
}

/** Options for useStreak hook */
export interface UseStreakOptions {
	/** Optional inline defaults for auto-discovery */
	defaults?: StreakDefaults
	/** User's IANA timezone (e.g., 'America/New_York') for calculating streak expiry at user's local midnight */
	userTimezone?: string
}

/**
 * Hook for managing a streak
 *
 * If the streak doesn't exist, it will be auto-discovered with the provided defaults.
 * Console can override any values without deployment.
 *
 * @param streakId - Streak identifier
 * @param options - Optional options including defaults for auto-discovery and user timezone
 *
 * @example
 * ```tsx
 * function DailyStreakCard() {
 *   const {
 *     current,
 *     longest,
 *     timeRemainingMs,
 *     canRecover,
 *     recordActivity,
 *     recover,
 *     userTimezone,
 *   } = useStreak('daily-challenge', {
 *     defaults: {
 *       name: 'Daily Challenge',
 *       frequency: 'daily',
 *       gracePeriodHours: 12,
 *     },
 *     userTimezone: 'America/New_York', // Streak expires at user's local midnight
 *   })
 *
 *   const handleComplete = async () => {
 *     const result = await recordActivity()
 *     if (result.newPersonalBest) {
 *       showConfetti()
 *     }
 *   }
 *
 *   return (
 *     <div>
 *       <p>Current streak: {current} 🔥</p>
 *       <p>Best: {longest}</p>
 *       {timeRemainingMs && (
 *         <p>Expires in: {formatTime(timeRemainingMs)}</p>
 *       )}
 *       {canRecover && (
 *         <button onClick={recover}>Recover Streak</button>
 *       )}
 *     </div>
 *   )
 * }
 * ```
 */
export function useStreak(streakId: string, options?: UseStreakOptions): UseStreakReturn {
	const { defaults, userTimezone } = options ?? {}
	const ctx = useEngagementContext()

	// React Query for streak data
	const streakQuery = useQuery({
		queryKey: ['sylphx', ctx.appId, 'streak', streakId, userTimezone],
		queryFn: () => ctx.getStreak(streakId, userTimezone),
		enabled: !!ctx.user,
		staleTime: 60 * 1000, // 1 min - streaks can change frequently
	})

	const state = streakQuery.data ?? null

	// Record activity (passes inline defaults for auto-discovery and timezone)
	const recordActivity = useCallback(
		async (metadata?: Record<string, unknown>): Promise<RecordActivityResult> => {
			const result = await ctx.recordStreakActivity(streakId, metadata, defaults, userTimezone)
			// Update cache with new streak state
			ctx.queryClient.setQueryData(
				['sylphx', ctx.appId, 'streak', streakId, userTimezone],
				result.streak
			)
			return result
		},
		[ctx, streakId, defaults, userTimezone]
	)

	// Recover streak (passes timezone)
	const recover = useCallback(async (): Promise<{ success: boolean; streak: StreakState }> => {
		const result = await ctx.recoverStreak(streakId, userTimezone)
		if (result.success) {
			ctx.queryClient.setQueryData(
				['sylphx', ctx.appId, 'streak', streakId, userTimezone],
				result.streak
			)
		}
		return result
	}, [ctx, streakId, userTimezone])

	// Refresh via React Query invalidation
	const refresh = useCallback(async () => {
		await ctx.queryClient.invalidateQueries({
			queryKey: ['sylphx', ctx.appId, 'streak', streakId],
		})
	}, [ctx, streakId])

	return {
		state,
		isLoading: streakQuery.isLoading,
		error: streakQuery.error as Error | null,
		current: state?.current ?? 0,
		longest: state?.longest ?? 0,
		canRecover: state?.canRecover ?? false,
		timeRemainingMs: state?.timeRemainingMs ?? null,
		userTimezone: state?.userTimezone ?? null,
		recordActivity,
		recover,
		refresh,
	}
}

// ============================================================================
// useLeaderboard
// ============================================================================

export interface UseLeaderboardReturn {
	/** Leaderboard data */
	data: LeaderboardResult | null
	/** Whether loading */
	isLoading: boolean
	/** Error if any */
	error: Error | null
	/** Top entries */
	entries: LeaderboardEntry[]
	/** Current user's entry */
	currentUserEntry: LeaderboardEntry | null
	/** Total participants */
	totalParticipants: number
	/** Submit a score */
	submitScore: (value: number, metadata?: Record<string, unknown>) => Promise<SubmitScoreResult>
	/** Refresh leaderboard */
	refresh: () => Promise<void>
}

/**
 * Hook for managing a leaderboard
 *
 * If the leaderboard doesn't exist, it will be auto-discovered with the provided defaults.
 * Console can override any values without deployment.
 *
 * @param leaderboardId - Leaderboard identifier
 * @param options - Query options (limit, offset, etc.)
 * @param defaults - Optional inline defaults for auto-discovery
 *
 * @example
 * ```tsx
 * function Leaderboard() {
 *   const {
 *     entries,
 *     currentUserEntry,
 *     totalParticipants,
 *     submitScore,
 *     isLoading,
 *   } = useLeaderboard('high-scores', { limit: 10 }, {
 *     name: 'High Scores',
 *     sortDirection: 'desc',
 *     resetPeriod: 'weekly',
 *   })
 *
 *   if (isLoading) return <Spinner />
 *
 *   return (
 *     <div>
 *       <h2>Top Players ({totalParticipants} total)</h2>
 *       {entries.map(entry => (
 *         <div key={entry.rank} className={entry.isCurrentUser ? 'highlight' : ''}>
 *           #{entry.rank} {entry.displayName}: {entry.value}
 *         </div>
 *       ))}
 *       {currentUserEntry && !entries.find(e => e.isCurrentUser) && (
 *         <div>
 *           ... Your rank: #{currentUserEntry.rank}
 *         </div>
 *       )}
 *     </div>
 *   )
 * }
 * ```
 */
export function useLeaderboard(
	leaderboardId: string,
	options?: LeaderboardQueryOptions,
	defaults?: LeaderboardDefaults
): UseLeaderboardReturn {
	const ctx = useEngagementContext()

	// Stable key for options
	const optionsKey = JSON.stringify(options ?? {})

	// React Query for leaderboard data
	const leaderboardQuery = useQuery({
		queryKey: ['sylphx', ctx.appId, 'leaderboard', leaderboardId, optionsKey],
		queryFn: () => ctx.getLeaderboard(leaderboardId, options),
		staleTime: 2 * 60 * 1000, // 2 min - leaderboards change moderately
	})

	const data = leaderboardQuery.data ?? null

	// Submit score (passes inline defaults for auto-discovery)
	const submitScore = useCallback(
		async (value: number, metadata?: Record<string, unknown>): Promise<SubmitScoreResult> => {
			const result = await ctx.submitScore(leaderboardId, value, metadata, defaults)
			// Invalidate to get updated rankings
			void ctx.queryClient.invalidateQueries({
				queryKey: ['sylphx', ctx.appId, 'leaderboard', leaderboardId],
			})
			return result
		},
		[ctx, leaderboardId, defaults]
	)

	// Refresh via React Query invalidation
	const refresh = useCallback(async () => {
		await ctx.queryClient.invalidateQueries({
			queryKey: ['sylphx', ctx.appId, 'leaderboard', leaderboardId],
		})
	}, [ctx, leaderboardId])

	return {
		data,
		isLoading: leaderboardQuery.isLoading,
		error: leaderboardQuery.error as Error | null,
		entries: data?.entries ?? [],
		currentUserEntry: data?.currentUserEntry ?? null,
		totalParticipants: data?.totalParticipants ?? 0,
		submitScore,
		refresh,
	}
}

// ============================================================================
// useAchievements
// ============================================================================

export interface UseAchievementsReturn {
	/** User achievement states */
	achievements: UserAchievement[]
	/** Whether loading */
	isLoading: boolean
	/** Error if any */
	error: Error | null
	/** Unlocked achievements */
	unlocked: UserAchievement[]
	/** Locked achievements (with progress) */
	locked: UserAchievement[]
	/** Get achievement state by ID */
	getAchievement: (id: string) => UserAchievement | null
	/** Manually unlock an achievement (with optional inline defaults for auto-discovery) */
	unlock: (achievementId: string, defaults?: AchievementDefaults) => Promise<AchievementUnlockEvent>
	/** Increment progress (with optional inline defaults for auto-discovery) */
	incrementProgress: (
		achievementId: string,
		amount: number,
		defaults?: AchievementDefaults
	) => Promise<UserAchievement>
	/** Refresh achievements */
	refresh: () => Promise<void>
	/** Recently unlocked (for toast) */
	recentUnlock: AchievementUnlockEvent | null
	/** Dismiss recent unlock */
	dismissRecentUnlock: () => void
}

/**
 * Hook for managing achievements
 *
 * Achievements are auto-discovered with inline defaults when unlock/incrementProgress is called.
 * Console can override any values without deployment.
 *
 * @example
 * ```tsx
 * function AchievementsPage() {
 *   const {
 *     achievements,
 *     unlocked,
 *     locked,
 *     unlock,
 *     incrementProgress,
 *     recentUnlock,
 *     dismissRecentUnlock,
 *   } = useAchievements()
 *
 *   // Unlock with inline defaults (auto-discovered if doesn't exist)
 *   const handleFirstPurchase = async () => {
 *     await unlock('first-purchase', {
 *       name: 'First Purchase',
 *       description: 'Made your first purchase',
 *       points: 100,
 *       tier: 'bronze',
 *     })
 *   }
 *
 *   // Increment progress with inline defaults
 *   const handleCollect = async () => {
 *     await incrementProgress('collector-100', 1, {
 *       name: 'Collector',
 *       description: 'Collect 100 items',
 *       type: 'incremental',
 *       target: 100,
 *     })
 *   }
 *
 *   return (
 *     <div>
 *       <h2>Achievements ({unlocked.length}/{achievements.length})</h2>
 *
 *       <h3>Unlocked</h3>
 *       {unlocked.map(a => (
 *         <AchievementCard key={a.achievementId} achievement={a} unlocked />
 *       ))}
 *
 *       <h3>In Progress</h3>
 *       {locked.filter(a => a.progress > 0).map(a => (
 *         <AchievementCard
 *           key={a.achievementId}
 *           achievement={a}
 *           progress={a.progress}
 *           target={a.target}
 *         />
 *       ))}
 *
 *       {recentUnlock && (
 *         <AchievementToast
 *           achievement={recentUnlock.achievement}
 *           onDismiss={dismissRecentUnlock}
 *         />
 *       )}
 *     </div>
 *   )
 * }
 * ```
 */
export function useAchievements(): UseAchievementsReturn {
	const ctx = useEngagementContext()
	const [recentUnlock, setRecentUnlock] = useState<AchievementUnlockEvent | null>(null)

	// React Query for achievements data
	const achievementsQuery = useQuery({
		queryKey: ['sylphx', ctx.appId, 'achievements'],
		queryFn: () => ctx.getAchievements(),
		enabled: !!ctx.user,
		staleTime: 5 * 60 * 1000, // 5 min - achievements don't change often
	})

	const achievements = achievementsQuery.data ?? []

	// Computed values
	const unlocked = useMemo(() => achievements.filter((a) => a.unlocked), [achievements])
	const locked = useMemo(() => achievements.filter((a) => !a.unlocked), [achievements])

	// Get achievement by ID
	const getAchievement = useCallback(
		(id: string): UserAchievement | null => {
			return achievements.find((a) => a.achievementId === id) ?? null
		},
		[achievements]
	)

	// Unlock achievement (passes inline defaults for auto-discovery)
	const unlock = useCallback(
		async (achievementId: string, defaults?: AchievementDefaults): Promise<AchievementUnlockEvent> => {
			const result = await ctx.unlockAchievement(achievementId, defaults)
			if (result.isNew) {
				setRecentUnlock(result)
			}
			// Invalidate to get updated achievements list
			void ctx.queryClient.invalidateQueries({
				queryKey: ['sylphx', ctx.appId, 'achievements'],
			})
			return result
		},
		[ctx]
	)

	// Increment progress (passes inline defaults for auto-discovery)
	const incrementProgress = useCallback(
		async (achievementId: string, amount: number, defaults?: AchievementDefaults): Promise<UserAchievement> => {
			const result = await ctx.incrementAchievementProgress(achievementId, amount, defaults)
			// Invalidate to get updated achievements list
			void ctx.queryClient.invalidateQueries({
				queryKey: ['sylphx', ctx.appId, 'achievements'],
			})
			return result
		},
		[ctx]
	)

	// Refresh via React Query invalidation
	const refresh = useCallback(async () => {
		await ctx.queryClient.invalidateQueries({
			queryKey: ['sylphx', ctx.appId, 'achievements'],
		})
	}, [ctx])

	// Dismiss recent unlock
	const dismissRecentUnlock = useCallback(() => {
		setRecentUnlock(null)
	}, [])

	return {
		achievements,
		isLoading: achievementsQuery.isLoading,
		error: achievementsQuery.error as Error | null,
		unlocked,
		locked,
		getAchievement,
		unlock,
		incrementProgress,
		refresh,
		recentUnlock,
		dismissRecentUnlock,
	}
}

// ============================================================================
// Safe Versions (for SSR/prerendering)
// ============================================================================

// No-op async function for safe hooks
const noopAsync = async () => {}

/** Safe return type for useStreak when outside provider */
export interface UseSafeStreakReturn {
	state: StreakState | null
	isLoading: boolean
	error: Error | null
	current: number
	longest: number
	canRecover: boolean
	timeRemainingMs: number | null
	userTimezone: string | null
	recordActivity: (metadata?: Record<string, unknown>) => Promise<RecordActivityResult>
	recover: () => Promise<{ success: boolean; streak: StreakState }>
	refresh: () => Promise<void>
	isConfigured: boolean
}

/**
 * SSR-safe version of useStreak
 *
 * Returns safe defaults when called outside SylphxProvider.
 * Use this in components that may render during static generation.
 */
export function useSafeStreak(streakId: string, options?: UseStreakOptions): UseSafeStreakReturn {
	const ctx = useEngagementContextSafe()

	// If no context, return safe defaults
	if (!ctx) {
		return {
			state: null,
			isLoading: false,
			error: null,
			current: 0,
			longest: 0,
			canRecover: false,
			timeRemainingMs: null,
			userTimezone: null,
			recordActivity: noopAsync as unknown as UseSafeStreakReturn['recordActivity'],
			recover: noopAsync as unknown as UseSafeStreakReturn['recover'],
			refresh: noopAsync,
			isConfigured: false,
		}
	}

	const { defaults, userTimezone } = options ?? {}

	// React Query for streak data
	const streakQuery = useQuery({
		queryKey: ['sylphx', ctx.appId, 'streak', streakId, userTimezone],
		queryFn: () => ctx.getStreak(streakId, userTimezone),
		enabled: !!ctx.user,
		staleTime: 60 * 1000,
	})

	const state = streakQuery.data ?? null

	const recordActivity = useCallback(
		async (metadata?: Record<string, unknown>): Promise<RecordActivityResult> => {
			const result = await ctx.recordStreakActivity(streakId, metadata, defaults, userTimezone)
			ctx.queryClient.setQueryData(
				['sylphx', ctx.appId, 'streak', streakId, userTimezone],
				result.streak
			)
			return result
		},
		[ctx, streakId, defaults, userTimezone]
	)

	const recover = useCallback(async (): Promise<{ success: boolean; streak: StreakState }> => {
		const result = await ctx.recoverStreak(streakId, userTimezone)
		if (result.success) {
			ctx.queryClient.setQueryData(
				['sylphx', ctx.appId, 'streak', streakId, userTimezone],
				result.streak
			)
		}
		return result
	}, [ctx, streakId, userTimezone])

	const refresh = useCallback(async () => {
		await ctx.queryClient.invalidateQueries({
			queryKey: ['sylphx', ctx.appId, 'streak', streakId],
		})
	}, [ctx, streakId])

	return {
		state,
		isLoading: streakQuery.isLoading,
		error: streakQuery.error as Error | null,
		current: state?.current ?? 0,
		longest: state?.longest ?? 0,
		canRecover: state?.canRecover ?? false,
		timeRemainingMs: state?.timeRemainingMs ?? null,
		userTimezone: state?.userTimezone ?? null,
		recordActivity,
		recover,
		refresh,
		isConfigured: true,
	}
}

/** Safe return type for useLeaderboard when outside provider */
export interface UseSafeLeaderboardReturn {
	data: LeaderboardResult | null
	isLoading: boolean
	error: Error | null
	entries: LeaderboardEntry[]
	currentUserEntry: LeaderboardEntry | null
	totalParticipants: number
	submitScore: (value: number, metadata?: Record<string, unknown>) => Promise<SubmitScoreResult>
	refresh: () => Promise<void>
	isConfigured: boolean
}

/**
 * SSR-safe version of useLeaderboard
 *
 * Returns safe defaults when called outside SylphxProvider.
 * Use this in components that may render during static generation.
 */
export function useSafeLeaderboard(
	leaderboardId: string,
	options?: LeaderboardQueryOptions,
	defaults?: LeaderboardDefaults
): UseSafeLeaderboardReturn {
	const ctx = useEngagementContextSafe()

	// If no context, return safe defaults
	if (!ctx) {
		return {
			data: null,
			isLoading: false,
			error: null,
			entries: [],
			currentUserEntry: null,
			totalParticipants: 0,
			submitScore: noopAsync as unknown as UseSafeLeaderboardReturn['submitScore'],
			refresh: noopAsync,
			isConfigured: false,
		}
	}

	const optionsKey = JSON.stringify(options ?? {})

	const leaderboardQuery = useQuery({
		queryKey: ['sylphx', ctx.appId, 'leaderboard', leaderboardId, optionsKey],
		queryFn: () => ctx.getLeaderboard(leaderboardId, options),
		staleTime: 2 * 60 * 1000,
	})

	const data = leaderboardQuery.data ?? null

	const submitScore = useCallback(
		async (value: number, metadata?: Record<string, unknown>): Promise<SubmitScoreResult> => {
			const result = await ctx.submitScore(leaderboardId, value, metadata, defaults)
			void ctx.queryClient.invalidateQueries({
				queryKey: ['sylphx', ctx.appId, 'leaderboard', leaderboardId],
			})
			return result
		},
		[ctx, leaderboardId, defaults]
	)

	const refresh = useCallback(async () => {
		await ctx.queryClient.invalidateQueries({
			queryKey: ['sylphx', ctx.appId, 'leaderboard', leaderboardId],
		})
	}, [ctx, leaderboardId])

	return {
		data,
		isLoading: leaderboardQuery.isLoading,
		error: leaderboardQuery.error as Error | null,
		entries: data?.entries ?? [],
		currentUserEntry: data?.currentUserEntry ?? null,
		totalParticipants: data?.totalParticipants ?? 0,
		submitScore,
		refresh,
		isConfigured: true,
	}
}

/** Safe return type for useAchievements when outside provider */
export interface UseSafeAchievementsReturn {
	achievements: UserAchievement[]
	isLoading: boolean
	error: Error | null
	unlocked: UserAchievement[]
	locked: UserAchievement[]
	getAchievement: (id: string) => UserAchievement | null
	unlock: (achievementId: string, defaults?: AchievementDefaults) => Promise<AchievementUnlockEvent>
	incrementProgress: (
		achievementId: string,
		amount: number,
		defaults?: AchievementDefaults
	) => Promise<UserAchievement>
	refresh: () => Promise<void>
	recentUnlock: AchievementUnlockEvent | null
	dismissRecentUnlock: () => void
	isConfigured: boolean
}

/**
 * SSR-safe version of useAchievements
 *
 * Returns safe defaults when called outside SylphxProvider.
 * Use this in components that may render during static generation.
 */
export function useSafeAchievements(): UseSafeAchievementsReturn {
	const ctx = useEngagementContextSafe()
	const [recentUnlock, setRecentUnlock] = useState<AchievementUnlockEvent | null>(null)

	// If no context, return safe defaults
	if (!ctx) {
		return {
			achievements: [],
			isLoading: false,
			error: null,
			unlocked: [],
			locked: [],
			getAchievement: () => null,
			unlock: noopAsync as unknown as UseSafeAchievementsReturn['unlock'],
			incrementProgress: noopAsync as unknown as UseSafeAchievementsReturn['incrementProgress'],
			refresh: noopAsync,
			recentUnlock: null,
			dismissRecentUnlock: () => {},
			isConfigured: false,
		}
	}

	const achievementsQuery = useQuery({
		queryKey: ['sylphx', ctx.appId, 'achievements'],
		queryFn: () => ctx.getAchievements(),
		enabled: !!ctx.user,
		staleTime: 5 * 60 * 1000,
	})

	const achievements = achievementsQuery.data ?? []

	const unlocked = useMemo(() => achievements.filter((a) => a.unlocked), [achievements])
	const locked = useMemo(() => achievements.filter((a) => !a.unlocked), [achievements])

	const getAchievement = useCallback(
		(id: string): UserAchievement | null => {
			return achievements.find((a) => a.achievementId === id) ?? null
		},
		[achievements]
	)

	const unlock = useCallback(
		async (achievementId: string, defaults?: AchievementDefaults): Promise<AchievementUnlockEvent> => {
			const result = await ctx.unlockAchievement(achievementId, defaults)
			if (result.isNew) {
				setRecentUnlock(result)
			}
			void ctx.queryClient.invalidateQueries({
				queryKey: ['sylphx', ctx.appId, 'achievements'],
			})
			return result
		},
		[ctx]
	)

	const incrementProgress = useCallback(
		async (achievementId: string, amount: number, defaults?: AchievementDefaults): Promise<UserAchievement> => {
			const result = await ctx.incrementAchievementProgress(achievementId, amount, defaults)
			void ctx.queryClient.invalidateQueries({
				queryKey: ['sylphx', ctx.appId, 'achievements'],
			})
			return result
		},
		[ctx]
	)

	const refresh = useCallback(async () => {
		await ctx.queryClient.invalidateQueries({
			queryKey: ['sylphx', ctx.appId, 'achievements'],
		})
	}, [ctx])

	const dismissRecentUnlock = useCallback(() => {
		setRecentUnlock(null)
	}, [])

	return {
		achievements,
		isLoading: achievementsQuery.isLoading,
		error: achievementsQuery.error as Error | null,
		unlocked,
		locked,
		getAchievement,
		unlock,
		incrementProgress,
		refresh,
		recentUnlock,
		dismissRecentUnlock,
		isConfigured: true,
	}
}
