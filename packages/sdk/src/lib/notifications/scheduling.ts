/**
 * Notification Scheduling Utilities
 *
 * Schedule notifications with support for one-time, recurring, and relative timing.
 *
 * @example
 * ```typescript
 * import {
 *   createSchedule,
 *   getNextOccurrence,
 *   parseRecurrenceRule,
 * } from '@sylphx/platform-sdk/notifications'
 *
 * // Schedule one-time notification
 * const schedule = createSchedule({
 *   type: 'once',
 *   sendAt: '2024-12-25T10:00:00Z',
 *   notification: { title: 'Merry Christmas!' },
 * })
 *
 * // Recurring: every day at 9am
 * const daily = createSchedule({
 *   type: 'recurring',
 *   recurrence: { frequency: 'day', hours: [9], minutes: [0] },
 *   notification: { title: 'Daily reminder' },
 * })
 *
 * // Relative: 1 hour after signup
 * const onboarding = createSchedule({
 *   type: 'relative',
 *   delay: { value: 1, unit: 'hours' },
 *   notification: { title: 'Complete your profile!' },
 * })
 * ```
 */

import type {
	ScheduledNotification,
	ScheduleType,
	RecurrenceRule,
	PushNotification,
	NotificationChannel,
} from './types'

// ============================================================================
// Schedule Creation
// ============================================================================

/**
 * Create a scheduled notification
 *
 * @param config - Schedule configuration
 * @returns Scheduled notification object
 */
export function createSchedule(config: {
	target: string
	notification: PushNotification
	channels?: NotificationChannel[]
	type?: ScheduleType
	sendAt?: string | Date
	delay?: { value: number; unit: 'minutes' | 'hours' | 'days' }
	recurrence?: RecurrenceRule
	timezone?: string
}): ScheduledNotification {
	const {
		target,
		notification,
		channels = ['push'],
		type = 'once',
		sendAt,
		delay,
		recurrence,
		timezone = 'UTC',
	} = config

	const now = new Date().toISOString()
	const id = generateScheduleId()

	// Calculate next run
	let nextRunAt: string | undefined

	if (type === 'once' && sendAt) {
		nextRunAt = sendAt instanceof Date ? sendAt.toISOString() : sendAt
	} else if (type === 'recurring' && recurrence) {
		const next = getNextRecurrence(recurrence, new Date(), timezone)
		nextRunAt = next?.toISOString()
	} else if (type === 'relative' && delay) {
		// For relative, next run is calculated when triggered
		nextRunAt = undefined
	}

	return {
		id,
		target,
		type,
		notification,
		channels,
		sendAt: type === 'once' ? nextRunAt : undefined,
		delay: type === 'relative' ? delay : undefined,
		recurrence: type === 'recurring' ? recurrence : undefined,
		timezone,
		status: 'scheduled',
		createdAt: now,
		nextRunAt,
		runCount: 0,
	}
}

/**
 * Generate a unique schedule ID
 */
