/**
 * Analytics Tracker
 *
 * Core analytics engine with:
 * - Smart autocapture
 * - SPA navigation tracking
 * - Event batching & queuing
 * - User identification
 * - Session management
 */

import type {
	AnalyticsConfig,
	AnalyticsEvent,
	EventProperties,
	UserProperties,
	GroupProperties,
	AutocaptureConfig,
	QueuedEvent,
	UtmParams,
	AttributionData,
	DeviceContext,
	PageContext,
	PropertyValue,
} from './types'
import { DEFAULT_ANALYTICS_CONFIG, DEFAULT_AUTOCAPTURE_CONFIG } from './types'
import { SDK_API_PATH, ANALYTICS_FLUSH_INTERVAL_MS, ANALYTICS_SESSION_TIMEOUT_MS } from '../../constants'
import { Autocapture, type AutocaptureEvent } from './autocapture'
import { NavigationTracker, type PageViewEvent, type PageLeaveEvent, analyzeReferrer } from './navigation'

// ==========================================
// Analytics Tracker
// ==========================================

/**
 * Analytics Tracker
 *
 * Comprehensive client-side analytics with automatic event capture.
 */
export class AnalyticsTracker {
	private config: AnalyticsConfig
	private distinctId: string | null = null
	private anonymousId: string
	private sessionId: string
	private queue: QueuedEvent[] = []
	private flushTimeout: ReturnType<typeof setTimeout> | null = null
	private autocapture: Autocapture | null = null
	private navigationTracker: NavigationTracker | null = null
	private attribution: AttributionData = {}
	private superProperties: EventProperties = {}
	private isInitialized = false

	constructor(config: Partial<AnalyticsConfig> = {}) {
		this.config = { ...DEFAULT_ANALYTICS_CONFIG, ...config }
		this.anonymousId = this.getOrCreateAnonymousId()
		this.sessionId = this.getOrCreateSessionId()
	}

	// ==========================================
	// Initialization
	// ==========================================

	/**
	 * Initialize analytics
	 */
	init(): void {
		if (typeof window === 'undefined') return
		if (this.isInitialized) return

		this.isInitialized = true

		// Capture initial attribution data
		this.captureAttribution()

		// Setup autocapture
		if (this.config.autocapture) {
			const autocaptureConfig =
				typeof this.config.autocapture === 'object'
					? this.config.autocapture
					: DEFAULT_AUTOCAPTURE_CONFIG

			this.autocapture = new Autocapture(
				(event) => this.handleAutocaptureEvent(event),
				autocaptureConfig
			)
			this.autocapture.start()
		}

		// Setup navigation tracking
		if (this.config.capturePageviews || this.config.captureSpaNavigation) {
			this.navigationTracker = new NavigationTracker(
				(event) => this.handlePageView(event),
				this.config.capturePageleave
					? (event) => this.handlePageLeave(event)
					: undefined
			)
			this.navigationTracker.start()
		}

		// Load persisted queue
		this.loadQueue()

		// Start flush interval
		this.startFlushInterval()

		// Handle page unload - flush remaining events
		window.addEventListener('beforeunload', () => this.flush())

		this.debug('Analytics initialized', {
			anonymousId: this.anonymousId,
			sessionId: this.sessionId,
		})
	}

	/**
	 * Shutdown analytics
	 */
	shutdown(): void {
		this.autocapture?.stop()
		this.navigationTracker?.stop()
		this.stopFlushInterval()
		this.flush()
		this.isInitialized = false
	}

	// ==========================================
	// Identification
	// ==========================================

	/**
	 * Identify a user
	 */
	identify(userId: string, properties?: UserProperties): void {
		const previousId = this.distinctId || this.anonymousId

		this.distinctId = userId

		// Track identify event
		this.track('$identify', {
			$user_id: userId,
			$anon_distinct_id: previousId,
			...(properties && { $set: properties }),
		})

		// Persist distinct ID
		this.persistDistinctId(userId)

		this.debug('User identified', { userId, previousId })
	}

	/**
	 * Reset identity (logout)
	 */
	reset(): void {
		this.distinctId = null
		this.anonymousId = this.generateId()
		this.sessionId = this.generateId()
		this.superProperties = {}

		this.persistAnonymousId(this.anonymousId)
		this.clearDistinctId()

		this.debug('Identity reset', { anonymousId: this.anonymousId })
	}

	/**
	 * Alias an identity
	 */
	alias(alias: string): void {
		this.track('$create_alias', {
			alias,
			distinct_id: this.getDistinctId(),
		})
	}

