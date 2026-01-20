/**
 * Engagement React Hooks
 *
 * Hooks for streaks, leaderboards, and achievements.
 * Uses config defined in app code (Code First approach).
 */

'use client'

import { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type {
	AchievementDefinition,
	AchievementUnlockEvent,
	EngagementConfig,
	LeaderboardDefinition,
	LeaderboardEntry,
	LeaderboardQueryOptions,
	LeaderboardResult,
	RecordActivityResult,
	StreakDefinition,
	StreakState,
	SubmitScoreResult,
	UserAchievement,
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
	/** Streak definition (from config) */
	definition: StreakDefinition | null
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
 *   } = useStreak('daily-challenge')
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
export function useStreak(streakId: string): UseStreakReturn {
	const ctx = useEngagementContext()
	const [state, setState] = useState<StreakState | null>(null)
	const [isLoading, setIsLoading] = useState(true)
	const [error, setError] = useState<Error | null>(null)

	// Get definition from config
	const definition = useMemo(() => {
		return ctx.engagementConfig?.streaks?.find((s) => s.id === streakId) ?? null
	}, [ctx.engagementConfig, streakId])

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

	// Record activity
	const recordActivity = useCallback(
		async (metadata?: Record<string, unknown>): Promise<RecordActivityResult> => {
			const result = await ctx.recordStreakActivity(streakId, metadata)
			setState(result.streak)
			return result
		},
		[ctx, streakId]
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
		definition,
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
	/** Leaderboard definition (from config) */
	definition: LeaderboardDefinition | null
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
 * @example
 * ```tsx
 * function Leaderboard() {
 *   const {
 *     entries,
 *     currentUserEntry,
 *     totalParticipants,
 *     submitScore,
 *     isLoading,
 *   } = useLeaderboard('high-scores', { limit: 10 })
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
	options?: LeaderboardQueryOptions
): UseLeaderboardReturn {
	const ctx = useEngagementContext()
	const [data, setData] = useState<LeaderboardResult | null>(null)
	const [isLoading, setIsLoading] = useState(true)
	const [error, setError] = useState<Error | null>(null)

	// Get definition from config
	const definition = useMemo(() => {
		return ctx.engagementConfig?.leaderboards?.find((l) => l.id === leaderboardId) ?? null
	}, [ctx.engagementConfig, leaderboardId])

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

	// Submit score
	const submitScore = useCallback(
		async (value: number, metadata?: Record<string, unknown>): Promise<SubmitScoreResult> => {
			const result = await ctx.submitScore(leaderboardId, value, metadata)
			// Refresh to get updated rankings
			await refresh()
			return result
		},
		[ctx, leaderboardId, refresh]
	)

	return {
		definition,
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
	/** All achievement definitions (from config) */
	definitions: AchievementDefinition[]
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
	/** Total points earned */
	totalPoints: number
	/** Get achievement by ID with definition */
	getAchievement: (id: string) => {
		definition: AchievementDefinition | null
		state: UserAchievement | null
	}
	/** Manually unlock an achievement */
	unlock: (achievementId: string) => Promise<AchievementUnlockEvent>
	/** Increment progress */
	incrementProgress: (achievementId: string, amount: number) => Promise<UserAchievement>
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
 * @example
 * ```tsx
 * function AchievementsPage() {
 *   const {
 *     definitions,
 *     unlocked,
 *     locked,
 *     totalPoints,
 *     getAchievement,
 *     recentUnlock,
 *     dismissRecentUnlock,
 *   } = useAchievements()
 *
 *   return (
 *     <div>
 *       <h2>Achievements ({unlocked.length}/{definitions.length})</h2>
 *       <p>Points: {totalPoints}</p>
 *
 *       <h3>Unlocked</h3>
 *       {unlocked.map(a => {
 *         const { definition } = getAchievement(a.achievementId)
 *         return (
 *           <AchievementCard key={a.achievementId} achievement={definition} unlocked />
 *         )
 *       })}
 *
 *       <h3>In Progress</h3>
 *       {locked.filter(a => a.progress > 0).map(a => {
 *         const { definition } = getAchievement(a.achievementId)
 *         return (
 *           <AchievementCard
 *             key={a.achievementId}
 *             achievement={definition}
 *             progress={a.progress}
 *             target={a.target}
 *           />
 *         )
 *       })}
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

	// Get definitions from config
	const definitions = useMemo(() => {
		return ctx.engagementConfig?.achievements ?? []
	}, [ctx.engagementConfig])

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
	const totalPoints = useMemo(() => {
		return unlocked.reduce((sum, a) => {
			const def = definitions.find((d) => d.id === a.achievementId)
			return sum + (def?.points ?? 0)
		}, 0)
	}, [unlocked, definitions])

	// Get achievement by ID
	const getAchievement = useCallback(
		(id: string) => {
			const definition = definitions.find((d) => d.id === id) ?? null
			const state = achievements.find((a) => a.achievementId === id) ?? null
			return { definition, state }
		},
		[definitions, achievements]
	)

	// Unlock achievement
	const unlock = useCallback(
		async (achievementId: string): Promise<AchievementUnlockEvent> => {
			const result = await ctx.unlockAchievement(achievementId)
			if (result.isNew) {
				setRecentUnlock(result)
			}
			await refresh()
			return result
		},
		[ctx, refresh]
	)

	// Increment progress
	const incrementProgress = useCallback(
		async (achievementId: string, amount: number): Promise<UserAchievement> => {
			const result = await ctx.incrementAchievementProgress(achievementId, amount)
			if (result.unlocked) {
				const definition = definitions.find((d) => d.id === achievementId)
				if (definition) {
					setRecentUnlock({
						achievement: definition,
						userAchievement: result,
						isNew: true,
					})
				}
			}
			await refresh()
			return result
		},
		[ctx, definitions, refresh]
	)

	// Dismiss recent unlock
	const dismissRecentUnlock = useCallback(() => {
		setRecentUnlock(null)
	}, [])

	return {
		definitions,
		achievements,
		isLoading,
		error,
		unlocked,
		locked,
		totalPoints,
		getAchievement,
		unlock,
		incrementProgress,
		refresh,
		recentUnlock,
		dismissRecentUnlock,
	}
}

// ============================================================================
// useEngagementConfig
// ============================================================================

/**
 * Hook to access the engagement config (for debugging/admin)
 *
 * @example
 * ```tsx
 * function EngagementDebug() {
 *   const { config, isSynced, lastSyncAt } = useEngagementConfig()
 *
 *   return (
 *     <pre>
 *       Streaks: {config?.streaks?.length ?? 0}
 *       Leaderboards: {config?.leaderboards?.length ?? 0}
 *       Achievements: {config?.achievements?.length ?? 0}
 *       Synced: {isSynced ? 'Yes' : 'No'}
 *     </pre>
 *   )
 * }
 * ```
 */
export function useEngagementConfig(): {
	config: EngagementConfig | null
	isSynced: boolean
	lastSyncAt: string | null
} {
	const ctx = useEngagementContext()

	return {
		config: ctx.engagementConfig ?? null,
		isSynced: ctx.engagementConfigSynced ?? false,
		lastSyncAt: ctx.engagementLastSyncAt ?? null,
	}
}