function generateScheduleId(): string {
	return `sched_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

// ============================================================================
// Recurrence Calculation
// ============================================================================

/**
 * Get the next occurrence of a recurring schedule
 *
 * @param rule - Recurrence rule
 * @param after - Start searching after this date
 * @param timezone - Timezone for day/hour calculations
 * @returns Next occurrence date or null if no more occurrences
 */
export function getNextRecurrence(
	rule: RecurrenceRule,
	after: Date = new Date(),
	timezone: string = 'UTC'
): Date | null {
	const { frequency, interval = 1, endDate, maxOccurrences } = rule

	// Check end conditions
	if (endDate && new Date(endDate) <= after) {
		return null
	}

	// Get next candidate based on frequency
	let next = new Date(after.getTime() + 1000) // Start 1 second after 'after'

	switch (frequency) {
		case 'minute':
			next = getNextMinuteOccurrence(next, rule, interval)
			break
		case 'hour':
			next = getNextHourOccurrence(next, rule, interval)
			break
		case 'day':
			next = getNextDayOccurrence(next, rule, interval, timezone)
			break
		case 'week':
			next = getNextWeekOccurrence(next, rule, interval, timezone)
			break
		case 'month':
			next = getNextMonthOccurrence(next, rule, interval, timezone)
			break
		case 'year':
			next = getNextYearOccurrence(next, rule, interval, timezone)
			break
	}

	// Apply hour/minute constraints
	if (rule.hours?.length) {
		while (!rule.hours.includes(next.getUTCHours())) {
			next.setUTCHours(next.getUTCHours() + 1)
			next.setUTCMinutes(0)
			next.setUTCSeconds(0)
		}
	}

	if (rule.minutes?.length) {
		while (!rule.minutes.includes(next.getUTCMinutes())) {
			next.setUTCMinutes(next.getUTCMinutes() + 1)
			next.setUTCSeconds(0)
		}
	}

	// Final end date check
	if (endDate && next > new Date(endDate)) {
		return null
	}

	return next
}

function getNextMinuteOccurrence(date: Date, rule: RecurrenceRule, interval: number): Date {
	const next = new Date(date)
	next.setUTCSeconds(0)
	next.setUTCMilliseconds(0)

	// Round up to next minute boundary
	if (date.getUTCSeconds() > 0 || date.getUTCMilliseconds() > 0) {
		next.setUTCMinutes(next.getUTCMinutes() + 1)
	}

	// Apply interval
	const minutesSinceEpoch = Math.floor(next.getTime() / 60000)
	const remainder = minutesSinceEpoch % interval
	if (remainder > 0) {
		next.setUTCMinutes(next.getUTCMinutes() + (interval - remainder))
	}

	return next
}

function getNextHourOccurrence(date: Date, rule: RecurrenceRule, interval: number): Date {
	const next = new Date(date)
	next.setUTCMinutes(rule.minutes?.[0] ?? 0)
	next.setUTCSeconds(0)
	next.setUTCMilliseconds(0)

	// If past the target minute, move to next hour
	if (next <= date) {
		next.setUTCHours(next.getUTCHours() + 1)
	}

	// Apply interval
	const hoursSinceEpoch = Math.floor(next.getTime() / 3600000)
	const remainder = hoursSinceEpoch % interval
	if (remainder > 0) {
		next.setUTCHours(next.getUTCHours() + (interval - remainder))
	}

	return next
}

function getNextDayOccurrence(
	date: Date,
	rule: RecurrenceRule,
	interval: number,
	timezone: string
): Date {
	const next = new Date(date)
	next.setUTCHours(rule.hours?.[0] ?? 0)
	next.setUTCMinutes(rule.minutes?.[0] ?? 0)
	next.setUTCSeconds(0)
	next.setUTCMilliseconds(0)

	// If past target time today, move to tomorrow
	if (next <= date) {
		next.setUTCDate(next.getUTCDate() + 1)
	}

	// Apply interval
	const baseDate = new Date('2000-01-01T00:00:00Z')
	const daysSinceBase = Math.floor((next.getTime() - baseDate.getTime()) / 86400000)
	const remainder = daysSinceBase % interval
	if (remainder > 0) {
		next.setUTCDate(next.getUTCDate() + (interval - remainder))
	}

	return next
}

function getNextWeekOccurrence(
	date: Date,
	rule: RecurrenceRule,
	interval: number,
	timezone: string
): Date {
	const next = new Date(date)
	next.setUTCHours(rule.hours?.[0] ?? 0)
	next.setUTCMinutes(rule.minutes?.[0] ?? 0)
	next.setUTCSeconds(0)
	next.setUTCMilliseconds(0)

	const targetDays = rule.daysOfWeek ?? [1] // Default to Monday

	// Find next matching day of week
	for (let i = 0; i < 7; i++) {
		const dayOfWeek = next.getUTCDay()
		if (targetDays.includes(dayOfWeek) && next > date) {
			return next
		}
		next.setUTCDate(next.getUTCDate() + 1)
	}

	// Apply interval for weeks
	if (interval > 1) {
		next.setUTCDate(next.getUTCDate() + (interval - 1) * 7)
	}

	return next
}

function getNextMonthOccurrence(
	date: Date,
	rule: RecurrenceRule,
	interval: number,
	timezone: string
): Date {
	const next = new Date(date)
	next.setUTCDate(rule.daysOfMonth?.[0] ?? 1)
	next.setUTCHours(rule.hours?.[0] ?? 0)
	next.setUTCMinutes(rule.minutes?.[0] ?? 0)
	next.setUTCSeconds(0)
	next.setUTCMilliseconds(0)

	// If past target day this month, move to next month
	if (next <= date) {
		next.setUTCMonth(next.getUTCMonth() + 1)
	}

	// Apply interval
	if (interval > 1) {
		const baseMonth = date.getUTCMonth()
		const monthsSinceBase = next.getUTCMonth() - baseMonth
		const remainder = monthsSinceBase % interval
		if (remainder > 0) {
			next.setUTCMonth(next.getUTCMonth() + (interval - remainder))
		}
	}

	return next
}

function getNextYearOccurrence(
	date: Date,
	rule: RecurrenceRule,
	interval: number,
	timezone: string
): Date {
	const next = new Date(date)
	next.setUTCMonth(0) // January
	next.setUTCDate(rule.daysOfMonth?.[0] ?? 1)
	next.setUTCHours(rule.hours?.[0] ?? 0)
	next.setUTCMinutes(rule.minutes?.[0] ?? 0)
	next.setUTCSeconds(0)
	next.setUTCMilliseconds(0)

	// If past target day this year, move to next year
	if (next <= date) {
		next.setUTCFullYear(next.getUTCFullYear() + 1)
	}

	// Apply interval
	if (interval > 1) {
		const yearsSinceBase = next.getUTCFullYear() - 2000
		const remainder = yearsSinceBase % interval
		if (remainder > 0) {
			next.setUTCFullYear(next.getUTCFullYear() + (interval - remainder))
		}
	}

	return next
}

// ============================================================================
// Recurrence Rule Helpers
// ============================================================================

/**
 * Parse a cron-like expression to recurrence rule
 *
 * @param expression - Cron expression (minute hour day month dayOfWeek)
 * @returns Recurrence rule
 *
 * @example
 * ```typescript
 * const rule = parseCronExpression('0 9 * * 1-5') // 9am weekdays
 * const rule = parseCronExpression('30 * * * *')  // Every hour at :30
 * ```
 */
export function parseCronExpression(expression: string): RecurrenceRule {
	const parts = expression.trim().split(/\s+/)

	if (parts.length !== 5) {
		throw new Error('Invalid cron expression: expected 5 parts')
	}

	const [minute, hour, dayOfMonth, month, dayOfWeek] = parts

	const rule: RecurrenceRule = {
		frequency: 'minute', // Will be determined below
	}

	// Parse minutes
	if (minute !== '*') {
		rule.minutes = parseCronField(minute, 0, 59)
	}

	// Parse hours
	if (hour !== '*') {
		rule.hours = parseCronField(hour, 0, 23)
	}

	// Parse days of month
	if (dayOfMonth !== '*') {
		rule.daysOfMonth = parseCronField(dayOfMonth, 1, 31)
	}

	// Parse days of week
	if (dayOfWeek !== '*') {
		rule.daysOfWeek = parseCronField(dayOfWeek, 0, 6)
	}

	// Determine frequency
	if (dayOfMonth !== '*' || rule.daysOfMonth) {
		rule.frequency = 'month'
	} else if (dayOfWeek !== '*' || rule.daysOfWeek) {
		rule.frequency = 'week'
	} else if (hour !== '*' || rule.hours) {
		rule.frequency = 'day'
	} else if (minute !== '*' || rule.minutes) {
		rule.frequency = 'hour'
	}

	return rule
}

/**
 * Parse a cron field into array of values
 */
function parseCronField(field: string, min: number, max: number): number[] {
	const values: number[] = []

	for (const part of field.split(',')) {
		if (part.includes('-')) {
			// Range (e.g., 1-5)
			const [start, end] = part.split('-').map(Number)
			for (let i = start; i <= end; i++) {
				if (i >= min && i <= max) values.push(i)
			}
		} else if (part.includes('/')) {
			// Step (e.g., */5)
			const [range, step] = part.split('/')
			const stepNum = parseInt(step, 10)
			const startNum = range === '*' ? min : parseInt(range, 10)
			for (let i = startNum; i <= max; i += stepNum) {
				values.push(i)
			}
		} else {
			// Single value
			const num = parseInt(part, 10)
			if (!isNaN(num) && num >= min && num <= max) {
				values.push(num)
			}
		}
	}

	return [...new Set(values)].sort((a, b) => a - b)
}

/**
 * Convert recurrence rule to human-readable description
 *
 * @param rule - Recurrence rule
 * @returns Human-readable description
 */
export function describeRecurrence(rule: RecurrenceRule): string {
	const parts: string[] = []

	// Frequency
	const interval = rule.interval ?? 1
	if (interval === 1) {
		parts.push(`Every ${rule.frequency}`)
	} else {
		parts.push(`Every ${interval} ${rule.frequency}s`)
	}

	// Days of week
	if (rule.daysOfWeek?.length) {
		const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
		const dayNames = rule.daysOfWeek.map(d => days[d])
		parts.push(`on ${dayNames.join(', ')}`)
	}

	// Days of month
	if (rule.daysOfMonth?.length) {
		parts.push(`on day ${rule.daysOfMonth.join(', ')}`)
	}

	// Time
	if (rule.hours?.length && rule.minutes?.length) {
		const time = `${rule.hours[0].toString().padStart(2, '0')}:${rule.minutes[0].toString().padStart(2, '0')}`
		parts.push(`at ${time}`)
	} else if (rule.hours?.length) {
		parts.push(`at ${rule.hours.join(', ')} o'clock`)
	}

	// End date
	if (rule.endDate) {
		parts.push(`until ${new Date(rule.endDate).toLocaleDateString()}`)
	}

	return parts.join(' ')
}

// ============================================================================
// Delay Calculation
// ============================================================================

/**
 * Calculate absolute time from relative delay
 *
 * @param delay - Delay configuration
 * @param from - Start time (default: now)
 * @returns Absolute time
 */
export function calculateDelayedTime(
	delay: { value: number; unit: 'minutes' | 'hours' | 'days' },
	from: Date = new Date()
): Date {
	const result = new Date(from)

	switch (delay.unit) {
		case 'minutes':
			result.setMinutes(result.getMinutes() + delay.value)
			break
		case 'hours':
			result.setHours(result.getHours() + delay.value)
			break
		case 'days':
			result.setDate(result.getDate() + delay.value)
			break
	}

	return result
}
