/**
 * Notifications Routes
 *
 * Handles push notification preferences and settings.
 * Push subscriptions are managed by the Platform SDK.
 * This router manages app-specific notification preferences.
 */

import { OpenAPIHono, z } from '@hono/zod-openapi'
import { HTTPException } from 'hono/http-exception'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { notificationPreferences } from '@/lib/db/schema'
import { authMiddleware, authRateLimitMiddleware } from '../middleware'
import type { PuzzledAuthEnv } from '../types'

// ==========================================
// Schemas
// ==========================================

const UpdatePushPreferencesBodySchema = z.object({
	pushEnabled: z.boolean().optional(),
	pushDailyReminder: z.boolean().optional(),
	pushStreakAlert: z.boolean().optional(),
	pushNewGames: z.boolean().optional(),
	dailyReminderTime: z
		.string()
		.regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:mm)')
		.optional(),
})

const UpdateEmailPreferencesBodySchema = z.object({
	emailEnabled: z.boolean().optional(),
	emailWeeklyDigest: z.boolean().optional(),
	emailMarketing: z.boolean().optional(),
})

// ==========================================
// Router
// ==========================================

const notificationsRoutes = new OpenAPIHono<PuzzledAuthEnv>()

// GET /preferences - authenticated
notificationsRoutes.get('/preferences', authMiddleware, async (c) => {
	const user = c.get('user')

	const [prefs] = await db
		.select()
		.from(notificationPreferences)
		.where(eq(notificationPreferences.userId, user.id))
		.limit(1)

	if (!prefs) {
		return c.json({
			pushEnabled: true,
			pushDailyReminder: true,
			pushStreakAlert: true,
			pushNewGames: true,
			dailyReminderTime: '09:00',
			emailEnabled: true,
			emailWeeklyDigest: true,
			emailMarketing: true,
		})
	}

	return c.json({
		pushEnabled: prefs.pushEnabled,
		pushDailyReminder: prefs.pushDailyReminder,
		pushStreakAlert: prefs.pushStreakAlert,
		pushNewGames: prefs.pushNewGames,
		dailyReminderTime: prefs.dailyReminderTime ?? '09:00',
		emailEnabled: prefs.emailEnabled,
		emailWeeklyDigest: prefs.emailWeeklyDigest,
		emailMarketing: prefs.emailMarketing,
	})
})

// PUT /push-preferences - authenticated + rate limited
notificationsRoutes.put('/push-preferences', authRateLimitMiddleware, async (c) => {
	const body = await c.req.json()
	const parsed = UpdatePushPreferencesBodySchema.safeParse(body)
	if (!parsed.success) {
		throw new HTTPException(400, { message: 'Invalid request body' })
	}
	const input = parsed.data
	const user = c.get('user')

	const [updated] = await db
		.insert(notificationPreferences)
		.values({
			userId: user.id,
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

	return c.json({
		success: true,
		preferences: {
			pushEnabled: updated.pushEnabled,
			pushDailyReminder: updated.pushDailyReminder,
			pushStreakAlert: updated.pushStreakAlert,
			pushNewGames: updated.pushNewGames,
			dailyReminderTime: updated.dailyReminderTime,
		},
	})
})

// PUT /email-preferences - authenticated + rate limited
notificationsRoutes.put('/email-preferences', authRateLimitMiddleware, async (c) => {
	const body = await c.req.json()
	const parsed = UpdateEmailPreferencesBodySchema.safeParse(body)
	if (!parsed.success) {
		throw new HTTPException(400, { message: 'Invalid request body' })
	}
	const input = parsed.data
	const user = c.get('user')

	const [updated] = await db
		.insert(notificationPreferences)
		.values({
			userId: user.id,
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

	return c.json({
		success: true,
		preferences: {
			emailEnabled: updated.emailEnabled,
			emailWeeklyDigest: updated.emailWeeklyDigest,
			emailMarketing: updated.emailMarketing,
		},
	})
})

export { notificationsRoutes }
