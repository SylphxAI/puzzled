/**
 * Analytics Module
 *
 * Client-side analytics with:
 * - Smart autocapture with intelligent element naming
 * - SPA navigation tracking
 * - Event batching & queuing
 * - User identification & sessions
 * - UTM & referrer attribution
 *
 * @example
 * ```typescript
 * import { initAnalytics, getAnalyticsTracker } from '@sylphx/platform-sdk/analytics'
 *
 * // Initialize analytics
 * const analytics = initAnalytics({
 *   apiEndpoint: '/api/analytics/track',
 *   autocapture: true,
 *   debug: true,
 * })
 *
 * // Identify user
 * analytics.identify('user-123', {
 *   email: 'user@example.com',
 *   plan: 'pro',
 * })
 *
 * // Track custom events
 * analytics.track('purchase_completed', {
 *   amount: 99.99,
 *   product: 'Pro Plan',
 * })
 *
 * // Set user properties
 * analytics.setUserProperties({
 *   lifetime_value: 199.99,
 * })
 * ```
 */

// Main tracker
export { AnalyticsTracker, getAnalyticsTracker, initAnalytics, resetAnalyticsTracker } from './tracker'

// Autocapture
export {
	Autocapture,
	initAutocapture,
	getAutocapture,
	startAutocapture,
	stopAutocapture,
	type AutocaptureEvent,
} from './autocapture'

// Navigation
export {
	NavigationTracker,
	initNavigationTracker,
	getNavigationTracker,
	analyzeReferrer,
	type PageViewEvent,
	type PageLeaveEvent,
} from './navigation'

// Element naming
export {
	generateElementName,
	generateEventName,
	buildElementData,
	buildElementChain,
} from './element-naming'

// Types
export type {
	// Core types
	PropertyValue,
	EventProperties,
	UserProperties,
	GroupProperties,
	// Events
	AnalyticsEvent,
	AutocaptureEvent as AutocaptureEventType,
	PageViewEvent as PageViewEventType,
	PageLeaveEvent as PageLeaveEventType,
	// Element data
	ElementData,
	// Identification
	IdentifyData,
	AliasData,
	GroupData,
	// Configuration
	AnalyticsConfig,
	AutocaptureConfig,
	// Attribution
	UtmParams,
	ReferrerData,
	AttributionData,
	// Context
	DeviceContext,
	PageContext,
	// Queue
	QueuedEvent,
	BatchPayload,
} from './types'

export { DEFAULT_ANALYTICS_CONFIG, DEFAULT_AUTOCAPTURE_CONFIG } from './types'

// Event Schema (Code First)
export {
	defineEvent,
	defineEventCategory,
	createAnalyticsSchema,
	hashAnalyticsSchema,
	presetEvents,
	presetCategories,
	type PropertyType,
	type PropertyDefinition,
	type EventCategory,
	type EventDefinition,
	type EventCategoryDefinition,
	type AnalyticsSchema,
	type AnalyticsSchemaInput,
	type ExtractEventNames,
	type ExtractEventProps,
} from './events'

// Typed Tracker
export { createTypedTracker, type TypedTracker } from './typed-tracker'
