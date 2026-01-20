/**
 * Analytics Types
 *
 * Type definitions for client-side analytics.
 * PostHog-compatible event format with smart autocapture.
 */

// ==========================================
// Core Types
// ==========================================

/** Event property value types */
export type PropertyValue = string | number | boolean | null | undefined | PropertyValue[] | { [key: string]: PropertyValue }

/** Event properties */
export type EventProperties = Record<string, PropertyValue>

/** User properties */
export type UserProperties = Record<string, PropertyValue>

/** Group properties */
export type GroupProperties = Record<string, PropertyValue>

// ==========================================
// Event Types
// ==========================================

/** Standard event (from PostHog) */
export interface AnalyticsEvent {
	/** Event name */
	event: string
	/** Event properties */
	properties: EventProperties
	/** User distinct ID */
	distinct_id: string
	/** Timestamp (ISO 8601) */
	timestamp: string
	/** Library info */
	$lib?: string
	$lib_version?: string
	/** Set user properties */
	$set?: UserProperties
	/** Set user properties once */
	$set_once?: UserProperties
}

/** Autocaptured event */
export interface AutocaptureEvent extends AnalyticsEvent {
	event: '$autocapture'
	properties: EventProperties & {
		$event_type: 'click' | 'submit' | 'change' | 'focus' | 'blur'
		$elements: ElementData[]
		$element_name?: string
		$element_text?: string
		$element_href?: string
	}
}

/** Page view event */
export interface PageViewEvent extends AnalyticsEvent {
	event: '$pageview'
	properties: EventProperties & {
		$current_url: string
		$host: string
		$pathname: string
		$referrer?: string
		$referring_domain?: string
	}
}

/** Page leave event */
export interface PageLeaveEvent extends AnalyticsEvent {
	event: '$pageleave'
	properties: EventProperties & {
		$current_url: string
		$time_on_page?: number
		$scroll_depth?: number
	}
}

// ==========================================
// Element Data
// ==========================================

/** Captured element data */
export interface ElementData {
	tag_name: string
	$el_text?: string
	attr__id?: string
	attr__class?: string
	attr__href?: string
	attr__name?: string
	attr__type?: string
	attr__value?: string
	attr__placeholder?: string
	attr__role?: string
	attr__aria_label?: string
	attr__data_testid?: string
	attr__data_analytics?: string
	nth_child?: number
	nth_of_type?: number
	[key: `attr__${string}`]: string | undefined
}

// ==========================================
// User Identification
// ==========================================

/** Identify call */
export interface IdentifyData {
	distinct_id: string
	$set?: UserProperties
	$set_once?: UserProperties
}

/** Alias call */
export interface AliasData {
	alias: string
	distinct_id: string
}

/** Group call */
export interface GroupData {
	$group_type: string
	$group_key: string
	$group_set?: GroupProperties
}

// ==========================================
// Configuration
// ==========================================

/** Analytics configuration */
export interface AnalyticsConfig {
	/** API endpoint */
	apiEndpoint?: string
	/** API key (optional, for server-side validation) */
	apiKey?: string
	/** Enable autocapture */
	autocapture?: boolean | AutocaptureConfig
	/** Enable pageview tracking */
	capturePageviews?: boolean
	/** Enable SPA navigation tracking */
	captureSpaNavigation?: boolean
	/** Enable page leave tracking */
	capturePageleave?: boolean
	/** Enable scroll depth tracking */
	captureScrollDepth?: boolean
	/** Enable form tracking */
	captureForms?: boolean
	/** Enable error tracking */
	captureErrors?: boolean
	/** Capture UTM parameters */
	captureUtm?: boolean
	/** Capture referrer */
	captureReferrer?: boolean
	/** Capture device info */
	captureDevice?: boolean
	/** Session ID cookie name */
	sessionCookieName?: string
	/** Session timeout in ms (default: 30 min) */
	sessionTimeout?: number
	/** Properties to add to every event */
	defaultProperties?: EventProperties
	/** Properties to never capture */
	propertyDenylist?: string[]
	/** Sanitize properties before sending */
	sanitize?: (properties: EventProperties) => EventProperties
	/** Called before sending events */
	beforeSend?: (event: AnalyticsEvent) => AnalyticsEvent | null
	/** Enable debug logging */
	debug?: boolean
	/** Batch events */
	batchSize?: number
	/** Batch flush interval in ms */
	flushInterval?: number
	/** Enable persistence */
	persistence?: 'localStorage' | 'sessionStorage' | 'cookie' | 'none'
}

