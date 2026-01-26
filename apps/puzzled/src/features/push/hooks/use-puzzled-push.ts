'use client'

import { useAnalytics, useNotifications } from '@sylphx/sdk/react'
import { useCallback } from 'react'
import { MINUTE_MS } from '@/lib/constants/time'
import { trpc } from '@/trpc'

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
	pushEnabled: boolean
	pushDailyReminder: boolean
	pushStreakAlert: boolean
	pushNewGames: boolean
	dailyReminderTime: string
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
	} = useNotifications()

	// Fetch preferences from server
	const { data: serverPreferences, refetch: refetchPreferences } =
		trpc.notifications.getPreferences.useQuery(undefined, {
			// Don't refetch too aggressively
			staleTime: 5 * MINUTE_MS,
		})

	// Mutation to update preferences
	const updateMutation = trpc.notifications.updatePushPreferences.useMutation({
		onSuccess: () => {
			refetchPreferences()
		},
	})

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
	 * Get notification preferences from server
	 */
	const preferences: PuzzledNotificationPreferences = {
		pushEnabled: serverPreferences?.pushEnabled ?? true,
		pushDailyReminder: serverPreferences?.pushDailyReminder ?? true,
		pushStreakAlert: serverPreferences?.pushStreakAlert ?? true,
		pushNewGames: serverPreferences?.pushNewGames ?? true,
		dailyReminderTime: serverPreferences?.dailyReminderTime ?? '09:00',
	}

	/**
	 * Update notification preferences on server
	 */
	const updatePreferences = useCallback(
		async (updates: Partial<PuzzledNotificationPreferences>) => {
			await updateMutation.mutateAsync(updates)
			track('push_preferences_updated', {
				...updates,
			})
			return true
		},
		[updateMutation, track],
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
		/** Notification preferences (from server) */
		preferences,
		/** Update notification preferences */
		updatePreferences,
		/** Whether preferences are loading */
		isLoadingPreferences: !serverPreferences,
		/** SDK push preferences (for advanced usage) */
		sdkPreferences,
	}
}
