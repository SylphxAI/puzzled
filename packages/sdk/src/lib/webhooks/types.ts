/**
 * Webhook Types
 *
 * Type definitions for webhook events, signatures, and delivery.
 */

// ============================================================================
// Event Types
// ============================================================================

/**
 * All webhook event categories
 */
export type WebhookEventCategory =
	| 'auth'
	| 'billing'
	| 'email'
	| 'storage'
	| 'analytics'
	| 'jobs'
	| 'monitoring'
	| 'flags'
	| 'referrals'

/**
 * Auth-related webhook events
 */
export type AuthWebhookEvent =
	| 'auth.user.created'
	| 'auth.user.updated'
	| 'auth.user.deleted'
	| 'auth.session.created'
	| 'auth.session.revoked'
	| 'auth.mfa.enabled'
	| 'auth.mfa.disabled'
	| 'auth.password.reset'
	| 'auth.email.verified'

/**
 * Billing-related webhook events
 */
export type BillingWebhookEvent =
	| 'billing.subscription.created'
	| 'billing.subscription.updated'
	| 'billing.subscription.canceled'
	| 'billing.invoice.paid'
	| 'billing.invoice.failed'
	| 'billing.payment.succeeded'
	| 'billing.payment.failed'

/**
 * Email-related webhook events
 */
export type EmailWebhookEvent =
	| 'email.sent'
	| 'email.delivered'
	| 'email.bounced'
	| 'email.complained'
	| 'email.opened'
	| 'email.clicked'
	| 'email.unsubscribed'
	| 'newsletter.subscribed'
	| 'newsletter.confirmed'
	| 'newsletter.unsubscribed'

/**
 * Storage-related webhook events
 */
export type StorageWebhookEvent =
	| 'storage.file.uploaded'
	| 'storage.file.deleted'
	| 'storage.image.optimized'

/**
 * Analytics-related webhook events
 */
export type AnalyticsWebhookEvent =
	| 'analytics.event.tracked'
	| 'analytics.user.identified'
	| 'analytics.cohort.entered'
	| 'analytics.cohort.exited'

/**
 * Jobs-related webhook events
 */
export type JobsWebhookEvent =
	| 'jobs.job.scheduled'
	| 'jobs.job.started'
	| 'jobs.job.completed'
	| 'jobs.job.failed'
	| 'jobs.workflow.started'
	| 'jobs.workflow.completed'
	| 'jobs.workflow.failed'

/**
 * Monitoring-related webhook events
 */
export type MonitoringWebhookEvent =
	| 'monitoring.error.new'
	| 'monitoring.error.resolved'
	| 'monitoring.alert.triggered'

/**
 * Feature flag-related webhook events
 */
export type FlagsWebhookEvent =
	| 'flags.flag.created'
	| 'flags.flag.updated'
	| 'flags.flag.deleted'
	| 'flags.experiment.started'
	| 'flags.experiment.concluded'

/**
 * Referral-related webhook events
 */
export type ReferralWebhookEvent =
	| 'referrals.referral.created'
	| 'referrals.referral.completed'
	| 'referrals.reward.earned'
	| 'referrals.reward.redeemed'

/**
 * All webhook event types
 */
export type WebhookEventType =
	| AuthWebhookEvent
	| BillingWebhookEvent
	| EmailWebhookEvent
	| StorageWebhookEvent
	| AnalyticsWebhookEvent
	| JobsWebhookEvent
	| MonitoringWebhookEvent
	| FlagsWebhookEvent
	| ReferralWebhookEvent

// ============================================================================
// Webhook Payload Types
// ============================================================================

/**
 * Base webhook payload structure
 */
export interface WebhookPayload<TData = unknown> {
	/** Unique event ID */
	id: string
	/** Event type */
	type: WebhookEventType
	/** API version */
	apiVersion: string
	/** When the event was created */
	createdAt: string
	/** App ID that triggered the event */
	appId: string
	/** Environment (production, development, staging) */
	environment: 'production' | 'development' | 'staging'
	/** Event-specific data */
	data: TData
	/** Number of previous delivery attempts */
	attemptNumber: number
}

/**
 * Webhook delivery status
 */
export type WebhookDeliveryStatus =
	| 'pending'
	| 'delivered'
	| 'failed'
	| 'retrying'