	/**
	 * Get current distinct ID
	 */
	getDistinctId(): string {
		return this.distinctId || this.anonymousId
	}

	// ==========================================
	// User Properties
	// ==========================================

	/**
	 * Set user properties
	 */
	setUserProperties(properties: UserProperties): void {
		this.track('$set', {
			$set: properties,
		})
	}

	/**
	 * Set user properties once (only if not already set)
	 */
	setUserPropertiesOnce(properties: UserProperties): void {
		this.track('$set_once', {
			$set_once: properties,
		})
	}

	/**
	 * Increment numeric user property
	 */
	incrementUserProperty(property: string, value: number = 1): void {
		this.track('$set', {
			$add: { [property]: value },
		})
	}

	// ==========================================
	// Groups
	// ==========================================

	/**
	 * Associate user with a group
	 */
	group(groupType: string, groupKey: string, properties?: GroupProperties): void {
		this.track('$groupidentify', {
			$group_type: groupType,
			$group_key: groupKey,
			...(properties && { $group_set: properties }),
		})
	}

	// ==========================================
	// Event Tracking
	// ==========================================

	/**
	 * Track a custom event
	 */
	track(eventName: string, properties: EventProperties = {}): void {
		const event = this.buildEvent(eventName, properties)

		// Apply beforeSend hook
		if (this.config.beforeSend) {
			const processedEvent = this.config.beforeSend(event)
			if (!processedEvent) return
			this.enqueue(processedEvent)
		} else {
			this.enqueue(event)
		}

		this.debug('Event tracked', { event: eventName, properties })
	}

	/**
	 * Register super properties (added to all events)
	 */
	register(properties: EventProperties): void {
		this.superProperties = {
			...this.superProperties,
			...properties,
		}
	}

	/**
	 * Register super properties once
	 */
	registerOnce(properties: EventProperties): void {
		for (const [key, value] of Object.entries(properties)) {
			if (!(key in this.superProperties)) {
				this.superProperties[key] = value
			}
		}
	}

	/**
	 * Unregister a super property
	 */
	unregister(propertyName: string): void {
		delete this.superProperties[propertyName]
	}

	// ==========================================
	// Event Building
	// ==========================================

	private buildEvent(eventName: string, properties: EventProperties): AnalyticsEvent {
		const timestamp = new Date().toISOString()

		// Merge properties
		let mergedProperties: EventProperties = {
			...this.config.defaultProperties,
			...this.superProperties,
			...this.attribution,
			...this.getDeviceContext(),
			...this.getPageContext(),
			...properties,
			$session_id: this.sessionId,
		}

		// Apply denylist
		if (this.config.propertyDenylist) {
			for (const key of this.config.propertyDenylist) {
				delete mergedProperties[key]
			}
		}

		// Apply sanitization
		if (this.config.sanitize) {
			mergedProperties = this.config.sanitize(mergedProperties)
		}

		return {
			event: eventName,
			properties: mergedProperties,
			distinct_id: this.getDistinctId(),
			timestamp,
			$lib: 'sylphx-sdk',
			$lib_version: '1.0.0',
		}
	}

	// ==========================================
	// Autocapture Handling
	// ==========================================

	private handleAutocaptureEvent(event: AutocaptureEvent): void {
		this.track('$autocapture', {
			$event_type: event.eventType,
			// ElementData[] is semantically compatible with PropertyValue (array of objects)
			// but TypeScript requires explicit cast due to index signature differences
			// between ElementData's `attr__*` keys and PropertyValue's `[key: string]`
			$elements: event.elements as unknown as PropertyValue,
			$element_name: event.elementName,
			...event.properties,
		})

		// Also track as a named event for easier querying
		this.track(event.eventName, {
			$autocaptured: true,
			$element_name: event.elementName,
			...event.properties,
		})
	}

	// ==========================================
	// Navigation Handling
	// ==========================================

	private handlePageView(event: PageViewEvent): void {
		this.track('$pageview', {
			...event.context,
			...(event.utm || {}),
			$title: event.title,
			$referrer: event.referrer,
			...(event.previousPageTime !== undefined && {
				$previous_page_time: event.previousPageTime,
			}),
			...(event.previousScrollDepth !== undefined && {
				$previous_scroll_depth: event.previousScrollDepth,
			}),
		})
	}

	private handlePageLeave(event: PageLeaveEvent): void {
		this.track('$pageleave', {
			$current_url: event.url,
			$pathname: event.path,
			$time_on_page: event.timeOnPage,
			$scroll_depth: event.scrollDepth,
		})
	}

