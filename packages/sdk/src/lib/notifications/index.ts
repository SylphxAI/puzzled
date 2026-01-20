/**
 * Notifications Module
 *
 * Scheduling, templates, and utilities for push notifications.
 *
 * @example
 * ```typescript
 * import {
 *   createSchedule,
 *   createTemplate,
 *   renderNotification,
 *   parseCronExpression,
 *   COMMON_TEMPLATES,
 * } from '@sylphx/platform-sdk/notifications'
 *
 * // Create a scheduled notification
 * const schedule = createSchedule({
 *   target: 'user:123',
 *   type: 'recurring',
 *   recurrence: { frequency: 'day', hours: [9], minutes: [0] },
 *   notification: { title: 'Daily reminder', body: 'Check your tasks!' },
 * })
 *
 * // Use a template
 * const notification = renderNotification(COMMON_TEMPLATES.welcome, {
 *   userName: 'John',
 * })
 *
 * // Parse cron expression
 * const rule = parseCronExpression('0 9 * * 1-5') // 9am weekdays
 * ```
 *
 * @packageDocumentation
 */

// ============================================================================
// Types
// ============================================================================

export type {
	// Notification types
	NotificationChannel,
	NotificationPriority,
	NotificationStatus,
	NotificationCategory,
	// Push notification types
	PushNotification,
	NotificationAction,
	PushSubscription,
	PushSendOptions,
	// Scheduling types
	ScheduleType,
	RecurrenceRule,
	ScheduledNotification,
	// Template types
	TemplateVariable,
	NotificationTemplate,
	RenderedNotification,
	// Preferences types
	NotificationPreferences,
	// Delivery types
	DeliveryResult,
	BatchDeliveryResult,
} from './types'

// ============================================================================
// Scheduling
// ============================================================================

export {
	createSchedule,
	getNextRecurrence,
	parseCronExpression,
	describeRecurrence,
	calculateDelayedTime,
} from './scheduling'

// ============================================================================
// Templates
// ============================================================================

export {
	createTemplate,
	renderNotification,
	validateTemplate,
	extractVariables,
	COMMON_TEMPLATES,
} from './templates'

// ============================================================================
// Utilities
// ============================================================================

/**
 * Check if a notification should be sent based on user preferences
 *
 * @param notification - Notification to check
 * @param preferences - User preferences
 * @param channel - Target channel
 * @returns Whether the notification should be sent
 */
export function shouldSendNotification(
	notification: { category?: string; priority?: string },
	preferences: {
		enabled: boolean
		channels?: Record<string, boolean>
		categories?: Record<string, boolean>
		quietHours?: { enabled: boolean; start: string; end: string; timezone?: string }
	},
	channel: string
): boolean {
	// Global kill switch
	if (!preferences.enabled) {
		return false
	}

	// Channel disabled
	if (preferences.channels && preferences.channels[channel] === false) {
		return false
	}

	// Category disabled (transactional always gets through)
	const category = notification.category ?? 'transactional'
	if (category !== 'transactional') {
		if (preferences.categories && preferences.categories[category] === false) {
			return false
		}
	}

	// Quiet hours (high priority bypasses)
	if (preferences.quietHours?.enabled && notification.priority !== 'high') {
		if (isInQuietHours(preferences.quietHours)) {
			return false
		}
	}

	return true
}

/**
 * Check if current time is within quiet hours
 */
function isInQuietHours(quietHours: {
	start: string
	end: string
	timezone?: string
}): boolean {
	const now = new Date()

	// Get current time in target timezone
	const formatter = new Intl.DateTimeFormat('en-US', {
		hour: '2-digit',
		minute: '2-digit',
		hour12: false,
		timeZone: quietHours.timezone ?? 'UTC',
	})

	const currentTime = formatter.format(now)
	const [currentHour, currentMinute] = currentTime.split(':').map(Number)
	const currentMinutes = currentHour * 60 + currentMinute

	// Parse start and end times
	const [startHour, startMinute] = quietHours.start.split(':').map(Number)
	const [endHour, endMinute] = quietHours.end.split(':').map(Number)

	const startMinutes = startHour * 60 + startMinute
	const endMinutes = endHour * 60 + endMinute

	// Handle overnight quiet hours (e.g., 22:00 - 07:00)
	if (startMinutes > endMinutes) {
		return currentMinutes >= startMinutes || currentMinutes < endMinutes
	}

	return currentMinutes >= startMinutes && currentMinutes < endMinutes
}

/**
 * Group notifications for digest delivery
 *
 * @param notifications - Notifications to group
 * @returns Grouped notifications by category
 */
export function groupNotificationsForDigest<T extends { category?: string }>(
	notifications: T[]
): Record<string, T[]> {
	const groups: Record<string, T[]> = {}

	for (const notification of notifications) {
		const category = notification.category ?? 'other'
		if (!groups[category]) {
			groups[category] = []
		}
		groups[category].push(notification)
	}

	return groups
}

/**
 * Create a notification payload for web push
 *
 * @param notification - Push notification content
 * @returns Web push payload
 */
export function createWebPushPayload(notification: {
	title: string
	body: string
	icon?: string
	badge?: string
	image?: string
	url?: string
	tag?: string
	data?: Record<string, unknown>
	actions?: Array<{ action: string; title: string; icon?: string }>
	requireInteraction?: boolean
	silent?: boolean
	timestamp?: number
	vibrate?: number[]
}): string {
	return JSON.stringify({
		notification: {
			title: notification.title,
			body: notification.body,
			icon: notification.icon,
			badge: notification.badge,
			image: notification.image,
			tag: notification.tag,
			requireInteraction: notification.requireInteraction,
			silent: notification.silent,
			timestamp: notification.timestamp,
			vibrate: notification.vibrate,
			actions: notification.actions,
			data: {
				...notification.data,
				url: notification.url,
			},
		},
	})
}

/**
 * Estimate notification delivery time based on schedule
 *
 * @param schedule - Scheduled notification
 * @param count - Number of future deliveries to estimate
 * @returns Array of estimated delivery times
 */
export function estimateDeliveryTimes(
	schedule: {
		type: string
		sendAt?: string
		delay?: { value: number; unit: 'minutes' | 'hours' | 'days' }
		recurrence?: {
			frequency: string
			interval?: number
			daysOfWeek?: number[]
			daysOfMonth?: number[]
			hours?: number[]
			minutes?: number[]
			endDate?: string
		}
		timezone?: string
	},
	count: number = 5
): Date[] {
	const times: Date[] = []

	if (schedule.type === 'once' && schedule.sendAt) {
		times.push(new Date(schedule.sendAt))
		return times
	}

	if (schedule.type === 'relative' && schedule.delay) {
		const now = new Date()
		const ms = schedule.delay.value * (
			schedule.delay.unit === 'minutes' ? 60000 :
			schedule.delay.unit === 'hours' ? 3600000 :
			86400000
		)
		times.push(new Date(now.getTime() + ms))
		return times
	}

	if (schedule.type === 'recurring' && schedule.recurrence) {
		// Import dynamically to avoid circular dependency
		const { getNextRecurrence } = require('./scheduling')
		let current = new Date()

		for (let i = 0; i < count; i++) {
			const next = getNextRecurrence(
				schedule.recurrence,
				current,
				schedule.timezone ?? 'UTC'
			)
			if (!next) break
			times.push(next)
			current = next
		}
	}

	return times
}
