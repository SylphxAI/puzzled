'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { getServerUser } from '@/features/auth/server'
import { db } from '@/lib/db'
import {
	type NotificationPreference,
	notificationPreferences,
	type User,
	users,
} from '@/lib/db/schema'
import { captureError } from '@/lib/sentry'

/** Notification preferences subset (SSOT: derived from schema) */
export type NotificationPreferences = Pick<
	NotificationPreference,
	| 'pushEnabled'
	| 'pushDailyReminder'
	| 'pushStreakAlert'
	| 'pushNewGames'
	| 'dailyReminderTime'
	| 'emailEnabled'
	| 'emailWeeklyDigest'
	| 'emailMarketing'
>

/** User preferences subset (SSOT: derived from schema) */
export type UserPreferences = Pick<
	User,
	'timezone' | 'locale' | 'dateFormat' | 'reduceMotion' | 'compactMode'
>

/**
 * Get notification preferences for the current user
 * Uses upsert pattern to avoid race conditions on concurrent access
 */
export async function getNotificationPreferences(): Promise<NotificationPreferences | null> {
	const user = await getServerUser()
	if (!user) return null

	// Atomic upsert: create default if not exists, otherwise return existing
	const [prefs] = await db
		.insert(notificationPreferences)
		.values({ userId: user.id })
		.onConflictDoUpdate({
			target: notificationPreferences.userId,
			set: { updatedAt: new Date() }, // No-op update to return existing row
		})
		.returning()

	return {
		pushEnabled: prefs.pushEnabled,
		pushDailyReminder: prefs.pushDailyReminder,
		pushStreakAlert: prefs.pushStreakAlert,
		pushNewGames: prefs.pushNewGames,
		dailyReminderTime: prefs.dailyReminderTime,
		emailEnabled: prefs.emailEnabled,
		emailWeeklyDigest: prefs.emailWeeklyDigest,
		emailMarketing: prefs.emailMarketing,
	}
}

/**
 * Update notification preferences
 * Uses upsert pattern to avoid race conditions
 */
export async function updateNotificationPreferences(
	updates: Partial<NotificationPreferences>,
): Promise<{ success: boolean; error?: string }> {
	const user = await getServerUser()
	if (!user) {
		return { success: false, error: 'Not authenticated' }
	}

	try {
		// Atomic upsert: create with updates or update existing
		await db
			.insert(notificationPreferences)
			.values({
				userId: user.id,
				...updates,
			})
			.onConflictDoUpdate({
				target: notificationPreferences.userId,
				set: {
					...updates,
					updatedAt: new Date(),
				},
			})

		revalidatePath('/settings/preferences')
		return { success: true }
	} catch (error) {
		captureError(error instanceof Error ? error : new Error(String(error)), {
			tags: { operation: 'update-notification-preferences' },
		})
		return { success: false, error: 'Failed to update preferences' }
	}
}

/**
 * Get user preferences (timezone, locale, dateFormat, appearance)
 */
export async function getUserPreferences(): Promise<UserPreferences | null> {
	const user = await getServerUser()
	if (!user) return null

	const userData = await db.query.users.findFirst({
		where: eq(users.id, user.id),
		columns: {
			timezone: true,
			locale: true,
			dateFormat: true,
			reduceMotion: true,
			compactMode: true,
		},
	})

	if (!userData) return null

	return {
		timezone: userData.timezone,
		locale: userData.locale,
		dateFormat: userData.dateFormat,
		reduceMotion: userData.reduceMotion,
		compactMode: userData.compactMode,
	}
}
