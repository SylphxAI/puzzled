'use client'

import { useCallback, useMemo } from 'react'
import { usePush, useAnalytics } from '@sylphx/platform-sdk/react'

/**
 * Puzzled-specific notification types
 */
export type PuzzledNotificationType =
	| 'daily_puzzle' // Daily puzzle available
	| 'streak_reminder' // Streak at risk
	| 'streak_milestone' // Streak milestone reached
	| 'achievement' // New achievement unlocked
	| 'friend_challenge' // Friend sent a challenge
	| 'leaderboard' // Leaderboard update

/**
 * Puzzled notification payload
 */
export interface PuzzledNotification {
	type: PuzzledNotificationType
	title: string
	body: string
	/** Game slug if applicable */
	game?: string
	/** URL to navigate to */
	url?: string
	/** Additional data */
	data?: Record<string, unknown>
}

/**
 * Notification preferences for Puzzled
 */
export interface PuzzledNotificationPreferences {
	dailyPuzzle: boolean
	streakReminders: boolean
	achievements: boolean
	friendChallenges: boolean
	leaderboard: boolean
}

const DEFAULT_PREFERENCES: PuzzledNotificationPreferences = {
	dailyPuzzle: true,
	streakReminders: true,
	achievements: true,
	friendChallenges: true,
	leaderboard: false,
}

/**
 * Hook for Puzzled-specific push notification management
 *
 * @example
 * ```tsx
 * function NotificationSettings() {
 *   const {
 *     isSupported,
 *     isEnabled,
 *     requestPermission,
 *     preferences,
 *     updatePreferences
 *   } = usePuzzledPush()
 *
 *   if (!isSupported) return <p>Not supported</p>
 *
 *   return (
 *     <button onClick={requestPermission}>
 *       {isEnabled ? 'Notifications On' : 'Enable Notifications'}
 *     </button>
 *   )
 * }
 * ```
 */
export function usePuzzledPush() {
	const { track } = useAnalytics()
	const {
		isSupported,
		isSubscribed,
		subscribe,
		unsubscribe,
		error,
		preferences: sdkPreferences,
	} = usePush()

	/**
	 * Request push notification permission
	 */
	const requestPermission = useCallback(async () => {
		const success = await subscribe()

		if (success) {
			track('push_enabled', {
				source: 'puzzled',
			})
		}

		return success
	}, [subscribe, track])

	/**
	 * Disable push notifications
	 */
	const disablePush = useCallback(async () => {
		await unsubscribe()
		track('push_disabled', {
			source: 'puzzled',
		})
		return true
	}, [unsubscribe, track])

	/**
	 * Get notification preferences
	 * In a real app, these would be stored server-side
	 */
	const preferences = useMemo<PuzzledNotificationPreferences>(() => {
		// For now, return defaults
		// TODO: Fetch from server when preferences API is available
		return DEFAULT_PREFERENCES
	}, [])

	/**
	 * Update notification preferences
	 * In a real app, this would call the server
	 */
	const updatePreferences = useCallback(
		async (updates: Partial<PuzzledNotificationPreferences>) => {
			// TODO: Call server to update preferences
			track('push_preferences_updated', {
				...updates,
			})
			return true
		},
		[track],
	)

	return {
		/** Whether push notifications are supported in this browser */
		isSupported,
		/** Whether user has enabled push notifications */
		isEnabled: isSubscribed,
		/** Request push notification permission */
		requestPermission,
		/** Disable push notifications */
		disablePush,
		/** Error if any */
		error,
		/** Notification preferences */
		preferences,
		/** Update notification preferences */
		updatePreferences,
		/** SDK push preferences (for advanced usage) */
		sdkPreferences,
	}
}
