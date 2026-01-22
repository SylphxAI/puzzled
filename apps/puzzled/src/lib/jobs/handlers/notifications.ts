/**
 * Notification Job Handlers
 *
 * Placeholder handlers for notification-related jobs.
 * These can be expanded when the workflow endpoints are fully migrated.
 */

import type { JobHandler } from '../handlers'

/**
 * Daily reminder handler
 *
 * Sends daily reminder notifications to all users.
 */
export const dailyReminderHandler: JobHandler = async (payload, context) => {
	const type = (payload.type as string) || 'all'
	console.log(`[DailyReminder] Starting ${type} notifications (jobId: ${context.jobId})`)

	// TODO: Implement notification logic
	// For now, just log and return success
	console.log(`[DailyReminder] Would send ${type} notifications`)

	return {
		success: true,
		data: { type, message: 'Notifications would be sent' },
	}
}

/**
 * Streak-at-risk handler
 *
 * Sends notifications to users whose streaks are about to expire.
 */
export const streakAtRiskHandler: JobHandler = async (_payload, context) => {
	console.log(`[StreakAtRisk] Starting notifications (jobId: ${context.jobId})`)

	// TODO: Implement streak-at-risk notification logic
	console.log('[StreakAtRisk] Would send streak-at-risk notifications')

	return {
		success: true,
		data: { message: 'Streak-at-risk notifications would be sent' },
	}
}

/**
 * Win-back emails handler
 *
 * Sends win-back emails to churned users.
 */
export const winBackEmailsHandler: JobHandler = async (_payload, context) => {
	console.log(`[WinBackEmails] Starting campaign (jobId: ${context.jobId})`)

	// TODO: Implement win-back email logic
	console.log('[WinBackEmails] Would send win-back emails')

	return {
		success: true,
		data: { message: 'Win-back emails would be sent' },
	}
}
