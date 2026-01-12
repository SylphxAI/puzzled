/**
 * Notifications Router
 *
 * Handles push notification preferences and settings.
 * Push subscriptions are managed by the Platform SDK.
 * This router manages app-specific notification preferences.
 */

import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/lib/db'
import { notificationPreferences } from '@/lib/db/schema'
import { protectedProcedure, protectedRateLimitedProcedure, router } from '../trpc'

// ==========================================
// Schemas
// ==========================================

const updatePushPreferencesSchema = z.object({
	pushEnabled: z.boolean().optional(),
	pushDailyReminder: z.boolean().optional(),
	pushStreakAlert: z.boolean().optional(),
	pushNewGames: z.boolean().optional(),
	dailyReminderTime: z
		.string()
		.regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:mm)')
		.optional(),
})

const updateEmailPreferencesSchema = z.object({
	emailEnabled: z.boolean().optional(),
	emailWeeklyDigest: z.boolean().optional(),
	emailMarketing: z.boolean().optional(),
})

// ==========================================
// Router
// ==========================================

export const notificationsRouter = router({
	/**
	 * Get notification preferences for the current user
	 */
	getPreferences: protectedProcedure.query(async ({ ctx }) => {
		const [prefs] = await db
			.select()
			.from(notificationPreferences)
			.where(eq(notificationPreferences.userId, ctx.user.id))
			.limit(1)

		// Return defaults if no preferences exist
		if (!prefs) {
			return {
				// Push
				pushEnabled: true,
				pushDailyReminder: true,
				pushStreakAlert: true,
				pushNewGames: true,
				dailyReminderTime: '09:00',
				// Email
				emailEnabled: true,
				emailWeeklyDigest: true,
				emailMarketing: true,
			}
		}

		return {
			// Push
			pushEnabled: prefs.pushEnabled,
			pushDailyReminder: prefs.pushDailyReminder,
			pushStreakAlert: prefs.pushStreakAlert,
			pushNewGames: prefs.pushNewGames,
			dailyReminderTime: prefs.dailyReminderTime ?? '09:00',
			// Email
			emailEnabled: prefs.emailEnabled,
			emailWeeklyDigest: prefs.emailWeeklyDigest,
			emailMarketing: prefs.emailMarketing,
		}
	}),

	/**
	 * Update push notification preferences
	 */
	updatePushPreferences: protectedRateLimitedProcedure
		.input(updatePushPreferencesSchema)
		.mutation(async ({ ctx, input }) => {
			const [updated] = await db
				.insert(notificationPreferences)
				.values({
					userId: ctx.user.id,
					pushEnabled: input.pushEnabled ?? true,
					pushDailyReminder: input.pushDailyReminder ?? true,
					pushStreakAlert: input.pushStreakAlert ?? true,
					pushNewGames: input.pushNewGames ?? true,
					dailyReminderTime: input.dailyReminderTime ?? '09:00',
					updatedAt: new Date(),
				})
				.onConflictDoUpdate({
					target: notificationPreferences.userId,
					set: {
						...(input.pushEnabled !== undefined && { pushEnabled: input.pushEnabled }),
						...(input.pushDailyReminder !== undefined && {
							pushDailyReminder: input.pushDailyReminder,
						}),
						...(input.pushStreakAlert !== undefined && { pushStreakAlert: input.pushStreakAlert }),
						...(input.pushNewGames !== undefined && { pushNewGames: input.pushNewGames }),
						...(input.dailyReminderTime !== undefined && {
							dailyReminderTime: input.dailyReminderTime,
						}),
						updatedAt: new Date(),
					},
				})
				.returning()

			return {
				success: true,
				preferences: {
					pushEnabled: updated.pushEnabled,
					pushDailyReminder: updated.pushDailyReminder,
					pushStreakAlert: updated.pushStreakAlert,
					pushNewGames: updated.pushNewGames,
					dailyReminderTime: updated.dailyReminderTime,
				},
			}
		}),

	/**
	 * Update email notification preferences
	 */
	updateEmailPreferences: protectedRateLimitedProcedure
		.input(updateEmailPreferencesSchema)
		.mutation(async ({ ctx, input }) => {
			const [updated] = await db
				.insert(notificationPreferences)
				.values({
					userId: ctx.user.id,
					emailEnabled: input.emailEnabled ?? true,
					emailWeeklyDigest: input.emailWeeklyDigest ?? true,
					emailMarketing: input.emailMarketing ?? true,
					updatedAt: new Date(),
				})
				.onConflictDoUpdate({
					target: notificationPreferences.userId,
					set: {
						...(input.emailEnabled !== undefined && { emailEnabled: input.emailEnabled }),
						...(input.emailWeeklyDigest !== undefined && {
							emailWeeklyDigest: input.emailWeeklyDigest,
						}),
						...(input.emailMarketing !== undefined && { emailMarketing: input.emailMarketing }),
						updatedAt: new Date(),
					},
				})
				.returning()

			return {
				success: true,
				preferences: {
					emailEnabled: updated.emailEnabled,
					emailWeeklyDigest: updated.emailWeeklyDigest,
					emailMarketing: updated.emailMarketing,
				},
			}
		}),
})