	// ==========================================
	// Queue Management
	// ==========================================

	private enqueue(event: AnalyticsEvent): void {
		this.queue.push({
			event,
			timestamp: Date.now(),
			retries: 0,
		})

		this.persistQueue()

		// Check if we should flush
		if (this.queue.length >= (this.config.batchSize ?? 10)) {
			this.flush()
		}
	}

	/**
	 * Flush queued events to the server
	 */
	async flush(): Promise<void> {
		if (this.queue.length === 0) return

		const batch = this.queue.splice(0, this.config.batchSize ?? 10)

		try {
			await this.sendBatch(batch.map((q) => q.event))
			this.persistQueue()
		} catch (error) {
			// Put failed events back in queue (with retry count)
			// Segment pattern: 10 retries with exponential backoff
			const MAX_RETRIES = 10
			for (const item of batch) {
				if (item.retries < MAX_RETRIES) {
					this.queue.unshift({
						...item,
						retries: item.retries + 1,
					})
				}
			}
			this.persistQueue()
			this.debug('Flush failed', { error, retriesRemaining: MAX_RETRIES - (batch[0]?.retries ?? 0) })
		}
	}

	private async sendBatch(events: AnalyticsEvent[]): Promise<void> {
		const endpoint = this.config.apiEndpoint ?? `${SDK_API_PATH}/analytics/track`

		const payload = {
			events: events,
		}

		const headers: Record<string, string> = {
			'Content-Type': 'application/json',
		}
		if (this.config.apiKey) {
			headers['x-app-secret'] = this.config.apiKey
		}

		const response = await fetch(endpoint, {
			method: 'POST',
			headers,
			body: JSON.stringify(payload),
			keepalive: true, // Allow request to complete on page unload
		})

		if (!response.ok) {
			throw new Error(`Analytics send failed: ${response.status}`)
		}
	}

	// ==========================================
	// Flush Interval
	// ==========================================

	private startFlushInterval(): void {
		if (this.flushTimeout) return

		const interval = this.config.flushInterval ?? ANALYTICS_FLUSH_INTERVAL_MS

		const scheduleFlush = () => {
			this.flushTimeout = setTimeout(() => {
				void this.flush()
				scheduleFlush()
			}, interval)
		}

		scheduleFlush()
	}

	private stopFlushInterval(): void {
		if (this.flushTimeout) {
			clearTimeout(this.flushTimeout)
			this.flushTimeout = null
		}
	}

	// ==========================================
	// Context Helpers
	// ==========================================

	private getDeviceContext(): DeviceContext {
		if (typeof window === 'undefined') return {}

		return {
			$screen_height: window.screen.height,
			$screen_width: window.screen.width,
			$viewport_height: window.innerHeight,
			$viewport_width: window.innerWidth,
			$device_pixel_ratio: window.devicePixelRatio,
			$browser_language: navigator.language,
			$timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
		}
	}

	private getPageContext(): PageContext {
		if (typeof window === 'undefined') {
			return {
				$current_url: '',
				$host: '',
				$pathname: '',
			}
		}

		return {
			$current_url: window.location.href,
			$host: window.location.host,
			$pathname: window.location.pathname,
		}
	}

	// ==========================================
	// Attribution
	// ==========================================

	private captureAttribution(): void {
		if (typeof window === 'undefined') return

		// UTM params
		const params = new URLSearchParams(window.location.search)
		const utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'] as const

		for (const key of utmKeys) {
			const value = params.get(key)
			if (value) {
				(this.attribution as Record<string, string | undefined>)[key] = value

				// Also store as initial if not already set
				const initialKey = `$initial_${key}`
				if (!this.loadInitialAttribution(initialKey as keyof AttributionData)) {
					(this.attribution as Record<string, string | undefined>)[initialKey] = value
					this.persistInitialAttribution(initialKey as keyof AttributionData, value)
				}
			}
		}

		// Referrer
		const referrer = document.referrer
		if (referrer) {
			const referrerData = analyzeReferrer(referrer)
			this.attribution = { ...this.attribution, ...referrerData }

			// Store initial referrer
			if (!this.loadInitialAttribution('$initial_referrer')) {
				this.attribution.$initial_referrer = referrer
				this.attribution.$initial_referring_domain = referrerData.$referring_domain
				this.persistInitialAttribution('$initial_referrer', referrer)
				if (referrerData.$referring_domain) {
					this.persistInitialAttribution(
						'$initial_referring_domain',
						referrerData.$referring_domain
					)
				}
			}
		}
	}

