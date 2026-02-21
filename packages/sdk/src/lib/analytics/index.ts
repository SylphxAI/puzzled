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
 * ## Architecture (ADR-004)
 *
 * Analytics uses **Auto-Discovery** - events are automatically discovered
 * when tracked. No pre-definition or schema required.
 *
 * @example
 * ```typescript
 * import { track, identify, page } from '@sylphx/sdk'
 *
 * // Track any event - auto-discovered by platform
 * await track(config, {
 *   event: 'purchase_completed',
 *   properties: { amount: 99.99, product: 'Pro Plan' }
 * })
 *
 * // Identify user
 * await identify(config, {
 *   userId: 'user-123',
 *   traits: { email: 'user@example.com', plan: 'pro' }
 * })
 *
 * // Track page view
 * await page(config, { name: 'Pricing', properties: { variant: 'A' } })
 * ```
 */

// Main tracker
export {
	AnalyticsTracker,
	getAnalyticsTracker,
	initAnalytics,
	resetAnalyticsTracker,
} from "./tracker";

// Autocapture
export {
	Autocapture,
	initAutocapture,
} from "./autocapture";

// Navigation
export {
	NavigationTracker,
	initNavigationTracker,
	analyzeReferrer,
} from "./navigation";

// Element naming
export {
	generateElementName,
	generateEventName,
	buildElementData,
} from "./element-naming";

// Types
export type {
	// Core types

	EventProperties,
	UserProperties,
	// Events
	AnalyticsEvent,
	// Element data
	ElementData,
	// Identification

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
} from "./types";

export { DEFAULT_ANALYTICS_CONFIG, DEFAULT_AUTOCAPTURE_CONFIG } from "./types";

// Destination Routing
export {
	createDestinationRouter,
	type DestinationType,
	type ConsentCategory as DestinationConsentCategory,
	type BaseDestinationConfig,
	type SylphxDestinationConfig,
	type GA4DestinationConfig,
	type GTMDestinationConfig,
	type MixpanelDestinationConfig,
	type SegmentDestinationConfig,
	type PostHogDestinationConfig,
	type AmplitudeDestinationConfig,
	type CustomDestinationConfig,
	type DestinationConfig,
	type DestinationRouterConfig,
	type DestinationRouter,
} from "./destinations";
