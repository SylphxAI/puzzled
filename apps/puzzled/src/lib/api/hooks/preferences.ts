'use client'

/**
 * Puzzled API hooks - Notification preferences domain (sole Connect, ADR-170).
 */

import { type UseQueryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
	getNotificationPreferences,
	updateEmailPreferences,
	updatePushPreferences,
} from '@/lib/connect/preferences-client'
import { type ApiError, queryKeys, toApiError } from './shared'

// ==========================================
// Notification preferences (sole Connect)
// ==========================================

export type NotificationPreferencesResponse = {
	pushEnabled: boolean
	pushDailyReminder: boolean
	pushStreakAlert: boolean
	pushNewGames: boolean
	dailyReminderTime: string
	emailEnabled: boolean
	emailWeeklyDigest: boolean
	emailMarketing: boolean
}

export function useNotificationPreferences(
	options?: Omit<
		UseQueryOptions<NotificationPreferencesResponse, ApiError>,
		'queryKey' | 'queryFn'
	>,
) {
	return useQuery({
		queryKey: queryKeys.notificationPreferences(),
		queryFn: async () => {
			try {
				const p = await getNotificationPreferences()
				return {
					pushEnabled: p.pushEnabled,
					pushDailyReminder: p.pushDailyReminder,
					pushStreakAlert: p.pushStreakAlert,
					pushNewGames: p.pushNewGames,
					dailyReminderTime: p.dailyReminderTime,
					emailEnabled: p.emailEnabled,
					emailWeeklyDigest: p.emailWeeklyDigest,
					emailMarketing: p.emailMarketing,
				}
			} catch (e) {
				throw toApiError(e, 'PREFERENCES_FAILED')
			}
		},
		...options,
	})
}

export function useUpdatePushPreferences() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async (input: Record<string, unknown>) => {
			try {
				const p = await updatePushPreferences({
					pushEnabled: typeof input.pushEnabled === 'boolean' ? input.pushEnabled : undefined,
					pushDailyReminder:
						typeof input.pushDailyReminder === 'boolean' ? input.pushDailyReminder : undefined,
					pushStreakAlert:
						typeof input.pushStreakAlert === 'boolean' ? input.pushStreakAlert : undefined,
					pushNewGames: typeof input.pushNewGames === 'boolean' ? input.pushNewGames : undefined,
					dailyReminderTime:
						typeof input.dailyReminderTime === 'string' ? input.dailyReminderTime : undefined,
				})
				return {
					pushEnabled: p.pushEnabled,
					pushDailyReminder: p.pushDailyReminder,
					pushStreakAlert: p.pushStreakAlert,
					pushNewGames: p.pushNewGames,
					dailyReminderTime: p.dailyReminderTime,
					emailEnabled: p.emailEnabled,
					emailWeeklyDigest: p.emailWeeklyDigest,
					emailMarketing: p.emailMarketing,
				}
			} catch (e) {
				throw toApiError(e, 'PREFERENCES_UPDATE_FAILED')
			}
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.notificationPreferences() })
		},
	})
}

export function useUpdateEmailPreferences() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async (input: Record<string, unknown>) => {
			try {
				const p = await updateEmailPreferences({
					emailEnabled: typeof input.emailEnabled === 'boolean' ? input.emailEnabled : undefined,
					emailWeeklyDigest:
						typeof input.emailWeeklyDigest === 'boolean' ? input.emailWeeklyDigest : undefined,
					emailMarketing:
						typeof input.emailMarketing === 'boolean' ? input.emailMarketing : undefined,
				})
				return {
					pushEnabled: p.pushEnabled,
					pushDailyReminder: p.pushDailyReminder,
					pushStreakAlert: p.pushStreakAlert,
					pushNewGames: p.pushNewGames,
					dailyReminderTime: p.dailyReminderTime,
					emailEnabled: p.emailEnabled,
					emailWeeklyDigest: p.emailWeeklyDigest,
					emailMarketing: p.emailMarketing,
				}
			} catch (e) {
				throw toApiError(e, 'PREFERENCES_UPDATE_FAILED')
			}
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.notificationPreferences() })
		},
	})
}
