/**
 * SDK-Integrated Analytics
 *
 * Uses the Sylphx Platform SDK's analytics service for server-side
 * event tracking, deduplication, and billing.
 *
 * This complements the client-side PostHog tracking with:
 * - Server-side validation
 * - Event deduplication
 * - Platform-level analytics (funnels, cohorts)
 * - Usage-based billing integration
 */

'use client'

import { useCallback } from 'react'
import { useAnalytics } from '@sylphx/platform-sdk/react'
import type { PuzzleDifficulty } from '@/games/types'

// ==========================================
// Types
// ==========================================

export interface GameStartEvent {
	game: string
	mode: 'daily' | 'archive' | 'practice'
	difficulty?: PuzzleDifficulty
	puzzleId?: string
}

export interface GameCompleteEvent {
	game: string
	status: 'won' | 'lost'
	attempts: number
	timeSpentMs: number
	score?: number
	mode: 'daily' | 'archive' | 'practice'
	difficulty?: PuzzleDifficulty
	puzzleId?: string
}

export interface AchievementEvent {
	achievementId: string
	achievementName: string
	category: string
	points: number
}

export interface StreakEvent {
	streakType: 'daily' | 'weekly'
	streakCount: number
	isNewRecord: boolean
}

// ==========================================
// Hook
// ==========================================

/**
 * Hook for SDK-integrated game analytics
 *
 * Usage:
 * ```tsx
 * const { trackGameStart, trackGameComplete, trackAchievement } = useGameAnalytics()
 *
 * // When game starts
 * trackGameStart({ game: 'word-guess', mode: 'daily' })
 *
 * // When game ends
 * trackGameComplete({ game: 'word-guess', status: 'won', attempts: 3, timeSpentMs: 45000, score: 150 })
 * ```
 */
export function useGameAnalytics() {
	const { track, error: analyticsError } = useAnalytics()

	const trackGameStart = useCallback(
		(event: GameStartEvent) => {
			track('game_started', {
				game_slug: event.game,
				mode: event.mode,
				difficulty: event.difficulty,
				puzzle_id: event.puzzleId,
			})
		},
		[track],
	)

	const trackGameComplete = useCallback(
		(event: GameCompleteEvent) => {
			track('game_completed', {
				game_slug: event.game,
				status: event.status,
				attempts: event.attempts,
				time_spent_ms: event.timeSpentMs,
				score: event.score,
				mode: event.mode,
				difficulty: event.difficulty,
				puzzle_id: event.puzzleId,
			})

			// Also track win/loss specifically for funnel analysis
			if (event.status === 'won') {
				track('game_won', {
					game_slug: event.game,
					attempts: event.attempts,
					time_spent_ms: event.timeSpentMs,
					score: event.score,
				})
			} else {
				track('game_lost', {
					game_slug: event.game,
					attempts: event.attempts,
					time_spent_ms: event.timeSpentMs,
				})
			}
		},
		[track],
	)

	const trackAchievement = useCallback(
		(event: AchievementEvent) => {
			track('achievement_unlocked', {
				achievement_id: event.achievementId,
				achievement_name: event.achievementName,
				category: event.category,
				points: event.points,
			})
		},
		[track],
	)

	const trackStreak = useCallback(
		(event: StreakEvent) => {
			track('streak_updated', {
				streak_type: event.streakType,
				streak_count: event.streakCount,
				is_new_record: event.isNewRecord,
			})

			// Track milestone streaks separately
			if (event.streakCount === 7 || event.streakCount === 30 || event.streakCount === 100) {
				track('streak_milestone', {
					streak_type: event.streakType,
					milestone: event.streakCount,
				})
			}
		},
		[track],
	)

	const trackSubscription = useCallback(
		(action: 'started' | 'cancelled' | 'upgraded' | 'downgraded', planId: string) => {
			track(`subscription_${action}`, {
				plan_id: planId,
			})
		},
		[track],
	)

	const trackFeatureUsed = useCallback(
		(feature: string, properties?: Record<string, unknown>) => {
			track('feature_used', {
				feature,
				...properties,
			})
		},
		[track],
	)

	return {
		trackGameStart,
		trackGameComplete,
		trackAchievement,
		trackStreak,
		trackSubscription,
		trackFeatureUsed,
		analyticsError,
	}
}