/**
 * Webhook delivery record
 */
export interface WebhookDelivery {
	id: string
	webhookId: string
	eventId: string
	eventType: WebhookEventType
	url: string
	status: WebhookDeliveryStatus
	httpStatus?: number
	responseBody?: string
	latencyMs?: number
	attemptNumber: number
	createdAt: string
	deliveredAt?: string
	nextRetryAt?: string
}

// ============================================================================
// Signature Types
// ============================================================================

/**
 * Webhook signature header components
 */
export interface WebhookSignatureHeaders {
	/** Timestamp of when the webhook was sent (Unix timestamp) */
	timestamp: number
	/** HMAC-SHA256 signature */
	signature: string
	/** Signature scheme version */
	version: 'v1'
}

/**
 * Result of signature verification
 */
export interface SignatureVerificationResult {
	/** Whether the signature is valid */
	valid: boolean
	/** Error message if invalid */
	error?: string
	/** Parsed payload if valid */
	payload?: WebhookPayload
	/** Age of the webhook in seconds */
	ageSeconds?: number
}

/**
 * Options for signature verification
 */
export interface VerifyOptions {
	/** Maximum age of webhook in seconds (default: 300 = 5 minutes) */
	maxAgeSeconds?: number
	/** Clock tolerance in seconds for timestamp validation (default: 60) */
	clockToleranceSeconds?: number
}

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Webhook endpoint configuration
 */
export interface WebhookEndpoint {
	id: string
	url: string
	events: WebhookEventType[] | ['*']
	environment: 'production' | 'development' | 'staging' | 'all'
	active: boolean
	secretHash: string
	createdAt: string
	updatedAt: string
}

/**
 * Webhook client configuration
 */
export interface WebhooksConfig {
	/** Webhook signing secret */
	signingSecret: string
	/** Optional custom signature header name (default: 'x-sylphx-signature') */
	signatureHeader?: string
	/** Optional custom timestamp header name (default: 'x-sylphx-timestamp') */
	timestampHeader?: string
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Default configuration values
 */
export const DEFAULT_WEBHOOKS_CONFIG = {
	signatureHeader: 'x-sylphx-signature',
	timestampHeader: 'x-sylphx-timestamp',
	maxAgeSeconds: 300, // 5 minutes
	clockToleranceSeconds: 60, // 1 minute
} as const

/**
 * All supported webhook event types
 */
export const WEBHOOK_EVENT_TYPES: readonly WebhookEventType[] = [
	// Auth
	'auth.user.created',
	'auth.user.updated',
	'auth.user.deleted',
	'auth.session.created',
	'auth.session.revoked',
	'auth.mfa.enabled',
	'auth.mfa.disabled',
	'auth.password.reset',
	'auth.email.verified',
	// Billing
	'billing.subscription.created',
	'billing.subscription.updated',
	'billing.subscription.canceled',
	'billing.invoice.paid',
	'billing.invoice.failed',
	'billing.payment.succeeded',
	'billing.payment.failed',
	// Email
	'email.sent',
	'email.delivered',
	'email.bounced',
	'email.complained',
	'email.opened',
	'email.clicked',
	'email.unsubscribed',
	'newsletter.subscribed',
	'newsletter.confirmed',
	'newsletter.unsubscribed',
	// Storage
	'storage.file.uploaded',
	'storage.file.deleted',
	'storage.image.optimized',
	// Analytics
	'analytics.event.tracked',
	'analytics.user.identified',
	'analytics.cohort.entered',
	'analytics.cohort.exited',
	// Jobs
	'jobs.job.scheduled',
	'jobs.job.started',
	'jobs.job.completed',
	'jobs.job.failed',
	'jobs.workflow.started',
	'jobs.workflow.completed',
	'jobs.workflow.failed',
	// Monitoring
	'monitoring.error.new',
	'monitoring.error.resolved',
	'monitoring.alert.triggered',
	// Flags
	'flags.flag.created',
	'flags.flag.updated',
	'flags.flag.deleted',
	'flags.experiment.started',
	'flags.experiment.concluded',
	// Referrals
	'referrals.referral.created',
	'referrals.referral.completed',
	'referrals.reward.earned',
	'referrals.reward.redeemed',
] as const
