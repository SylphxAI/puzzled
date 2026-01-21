/**
 * Email Functions
 *
 * Pure functions for transactional email operations.
 */

import { type SylphxConfig, callApi } from './config'

// ============================================================================
// Types
// ============================================================================

export interface SendEmailOptions {
	/** Recipient email address */
	to: string
	/** Email subject line */
	subject: string
	/** HTML content */
	html: string
	/** Plain text content (optional fallback) */
	text?: string
	/** Reply-to address */
	replyTo?: string
}

export interface SendTemplatedEmailOptions {
	/** Template name: 'welcome', 'verification', 'password_reset', 'security_alert' */
	template: 'welcome' | 'verification' | 'password_reset' | 'security_alert'
	/** Recipient email address */
	to: string
	/** Template variables */
	data?: Record<string, unknown>
}

export interface SendToUserOptions {
	/** User ID to send to */
	userId: string
	/** Email subject line */
	subject: string
	/** HTML content */
	html: string
	/** Plain text content (optional fallback) */
	text?: string
}

export interface ScheduleEmailOptions {
	/** Recipient email address */
	to: string
	/** Recipient name (optional) */
	toName?: string
	/** Email subject line */
	subject: string
	/** HTML content */
	html?: string
	/** Plain text content */
	text?: string
	/** Reply-to address */
	replyTo?: string
	/** From email (defaults to app's configured sender) */
	fromEmail?: string
	/** From name */
	fromName?: string
	/** ISO timestamp for when to send */
	scheduledFor: string
	/** Template key for templated emails */
	templateKey?: string
	/** Template variables */
	templateData?: Record<string, unknown>
	/** Idempotency key to prevent duplicates */
	idempotencyKey?: string
	/** Custom metadata */
	metadata?: Record<string, unknown>
}

export interface ScheduledEmail {
	id: string
	to: string
	toName: string | null
	subject: string
	status: 'pending' | 'queued' | 'sent' | 'cancelled' | 'failed'
	scheduledFor: string
	sentAt: string | null
	createdAt: string
}

export interface ScheduledEmailsResult {
	emails: ScheduledEmail[]
	total: number
	hasMore: boolean
}

export interface ScheduledEmailStats {
	total: number
	pending: number
	queued: number
	sent: number
	cancelled: number
	failed: number
}

export interface ListScheduledEmailsOptions {
	status?: 'pending' | 'queued' | 'sent' | 'cancelled' | 'failed' | 'all'
	limit?: number
	offset?: number
}

export interface SendResult {
	id: string
	success: boolean
}

// ============================================================================
// Functions
// ============================================================================

/**
 * Check if email service is configured for the app
 *
 * @example
 * ```typescript
 * const configured = await isEmailConfigured(config)
 * if (!configured) console.log('Please configure email settings')
 * ```
 */
export async function isEmailConfigured(config: SylphxConfig): Promise<boolean> {
	return callApi(config, '/email/configured', { method: 'GET' })
}

/**
 * Send a custom email
 *
 * @example
 * ```typescript
 * const result = await sendEmail(config, {
 *   to: 'user@example.com',
 *   subject: 'Hello!',
 *   html: '<p>Welcome to our app!</p>',
 * })
 * ```
 */
export async function sendEmail(
	config: SylphxConfig,
	options: SendEmailOptions
): Promise<SendResult> {
	return callApi(config, '/email/send', { method: 'POST', body: options })
}

/**
 * Send a templated email
 *
 * @example
 * ```typescript
 * await sendTemplatedEmail(config, {
 *   template: 'welcome',
 *   to: 'user@example.com',
 *   data: { name: 'John' },
 * })
 * ```
 */
export async function sendTemplatedEmail(
	config: SylphxConfig,
	options: SendTemplatedEmailOptions
): Promise<SendResult> {
	return callApi(config, '/email/send-templated', { method: 'POST', body: options })
}

/**
 * Send email to a user by their ID
 *
 * @example
 * ```typescript
 * await sendEmailToUser(config, {
 *   userId: 'user-123',
 *   subject: 'Account Update',
 *   html: '<p>Your account has been updated.</p>',
 * })
 * ```
 */
export async function sendEmailToUser(
	config: SylphxConfig,
	options: SendToUserOptions
): Promise<SendResult> {
	return callApi(config, '/email/send-to-user', { method: 'POST', body: options })
}

/**
 * Schedule an email for future delivery
 *
 * @example
 * ```typescript
 * const scheduled = await scheduleEmail(config, {
 *   to: 'user@example.com',
 *   subject: 'Reminder',
 *   html: '<p>Don\'t forget!</p>',
 *   scheduledFor: new Date(Date.now() + 86400000).toISOString(), // 24 hours
 * })
 * ```
 */
export async function scheduleEmail(
	config: SylphxConfig,
	options: ScheduleEmailOptions
): Promise<ScheduledEmail> {
	return callApi(config, '/email/schedule', { method: 'POST', body: options })
}

/**
 * List scheduled emails
 *
 * @example
 * ```typescript
 * const { emails, total } = await listScheduledEmails(config, {
 *   status: 'pending',
 *   limit: 20,
 * })
 * ```
 */
export async function listScheduledEmails(
	config: SylphxConfig,
	options?: ListScheduledEmailsOptions
): Promise<ScheduledEmailsResult> {
	return callApi(config, '/email/scheduled', {
		method: 'GET',
		query: options as Record<string, string | number | undefined>,
	})
}

/**
 * Get a scheduled email by ID
 *
 * @example
 * ```typescript
 * const email = await getScheduledEmail(config, 'email-123')
 * console.log(email.status)
 * ```
 */
export async function getScheduledEmail(
	config: SylphxConfig,
	emailId: string
): Promise<ScheduledEmail> {
	return callApi(config, `/email/scheduled/${emailId}`, { method: 'GET' })
}

/**
 * Cancel a scheduled email
 *
 * @example
 * ```typescript
 * await cancelScheduledEmail(config, 'email-123')
 * ```
 */
export async function cancelScheduledEmail(
	config: SylphxConfig,
	emailId: string
): Promise<void> {
	return callApi(config, `/email/scheduled/${emailId}/cancel`, { method: 'POST' })
}

/**
 * Reschedule an email
 *
 * @example
 * ```typescript
 * await rescheduleEmail(config, 'email-123', new Date(Date.now() + 3600000).toISOString())
 * ```
 */
export async function rescheduleEmail(
	config: SylphxConfig,
	emailId: string,
	scheduledFor: string
): Promise<ScheduledEmail> {
	return callApi(config, `/email/scheduled/${emailId}/reschedule`, {
		method: 'POST',
		body: { scheduledFor },
	})
}

/**
 * Get scheduled email statistics
 *
 * @example
 * ```typescript
 * const stats = await getScheduledEmailStats(config)
 * console.log(`${stats.pending} emails pending`)
 * ```
 */
export async function getScheduledEmailStats(config: SylphxConfig): Promise<ScheduledEmailStats> {
	return callApi(config, '/email/scheduled/stats', { method: 'GET' })
}
