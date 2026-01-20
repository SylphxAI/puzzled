/**
 * Notifications Types
 *
 * Type definitions for push notifications, scheduling, and templates.
 */

// ============================================================================
// Notification Types
// ============================================================================

/**
 * Notification channel
 */
export type NotificationChannel = 'push' | 'email' | 'sms' | 'in-app'

/**
 * Notification priority
 */
export type NotificationPriority = 'high' | 'normal' | 'low'

/**
 * Notification status
 */
export type NotificationStatus =
	| 'pending'
	| 'scheduled'
	| 'sent'
	| 'delivered'
	| 'failed'
	| 'cancelled'

/**
 * Notification category for preferences
 */
export type NotificationCategory =
	| 'transactional'  // Critical, always delivered
	| 'marketing'      // Promotional content
	| 'social'         // Social interactions
	| 'updates'        // Product updates
	| 'alerts'         // System alerts
	| 'reminders'      // Scheduled reminders

// ============================================================================
// Push Notification Types
// ============================================================================

/**
 * Push notification payload
 */
export interface PushNotification {
	/** Notification title */
	title: string
	/** Notification body */
	body: string
	/** Icon URL */
	icon?: string
	/** Badge URL (small icon) */
	badge?: string
	/** Image URL (hero image) */
	image?: string
	/** Click action URL */
	url?: string
	/** Custom data payload */
	data?: Record<string, unknown>
	/** Tag for grouping */
	tag?: string
	/** Whether to require interaction */
	requireInteraction?: boolean
	/** Silent notification */
	silent?: boolean
	/** Timestamp for notification */
	timestamp?: number
	/** Action buttons */
	actions?: NotificationAction[]
	/** Vibration pattern (mobile) */
	vibrate?: number[]
	/** TTL in seconds */
	ttl?: number
	/** Priority */
	priority?: NotificationPriority
}

/**
 * Notification action button
 */
export interface NotificationAction {
	/** Action identifier */
	action: string
	/** Button title */
	title: string
	/** Button icon URL */
	icon?: string
}

/**
 * Web push subscription
 */
export interface PushSubscription {
	/** Subscription endpoint URL */
	endpoint: string
	/** Expiration time */
	expirationTime: number | null
	/** Keys for encryption */
	keys: {
		p256dh: string
		auth: string
	}
}

/**
 * Push notification options for sending
 */
export interface PushSendOptions {
	/** Target subscriptions */
	subscriptions: PushSubscription[]
	/** Notification payload */
	notification: PushNotification
	/** VAPID subject (mailto: or URL) */
	vapidSubject?: string
}

// ============================================================================
// Scheduling Types
// ============================================================================

/**
 * Schedule type
 */
export type ScheduleType = 'once' | 'recurring' | 'relative'

/**
 * Recurrence rule
 */
export interface RecurrenceRule {
	/** Frequency */
	frequency: 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year'
	/** Interval (e.g., every 2 weeks) */
	interval?: number
	/** Days of week (0-6, Sunday = 0) */
	daysOfWeek?: number[]
	/** Days of month (1-31) */
	daysOfMonth?: number[]
	/** Hours of day (0-23) */
	hours?: number[]
	/** Minutes (0-59) */
	minutes?: number[]
	/** End date */
	endDate?: string
	/** Maximum occurrences */
	maxOccurrences?: number
}

/**
 * Scheduled notification
 */
export interface ScheduledNotification {
	/** Schedule ID */
	id: string
	/** User ID or topic */
	target: string
	/** Schedule type */
	type: ScheduleType
	/** Notification payload */
	notification: PushNotification
	/** Channels to send on */
	channels: NotificationChannel[]
	/** For 'once': specific time (ISO string) */
	sendAt?: string
	/** For 'relative': delay from event */
	delay?: {
		value: number
		unit: 'minutes' | 'hours' | 'days'
	}
	/** For 'recurring': recurrence rule */
	recurrence?: RecurrenceRule
	/** Timezone for scheduling */
	timezone?: string
	/** Status */
	status: NotificationStatus
	/** Created at */
	createdAt: string
	/** Next scheduled run */
	nextRunAt?: string
	/** Last run at */
	lastRunAt?: string
	/** Run count */
	runCount: number
}

// ============================================================================
// Template Types
// ============================================================================

/**
 * Notification template variable
 */
export interface TemplateVariable {
	name: string
	type: 'string' | 'number' | 'boolean' | 'date' | 'url'
	required?: boolean
	default?: string
	description?: string
}

/**
 * Notification template
 */
export interface NotificationTemplate {
	/** Template ID */
	id: string
	/** Template name */
	name: string
	/** Category */
	category: NotificationCategory
	/** Channels this template supports */
	channels: NotificationChannel[]
	/** Title template */
	title: string
	/** Body template */
	body: string
	/** Icon URL */
	icon?: string
	/** Image URL */
	image?: string
	/** Action URL template */
	url?: string
	/** Template variables */
	variables: TemplateVariable[]
	/** Default priority */
	priority?: NotificationPriority
	/** Default TTL */
	ttl?: number
}

/**
 * Rendered notification from template
 */
export interface RenderedNotification {
	title: string
	body: string
	icon?: string
	image?: string
	url?: string
	data?: Record<string, unknown>
}

// ============================================================================
// Preferences Types
// ============================================================================

/**
 * User notification preferences
 */
export interface NotificationPreferences {
	/** Global enabled/disabled */
	enabled: boolean
	/** Enabled channels */
	channels: {
		push?: boolean
		email?: boolean
		sms?: boolean
		inApp?: boolean
	}
	/** Category preferences */
	categories: {
		[K in NotificationCategory]?: boolean
	}
	/** Quiet hours */
	quietHours?: {
		enabled: boolean
		start: string // HH:MM
		end: string   // HH:MM
		timezone: string
	}
	/** Digest settings */
	digest?: {
		enabled: boolean
		frequency: 'daily' | 'weekly'
		time: string // HH:MM
	}
}

// ============================================================================
// Delivery Types
// ============================================================================

/**
 * Delivery result for a single recipient
 */
export interface DeliveryResult {
	/** Recipient ID */
	recipientId: string
	/** Channel used */
	channel: NotificationChannel
	/** Whether delivered successfully */
	success: boolean
	/** Error message if failed */
	error?: string
	/** Delivery timestamp */
	deliveredAt?: string
}

/**
 * Batch delivery result
 */
export interface BatchDeliveryResult {
	/** Total recipients */
	total: number
	/** Successful deliveries */
	success: number
	/** Failed deliveries */
	failed: number
	/** Individual results */
	results: DeliveryResult[]
}
