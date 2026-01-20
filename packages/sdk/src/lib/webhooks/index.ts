/**
 * Webhooks SDK
 *
 * Webhook signature verification and event handling for Sylph platform.
 *
 * ## Features
 *
 * - **Signature Verification** - HMAC-SHA256 with timing-safe comparison
 * - **Replay Protection** - Timestamp validation prevents replay attacks
 * - **Type-Safe Events** - Full TypeScript definitions for all event types
 * - **Handler Wrapper** - Easy integration with Next.js, Express, etc.
 *
 * @example
 * ```typescript
 * import {
 *   verifyWebhookSignature,
 *   createWebhookHandler,
 *   type WebhookPayload,
 * } from '@sylphx/platform-sdk/webhooks'
 *
 * // Option 1: Manual verification
 * export async function POST(req: Request) {
 *   const body = await req.text()
 *   const result = await verifyWebhookSignature({
 *     payload: body,
 *     signature: req.headers.get('x-sylphx-signature')!,
 *     timestamp: req.headers.get('x-sylphx-timestamp')!,
 *     secret: process.env.WEBHOOK_SECRET!,
 *   })
 *
 *   if (!result.valid) {
 *     return new Response(result.error, { status: 401 })
 *   }
 *
 *   handleEvent(result.payload!)
 *   return new Response('OK')
 * }
 *
 * // Option 2: Handler wrapper (recommended)
 * export const POST = createWebhookHandler(
 *   { secret: process.env.WEBHOOK_SECRET! },
 *   async ({ event }) => {
 *     console.log(`Received: ${event.type}`, event.data)
 *     return new Response('OK')
 *   }
 * )
 * ```
 *
 * @module @sylphx/webhooks
 */

// ============================================================================
// Type Exports
// ============================================================================

export type {
	// Event Types
	WebhookEventCategory,
	WebhookEventType,
	AuthWebhookEvent,
	BillingWebhookEvent,
	EmailWebhookEvent,
	StorageWebhookEvent,
	AnalyticsWebhookEvent,
	JobsWebhookEvent,
	MonitoringWebhookEvent,
	FlagsWebhookEvent,
	ReferralWebhookEvent,

	// Payload Types
	WebhookPayload,
	WebhookDelivery,
	WebhookDeliveryStatus,

	// Signature Types
	WebhookSignatureHeaders,
	SignatureVerificationResult,
	VerifyOptions,

	// Configuration Types
	WebhookEndpoint,
	WebhooksConfig,
} from './types'

export { DEFAULT_WEBHOOKS_CONFIG, WEBHOOK_EVENT_TYPES } from './types'

// ============================================================================
// Signature Verification
// ============================================================================

export {
	verifyWebhookSignature,
	generateWebhookSignature,
	createWebhookHandler,
	type VerifySignatureParams,
	type GenerateSignatureParams,
	type GeneratedSignature,
	type WebhookHandlerOptions,
	type WebhookHandlerContext,
	type WebhookHandler,
} from './signature'

// ============================================================================
// Event Type Guards
// ============================================================================

import type { WebhookEventType, WebhookPayload } from './types'

/**
 * Check if an event is an auth event
 */
export function isAuthEvent(type: WebhookEventType): boolean {
	return type.startsWith('auth.')
}

/**
 * Check if an event is a billing event
 */
export function isBillingEvent(type: WebhookEventType): boolean {
	return type.startsWith('billing.')
}

/**
 * Check if an event is an email event
 */
export function isEmailEvent(type: WebhookEventType): boolean {
	return type.startsWith('email.') || type.startsWith('newsletter.')
}

/**
 * Check if an event is a storage event
 */
export function isStorageEvent(type: WebhookEventType): boolean {
	return type.startsWith('storage.')
}

/**
 * Check if an event is an analytics event
 */
export function isAnalyticsEvent(type: WebhookEventType): boolean {
	return type.startsWith('analytics.')
}

/**
 * Check if an event is a jobs event
 */
export function isJobsEvent(type: WebhookEventType): boolean {
	return type.startsWith('jobs.')
}

/**
 * Check if an event is a monitoring event
 */
export function isMonitoringEvent(type: WebhookEventType): boolean {
	return type.startsWith('monitoring.')
}

/**
 * Check if an event is a flags event
 */
export function isFlagsEvent(type: WebhookEventType): boolean {
	return type.startsWith('flags.')
}

/**
 * Check if an event is a referrals event
 */
export function isReferralsEvent(type: WebhookEventType): boolean {
	return type.startsWith('referrals.')
}

/**
 * Get the category of an event type
 */
export function getEventCategory(type: WebhookEventType): string {
	return type.split('.')[0]
}

// ============================================================================
// Typed Event Handlers
// ============================================================================

/**
 * Event handler map for type-safe event handling
 */
export type WebhookEventHandlers = {
	[K in WebhookEventType]?: (payload: WebhookPayload) => void | Promise<void>
}

/**
 * Route a webhook event to the appropriate handler
 *
 * @param event - The webhook event payload
 * @param handlers - Map of event type to handler function
 *
 * @example
 * ```typescript
 * await routeWebhookEvent(event, {
 *   'auth.user.created': async (payload) => {
 *     await sendWelcomeEmail(payload.data.email)
 *   },
 *   'billing.subscription.created': async (payload) => {
 *     await provisionAccount(payload.data.customerId)
 *   },
 * })
 * ```
 */
export async function routeWebhookEvent(
	event: WebhookPayload,
	handlers: WebhookEventHandlers
): Promise<boolean> {
	const handler = handlers[event.type]
	if (handler) {
		await handler(event)
		return true
	}
	return false
}
