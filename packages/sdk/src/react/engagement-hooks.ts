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
 */

'use client'

import { useCallback, useContext, useEffect, useMemo, useState } from 'react'
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
	/** Record activity to extend streak */
	recordActivity: (metadata?: Record<string, unknown>) => Promise<RecordActivityResult>
	/** Recover streak (if within grace period) */
	recover: () => Promise<{ success: boolean; streak: StreakState }>
	/** Refresh streak state */
	refresh: () => Promise<void>
}

/**
 * Hook for managing a streak
 *
 * If the streak doesn't exist, it will be auto-discovered with the provided defaults.
 * Console can override any values without deployment.
 *
 * @param streakId - Streak identifier
 * @param defaults - Optional inline defaults for auto-discovery
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
 *   } = useStreak('daily-challenge', {
 *     name: 'Daily Challenge',
 *     frequency: 'daily',
 *     gracePeriodHours: 12,
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
export function useStreak(streakId: string, defaults?: StreakDefaults): UseStreakReturn {
	const ctx = useEngagementContext()
	const [state, setState] = useState<StreakState | null>(null)
	const [isLoading, setIsLoading] = useState(true)
	const [error, setError] = useState<Error | null>(null)

	// Fetch streak state
	const refresh = useCallback(async () => {
		if (!ctx.user) {
			setIsLoading(false)
			return
		}

		try {
			setIsLoading(true)
			const streakState = await ctx.getStreak(streakId)
			setState(streakState)
			setError(null)
		} catch (err) {
			setError(err instanceof Error ? err : new Error('Failed to fetch streak'))
		} finally {
			setIsLoading(false)
		}
	}, [ctx, streakId])

	// Initial fetch
	useEffect(() => {
		refresh()
	}, [refresh])

	// Record activity (passes inline defaults for auto-discovery)
	const recordActivity = useCallback(
		async (metadata?: Record<string, unknown>): Promise<RecordActivityResult> => {
			const result = await ctx.recordStreakActivity(streakId, metadata, defaults)
			setState(result.streak)
			return result
		},
		[ctx, streakId, defaults]
	)

	// Recover streak
	const recover = useCallback(async (): Promise<{ success: boolean; streak: StreakState }> => {
		const result = await ctx.recoverStreak(streakId)
		if (result.success) {
			setState(result.streak)
		}
		return result
	}, [ctx, streakId])

	return {
		state,
		isLoading,
		error,
		current: state?.current ?? 0,
		longest: state?.longest ?? 0,
		canRecover: state?.canRecover ?? false,
		timeRemainingMs: state?.timeRemainingMs ?? null,
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
	const [data, setData] = useState<LeaderboardResult | null>(null)
	const [isLoading, setIsLoading] = useState(true)
	const [error, setError] = useState<Error | null>(null)

	// Stable options reference
	const optionsKey = JSON.stringify(options ?? {})

	// Fetch leaderboard
	const refresh = useCallback(async () => {
		try {
			setIsLoading(true)
			const result = await ctx.getLeaderboard(leaderboardId, options)
			setData(result)
			setError(null)
		} catch (err) {
			setError(err instanceof Error ? err : new Error('Failed to fetch leaderboard'))
		} finally {
			setIsLoading(false)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ctx, leaderboardId, optionsKey])

	// Initial fetch
	useEffect(() => {
		refresh()
	}, [refresh])

	// Submit score (passes inline defaults for auto-discovery)
	const submitScore = useCallback(
		async (value: number, metadata?: Record<string, unknown>): Promise<SubmitScoreResult> => {
			const result = await ctx.submitScore(leaderboardId, value, metadata, defaults)
			// Refresh to get updated rankings
			await refresh()
			return result
		},
		[ctx, leaderboardId, refresh, defaults]
	)

	return {
		data,
		isLoading,
		error,
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
	const [achievements, setAchievements] = useState<UserAchievement[]>([])
	const [isLoading, setIsLoading] = useState(true)
	const [error, setError] = useState<Error | null>(null)
	const [recentUnlock, setRecentUnlock] = useState<AchievementUnlockEvent | null>(null)

	// Fetch achievements
	const refresh = useCallback(async () => {
		if (!ctx.user) {
			setIsLoading(false)
			return
		}

		try {
			setIsLoading(true)
			const userAchievements = await ctx.getAchievements()
			setAchievements(userAchievements)
			setError(null)
		} catch (err) {
			setError(err instanceof Error ? err : new Error('Failed to fetch achievements'))
		} finally {
			setIsLoading(false)
		}
	}, [ctx])

	// Initial fetch
	useEffect(() => {
		refresh()
	}, [refresh])

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
			await refresh()
			return result
		},
		[ctx, refresh]
	)

	// Increment progress (passes inline defaults for auto-discovery)
	const incrementProgress = useCallback(
		async (achievementId: string, amount: number, defaults?: AchievementDefaults): Promise<UserAchievement> => {
			const result = await ctx.incrementAchievementProgress(achievementId, amount, defaults)
			await refresh()
			return result
		},
		[ctx, refresh]
	)

	// Dismiss recent unlock
	const dismissRecentUnlock = useCallback(() => {
		setRecentUnlock(null)
	}, [])

	return {
		achievements,
		isLoading,
		error,
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