/** Autocapture configuration */
export interface AutocaptureConfig {
	/** CSS selectors to capture */
	includeSelectors?: string[]
	/** CSS selectors to exclude */
	excludeSelectors?: string[]
	/** Capture text content */
	captureText?: boolean
	/** Max text length */
	maxTextLength?: number
	/** Capture attributes */
	captureAttributes?: string[]
	/** Elements to include (default: button, a, input, select, textarea) */
	elements?: string[]
	/** Event types to capture */
	eventTypes?: ('click' | 'submit' | 'change' | 'focus' | 'blur')[]
}

/** Default configuration */
export const DEFAULT_ANALYTICS_CONFIG: AnalyticsConfig = {
	apiEndpoint: '/api/analytics/track',
	autocapture: true,
	capturePageviews: true,
	captureSpaNavigation: true,
	capturePageleave: true,
	captureScrollDepth: true,
	captureForms: true,
	captureErrors: false, // Use error-tracking module instead
	captureUtm: true,
	captureReferrer: true,
	captureDevice: true,
	sessionCookieName: 'sylphx_session',
	sessionTimeout: 30 * 60 * 1000, // 30 minutes
	debug: false,
	batchSize: 10,
	flushInterval: 5000,
	persistence: 'localStorage',
}

/** Default autocapture configuration */
export const DEFAULT_AUTOCAPTURE_CONFIG: AutocaptureConfig = {
	captureText: true,
	maxTextLength: 100,
	captureAttributes: [
		'id',
		'class',
		'href',
		'name',
		'type',
		'role',
		'aria-label',
		'data-testid',
		'data-analytics',
		'data-track',
	],
	elements: ['button', 'a', 'input', 'select', 'textarea', '[role="button"]', '[data-track]'],
	eventTypes: ['click', 'submit', 'change'],
}

// ==========================================
// UTM & Attribution
// ==========================================

/** UTM parameters */
export interface UtmParams {
	utm_source?: string
	utm_medium?: string
	utm_campaign?: string
	utm_term?: string
	utm_content?: string
}

/** Referrer data */
export interface ReferrerData {
	$referrer?: string
	$referring_domain?: string
	$referrer_source?: 'organic' | 'social' | 'paid' | 'email' | 'direct' | 'unknown'
}

/** Attribution data */
export interface AttributionData extends UtmParams, ReferrerData {
	$initial_referrer?: string
	$initial_referring_domain?: string
	$initial_utm_source?: string
	$initial_utm_medium?: string
	$initial_utm_campaign?: string
}

// ==========================================
// Device & Context
// ==========================================

/** Device context */
export interface DeviceContext {
	$device_type?: 'Desktop' | 'Mobile' | 'Tablet' | 'Bot'
	$os?: string
	$os_version?: string
	$browser?: string
	$browser_version?: string
	$browser_language?: string
	$screen_height?: number
	$screen_width?: number
	$viewport_height?: number
	$viewport_width?: number
	$device_pixel_ratio?: number
	$timezone?: string
}

/** Page context */
export interface PageContext {
	$current_url: string
	$host: string
	$pathname: string
	$search?: string
	$hash?: string
	$title?: string
}

// ==========================================
// Queue & Batch
// ==========================================

/** Queued event */
export interface QueuedEvent {
	event: AnalyticsEvent
	timestamp: number
	retries: number
}

/** Batch payload */
export interface BatchPayload {
	api_key?: string
	batch: AnalyticsEvent[]
}