	// ==========================================
	// Persistence
	// ==========================================

	private getStorageKey(suffix: string): string {
		return `sylphx_analytics_${suffix}`
	}

	private getStorage(): Storage | null {
		if (typeof window === 'undefined') return null

		switch (this.config.persistence) {
			case 'localStorage':
				return localStorage
			case 'cookie':
				// Cookie storage handled separately via document.cookie
				// Fall back to localStorage for compatibility
				return localStorage
			case 'none':
				return null
			default:
				return localStorage
		}
	}

	private getOrCreateAnonymousId(): string {
		const storage = this.getStorage()
		if (storage) {
			const stored = storage.getItem(this.getStorageKey('anon_id'))
			if (stored) return stored
		}

		const id = this.generateId()
		this.persistAnonymousId(id)
		return id
	}

	private persistAnonymousId(id: string): void {
		const storage = this.getStorage()
		if (storage) {
			storage.setItem(this.getStorageKey('anon_id'), id)
		}
	}

	private persistDistinctId(id: string): void {
		const storage = this.getStorage()
		if (storage) {
			storage.setItem(this.getStorageKey('distinct_id'), id)
		}
	}

	private clearDistinctId(): void {
		const storage = this.getStorage()
		if (storage) {
			storage.removeItem(this.getStorageKey('distinct_id'))
		}
	}

	private getOrCreateSessionId(): string {
		const storage = this.getStorage()
		if (storage) {
			const stored = storage.getItem(this.getStorageKey('session_id'))
			const timestamp = storage.getItem(this.getStorageKey('session_ts'))

			if (stored && timestamp) {
				const lastActivity = parseInt(timestamp, 10)
				const timeout = this.config.sessionTimeout ?? ANALYTICS_SESSION_TIMEOUT_MS

				if (Date.now() - lastActivity < timeout) {
					// Update timestamp
					storage.setItem(this.getStorageKey('session_ts'), Date.now().toString())
					return stored
				}
			}
		}

		const id = this.generateId()
		this.persistSessionId(id)
		return id
	}

	private persistSessionId(id: string): void {
		const storage = this.getStorage()
		if (storage) {
			storage.setItem(this.getStorageKey('session_id'), id)
			storage.setItem(this.getStorageKey('session_ts'), Date.now().toString())
		}
	}

	private loadQueue(): void {
		const storage = this.getStorage()
		if (storage) {
			const stored = storage.getItem(this.getStorageKey('queue'))
			if (stored) {
				try {
					this.queue = JSON.parse(stored)
				} catch {
					this.queue = []
				}
			}
		}
	}

	private persistQueue(): void {
		const storage = this.getStorage()
		if (storage) {
			storage.setItem(this.getStorageKey('queue'), JSON.stringify(this.queue))
		}
	}

	private loadInitialAttribution(key: keyof AttributionData): string | null {
		const storage = this.getStorage()
		if (storage) {
			return storage.getItem(this.getStorageKey(key))
		}
		return null
	}

	private persistInitialAttribution(key: keyof AttributionData, value: string): void {
		const storage = this.getStorage()
		if (storage) {
			storage.setItem(this.getStorageKey(key), value)
		}
	}

	// ==========================================
	// Utilities
	// ==========================================

	private generateId(): string {
		// Use crypto.randomUUID if available, otherwise fallback to manual UUID v4
		if (typeof crypto !== 'undefined' && crypto.randomUUID) {
			return crypto.randomUUID()
		}
		return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
			const r = (Math.random() * 16) | 0
			const v = c === 'x' ? r : (r & 0x3) | 0x8
			return v.toString(16)
		})
	}

	private debug(message: string, data?: unknown): void {
		if (this.config.debug) {
			console.log(`[Analytics] ${message}`, data ?? '')
		}
	}
}

// ==========================================
// Singleton
// ==========================================

let trackerInstance: AnalyticsTracker | null = null

/**
 * Get or create analytics tracker
 */
export function getAnalyticsTracker(config?: Partial<AnalyticsConfig>): AnalyticsTracker {
	if (!trackerInstance) {
		trackerInstance = new AnalyticsTracker(config)
	}
	return trackerInstance
}

/**
 * Initialize analytics
 */
export function initAnalytics(config?: Partial<AnalyticsConfig>): AnalyticsTracker {
	const tracker = getAnalyticsTracker(config)
	tracker.init()
	return tracker
}

/**
 * Reset analytics instance (for testing)
 */
export function resetAnalyticsTracker(): void {
	trackerInstance?.shutdown()
	trackerInstance = null
}
