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

import {
	ANALYTICS_FLUSH_INTERVAL_MS,
	ANALYTICS_MAX_RETRIES,
	ANALYTICS_RETRY_BASE_DELAY_MS,
	ANALYTICS_RETRY_JITTER,
	ANALYTICS_RETRY_MAX_DELAY_MS,
	ANALYTICS_SESSION_TIMEOUT_MS,
	SDK_API_PATH,
} from "../../constants";
import { Autocapture, type AutocaptureEvent } from "./autocapture";
import {
	NavigationTracker,
	type PageLeaveEvent,
	type PageViewEvent,
	analyzeReferrer,
} from "./navigation";
import type {
	AnalyticsConfig,
	AnalyticsEvent,
	AttributionData,
	AutocaptureConfig,
	DeviceContext,
	EventProperties,
	GroupProperties,
	PageContext,
	PropertyValue,
	QueuedEvent,
	UserProperties,
	UtmParams,
} from "./types";
import {
	DEFAULT_ANALYTICS_CONFIG,
	DEFAULT_AUTOCAPTURE_CONFIG,
	type NavigatorWithUAData,
} from "./types";

// ==========================================
// Analytics Tracker
// ==========================================

/**
 * Analytics Tracker
 *
 * Comprehensive client-side analytics with automatic event capture.
 */
export class AnalyticsTracker {
	private config: AnalyticsConfig;
	private distinctId: string | null = null;
	private anonymousId: string;
	private sessionId: string;
	private queue: QueuedEvent[] = [];
	private flushTimeout: ReturnType<typeof setTimeout> | null = null;
	private autocapture: Autocapture | null = null;
	private navigationTracker: NavigationTracker | null = null;
	private attribution: AttributionData = {};
	private superProperties: EventProperties = {};
	private isInitialized = false;

	constructor(config: Partial<AnalyticsConfig> = {}) {
		this.config = { ...DEFAULT_ANALYTICS_CONFIG, ...config };
		this.anonymousId = this.getOrCreateAnonymousId();
		this.sessionId = this.getOrCreateSessionId();
	}

	// ==========================================
	// Initialization
	// ==========================================

	/**
	 * Initialize analytics
	 */
	init(): void {
		if (typeof window === "undefined") return;
		if (this.isInitialized) return;

		this.isInitialized = true;

		// Capture initial attribution data
		this.captureAttribution();

		// Setup autocapture
		if (this.config.autocapture) {
			const autocaptureConfig =
				typeof this.config.autocapture === "object"
					? this.config.autocapture
					: DEFAULT_AUTOCAPTURE_CONFIG;

			this.autocapture = new Autocapture(
				(event) => this.handleAutocaptureEvent(event),
				autocaptureConfig,
			);
			this.autocapture.start();
		}

		// Setup navigation tracking
		if (this.config.capturePageviews || this.config.captureSpaNavigation) {
			this.navigationTracker = new NavigationTracker(
				(event) => this.handlePageView(event),
				this.config.capturePageleave
					? (event) => this.handlePageLeave(event)
					: undefined,
			);
			this.navigationTracker.start();
		}

		// Load persisted queue
		this.loadQueue();

		// Start flush interval
		this.startFlushInterval();

		// Handle page unload - flush remaining events
		window.addEventListener("beforeunload", () => this.flush());

		this.debug("Analytics initialized", {
			anonymousId: this.anonymousId,
			sessionId: this.sessionId,
		});
	}

	/**
	 * Shutdown analytics
	 */
	shutdown(): void {
		this.autocapture?.stop();
		this.navigationTracker?.stop();
		this.stopFlushInterval();
		this.flush();
		this.isInitialized = false;
	}

	// ==========================================
	// Identification
	// ==========================================

	/**
	 * Identify a user
	 *
	 * Automatically aliases the previous anonymous ID to the new user ID
	 * following the Segment/Mixpanel identity merge pattern.
	 * This ensures anonymous activity is linked to the authenticated user.
	 */
	identify(userId: string, properties?: UserProperties): void {
		const previousId = this.distinctId || this.anonymousId;
		const wasAnonymous = !this.distinctId && this.anonymousId !== userId;

		this.distinctId = userId;

		// Track identify event
		this.track("$identify", {
			$user_id: userId,
			$anon_distinct_id: previousId,
			...(properties && { $set: properties }),
		});

		// Auto-alias: Link anonymous ID to authenticated user (Segment/Mixpanel pattern)
		// This ensures all anonymous activity is associated with the user
		if (wasAnonymous && previousId !== userId) {
			this.track("$create_alias", {
				alias: userId,
				distinct_id: previousId,
			});
			this.debug("Auto-aliased anonymous ID to user", {
				anonymousId: previousId,
				userId,
			});
		}

		// Persist distinct ID
		this.persistDistinctId(userId);

		this.debug("User identified", { userId, previousId });
	}

	/**
	 * Reset identity (logout)
	 */
	reset(): void {
		this.distinctId = null;
		this.anonymousId = this.generateId();
		this.sessionId = this.generateId();
		this.superProperties = {};

		this.persistAnonymousId(this.anonymousId);
		this.clearDistinctId();

		this.debug("Identity reset", { anonymousId: this.anonymousId });
	}

	/**
	 * Alias an identity
	 */
	alias(alias: string): void {
		this.track("$create_alias", {
			alias,
			distinct_id: this.getDistinctId(),
		});
	}

	/**
	 * Get current distinct ID
	 */
	getDistinctId(): string {
		return this.distinctId || this.anonymousId;
	}

	// ==========================================
	// User Properties
	// ==========================================

	/**
	 * Set user properties
	 */
	setUserProperties(properties: UserProperties): void {
		this.track("$set", {
			$set: properties,
		});
	}

	/**
	 * Set user properties once (only if not already set)
	 */
	setUserPropertiesOnce(properties: UserProperties): void {
		this.track("$set_once", {
			$set_once: properties,
		});
	}

	/**
	 * Increment numeric user property
	 */
	incrementUserProperty(property: string, value = 1): void {
		this.track("$set", {
			$add: { [property]: value },
		});
	}

	// ==========================================
	// Groups
	// ==========================================

	/**
	 * Associate user with a group
	 */
	group(
		groupType: string,
		groupKey: string,
		properties?: GroupProperties,
	): void {
		this.track("$groupidentify", {
			$group_type: groupType,
			$group_key: groupKey,
			...(properties && { $group_set: properties }),
		});
	}

	// ==========================================
	// Event Tracking
	// ==========================================

	/**
	 * Track a custom event
	 */
	track(eventName: string, properties: EventProperties = {}): void {
		const event = this.buildEvent(eventName, properties);

		// Apply beforeSend hook
		if (this.config.beforeSend) {
			const processedEvent = this.config.beforeSend(event);
			if (!processedEvent) return;
			this.enqueue(processedEvent);
		} else {
			this.enqueue(event);
		}

		this.debug("Event tracked", { event: eventName, properties });
	}

	/**
	 * Register super properties (added to all events)
	 */
	register(properties: EventProperties): void {
		this.superProperties = {
			...this.superProperties,
			...properties,
		};
	}

	/**
	 * Register super properties once
	 */
	registerOnce(properties: EventProperties): void {
		for (const [key, value] of Object.entries(properties)) {
			if (!(key in this.superProperties)) {
				this.superProperties[key] = value;
			}
		}
	}

	/**
	 * Unregister a super property
	 */
	unregister(propertyName: string): void {
		delete this.superProperties[propertyName];
	}

	// ==========================================
	// Event Building
	// ==========================================

	private buildEvent(
		eventName: string,
		properties: EventProperties,
	): AnalyticsEvent {
		const timestamp = new Date().toISOString();

		// Merge properties
		let mergedProperties: EventProperties = {
			...this.config.defaultProperties,
			...this.superProperties,
			...this.attribution,
			...this.getDeviceContext(),
			...this.getPageContext(),
			...properties,
			$session_id: this.sessionId,
		};

		// Apply denylist
		if (this.config.propertyDenylist) {
			for (const key of this.config.propertyDenylist) {
				delete mergedProperties[key];
			}
		}

		// Apply sanitization
		if (this.config.sanitize) {
			mergedProperties = this.config.sanitize(mergedProperties);
		}

		return {
			event: eventName,
			properties: mergedProperties,
			distinct_id: this.getDistinctId(),
			timestamp,
			$lib: "sylphx-sdk",
			$lib_version: "1.0.0",
		};
	}

	// ==========================================
	// Autocapture Handling
	// ==========================================

	private handleAutocaptureEvent(event: AutocaptureEvent): void {
		this.track("$autocapture", {
			$event_type: event.eventType,
			// ElementData[] is semantically compatible with PropertyValue (array of objects)
			// but TypeScript requires explicit cast due to index signature differences
			// between ElementData's `attr__*` keys and PropertyValue's `[key: string]`
			$elements: event.elements as unknown as PropertyValue,
			$element_name: event.elementName,
			...event.properties,
		});

		// Also track as a named event for easier querying
		this.track(event.eventName, {
			$autocaptured: true,
			$element_name: event.elementName,
			...event.properties,
		});
	}

	// ==========================================
	// Navigation Handling
	// ==========================================

	private handlePageView(event: PageViewEvent): void {
		this.track("$pageview", {
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
		});
	}

	private handlePageLeave(event: PageLeaveEvent): void {
		this.track("$pageleave", {
			$current_url: event.url,
			$pathname: event.path,
			$time_on_page: event.timeOnPage,
			$scroll_depth: event.scrollDepth,
		});
	}

	// ==========================================
	// Queue Management
	// ==========================================

	private enqueue(event: AnalyticsEvent): void {
		this.queue.push({
			event,
			timestamp: Date.now(),
			retries: 0,
		});

		this.persistQueue();

		// Check if we should flush
		if (this.queue.length >= (this.config.batchSize ?? 10)) {
			this.flush();
		}
	}

	/**
	 * Flush queued events to the server
	 *
	 * Implements exponential backoff with jitter (Segment pattern):
	 * - Base delay: 1 second
	 * - Max delay: 30 seconds
	 * - Jitter: ±20% to prevent thundering herd
	 * - Max retries: 10
	 */
	async flush(): Promise<void> {
		if (this.queue.length === 0) return;

		const now = Date.now();

		// Filter to only events ready for retry (backoff elapsed)
		const readyEvents: QueuedEvent[] = [];
		const pendingEvents: QueuedEvent[] = [];

		for (const item of this.queue) {
			if (!item.nextRetryAt || item.nextRetryAt <= now) {
				readyEvents.push(item);
			} else {
				pendingEvents.push(item);
			}
		}

		if (readyEvents.length === 0) {
			this.debug("No events ready for flush (backoff pending)", {
				pendingCount: pendingEvents.length,
			});
			return;
		}

		// Take batch from ready events
		const batchSize = this.config.batchSize ?? 10;
		const batch = readyEvents.splice(0, batchSize);

		// Update queue: remaining ready events + pending events
		this.queue = [...readyEvents, ...pendingEvents];

		try {
			await this.sendBatch(batch.map((q) => q.event));
			this.persistQueue();
		} catch (error) {
			// Put failed events back with exponential backoff
			for (const item of batch) {
				if (item.retries < ANALYTICS_MAX_RETRIES) {
					const nextRetry = item.retries + 1;
					const delay = this.calculateBackoffDelay(nextRetry);
					this.queue.unshift({
						...item,
						retries: nextRetry,
						nextRetryAt: now + delay,
					});
				} else {
					// Max retries exceeded - drop event
					this.debug("Event dropped after max retries", {
						event: item.event.event,
						retries: item.retries,
					});
				}
			}
			this.persistQueue();
			this.debug("Flush failed, scheduling retry with backoff", {
				error,
				retriesRemaining: ANALYTICS_MAX_RETRIES - (batch[0]?.retries ?? 0),
				nextRetryIn: this.calculateBackoffDelay((batch[0]?.retries ?? 0) + 1),
			});
		}
	}

	/**
	 * Calculate exponential backoff delay with jitter
	 *
	 * Formula: min(base * 2^retries, maxDelay) * (1 ± jitter)
	 * This prevents thundering herd when multiple clients fail simultaneously.
	 */
	private calculateBackoffDelay(retryCount: number): number {
		// Exponential: base * 2^retries
		const exponentialDelay =
			ANALYTICS_RETRY_BASE_DELAY_MS * Math.pow(2, retryCount - 1);

		// Cap at max delay
		const cappedDelay = Math.min(
			exponentialDelay,
			ANALYTICS_RETRY_MAX_DELAY_MS,
		);

		// Add jitter: ±JITTER%
		const jitterRange = cappedDelay * ANALYTICS_RETRY_JITTER;
		const jitter = (Math.random() * 2 - 1) * jitterRange;

		return Math.round(cappedDelay + jitter);
	}

	private async sendBatch(events: AnalyticsEvent[]): Promise<void> {
		const endpoint =
			this.config.apiEndpoint ?? `${SDK_API_PATH}/analytics/track`;

		const payload = {
			events: events,
		};

		const headers: Record<string, string> = {
			"Content-Type": "application/json",
		};
		if (this.config.apiKey) {
			headers["x-app-secret"] = this.config.apiKey;
		}

		const response = await fetch(endpoint, {
			method: "POST",
			headers,
			body: JSON.stringify(payload),
			keepalive: true, // Allow request to complete on page unload
		});

		if (!response.ok) {
			throw new Error(`Analytics send failed: ${response.status}`);
		}
	}

	// ==========================================
	// Flush Interval
	// ==========================================

	private startFlushInterval(): void {
		if (this.flushTimeout) return;

		const interval = this.config.flushInterval ?? ANALYTICS_FLUSH_INTERVAL_MS;

		const scheduleFlush = () => {
			this.flushTimeout = setTimeout(() => {
				void this.flush();
				scheduleFlush();
			}, interval);
		};

		scheduleFlush();
	}

	private stopFlushInterval(): void {
		if (this.flushTimeout) {
			clearTimeout(this.flushTimeout);
			this.flushTimeout = null;
		}
	}

	// ==========================================
	// Context Helpers
	// ==========================================

	/**
	 * Get device context with User-Agent Client Hints API support
	 *
	 * Uses the modern Client Hints API when available, falls back to
	 * basic detection for older browsers.
	 *
	 * @see https://developer.mozilla.org/en-US/docs/Web/API/User-Agent_Client_Hints_API
	 */
	private getDeviceContext(): DeviceContext {
		if (typeof window === "undefined") return {};

		const context: DeviceContext = {
			$screen_height: window.screen.height,
			$screen_width: window.screen.width,
			$viewport_height: window.innerHeight,
			$viewport_width: window.innerWidth,
			$device_pixel_ratio: window.devicePixelRatio,
			$browser_language: navigator.language,
			$timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
		};

		// Use User-Agent Client Hints API if available (Chromium browsers)
		// @see https://developer.mozilla.org/en-US/docs/Web/API/NavigatorUAData
		const uaData = (navigator as NavigatorWithUAData).userAgentData;
		if (uaData) {
			// Sync properties (low entropy, always available)
			context.$device_type = uaData.mobile ? "Mobile" : "Desktop";
			context.$os = uaData.platform;

			// Get browser from brands (use first significant brand)
			const brand = uaData.brands?.find(
				(b) => !b.brand.includes("Not") && b.brand !== "Chromium",
			);
			if (brand) {
				context.$browser = brand.brand;
				context.$browser_version = brand.version;
			}
		} else {
			// Fallback: Basic detection from user agent string
			context.$device_type = this.detectDeviceType();
			const browserInfo = this.detectBrowser();
			context.$browser = browserInfo.name;
			context.$browser_version = browserInfo.version;
			context.$os = this.detectOS();
		}

		return context;
	}

	/**
	 * Detect device type from screen size (fallback when Client Hints unavailable)
	 */
	private detectDeviceType(): DeviceContext["$device_type"] {
		if (typeof window === "undefined") return undefined;

		const width = window.screen.width;
		const isTouchDevice =
			"ontouchstart" in window || navigator.maxTouchPoints > 0;

		if (!isTouchDevice) return "Desktop";
		if (width < 768) return "Mobile";
		if (width < 1024) return "Tablet";
		return "Desktop";
	}

	/**
	 * Detect browser from user agent (fallback when Client Hints unavailable)
	 */
	private detectBrowser(): { name?: string; version?: string } {
		if (typeof navigator === "undefined") return {};

		const ua = navigator.userAgent;
		let name: string | undefined;
		let version: string | undefined;

		// Order matters - check specific browsers first
		if (ua.includes("Firefox/")) {
			name = "Firefox";
			version = ua.match(/Firefox\/(\d+\.\d+)/)?.[1];
		} else if (ua.includes("Edg/")) {
			name = "Edge";
			version = ua.match(/Edg\/(\d+\.\d+)/)?.[1];
		} else if (ua.includes("Chrome/")) {
			name = "Chrome";
			version = ua.match(/Chrome\/(\d+\.\d+)/)?.[1];
		} else if (ua.includes("Safari/") && !ua.includes("Chrome")) {
			name = "Safari";
			version = ua.match(/Version\/(\d+\.\d+)/)?.[1];
		}

		return { name, version };
	}

	/**
	 * Detect OS from user agent (fallback when Client Hints unavailable)
	 */
	private detectOS(): string | undefined {
		if (typeof navigator === "undefined") return undefined;

		const ua = navigator.userAgent;

		if (ua.includes("Windows")) return "Windows";
		if (ua.includes("Mac OS X")) return "macOS";
		if (ua.includes("Linux")) return "Linux";
		if (ua.includes("Android")) return "Android";
		if (ua.includes("iPhone") || ua.includes("iPad")) return "iOS";

		return undefined;
	}

	private getPageContext(): PageContext {
		if (typeof window === "undefined") {
			return {
				$current_url: "",
				$host: "",
				$pathname: "",
			};
		}

		return {
			$current_url: window.location.href,
			$host: window.location.host,
			$pathname: window.location.pathname,
		};
	}

	// ==========================================
	// Attribution
	// ==========================================

	private captureAttribution(): void {
		if (typeof window === "undefined") return;

		// UTM params
		const params = new URLSearchParams(window.location.search);
		const utmKeys = [
			"utm_source",
			"utm_medium",
			"utm_campaign",
			"utm_term",
			"utm_content",
		] as const;

		for (const key of utmKeys) {
			const value = params.get(key);
			if (value) {
				(this.attribution as Record<string, string | undefined>)[key] = value;

				// Also store as initial if not already set
				const initialKey = `$initial_${key}`;
				if (!this.loadInitialAttribution(initialKey as keyof AttributionData)) {
					(this.attribution as Record<string, string | undefined>)[initialKey] =
						value;
					this.persistInitialAttribution(
						initialKey as keyof AttributionData,
						value,
					);
				}
			}
		}

		// Referrer
		const referrer = document.referrer;
		if (referrer) {
			const referrerData = analyzeReferrer(referrer);
			this.attribution = { ...this.attribution, ...referrerData };

			// Store initial referrer
			if (!this.loadInitialAttribution("$initial_referrer")) {
				this.attribution.$initial_referrer = referrer;
				this.attribution.$initial_referring_domain =
					referrerData.$referring_domain;
				this.persistInitialAttribution("$initial_referrer", referrer);
				if (referrerData.$referring_domain) {
					this.persistInitialAttribution(
						"$initial_referring_domain",
						referrerData.$referring_domain,
					);
				}
			}
		}
	}

	// ==========================================
	// Persistence
	// ==========================================

	private getStorageKey(suffix: string): string {
		return `sylphx_analytics_${suffix}`;
	}

	private getStorage(): Storage | null {
		if (typeof window === "undefined") return null;

		switch (this.config.persistence) {
			case "localStorage":
				return localStorage;
			case "cookie":
				// Cookie storage handled separately via document.cookie
				// Fall back to localStorage for compatibility
				return localStorage;
			case "none":
				return null;
			default:
				return localStorage;
		}
	}

	private getOrCreateAnonymousId(): string {
		const storage = this.getStorage();
		if (storage) {
			const stored = storage.getItem(this.getStorageKey("anon_id"));
			if (stored) return stored;
		}

		const id = this.generateId();
		this.persistAnonymousId(id);
		return id;
	}

	private persistAnonymousId(id: string): void {
		const storage = this.getStorage();
		if (storage) {
			storage.setItem(this.getStorageKey("anon_id"), id);
		}
	}

	private persistDistinctId(id: string): void {
		const storage = this.getStorage();
		if (storage) {
			storage.setItem(this.getStorageKey("distinct_id"), id);
		}
	}

	private clearDistinctId(): void {
		const storage = this.getStorage();
		if (storage) {
			storage.removeItem(this.getStorageKey("distinct_id"));
		}
	}

	private getOrCreateSessionId(): string {
		const storage = this.getStorage();
		if (storage) {
			const stored = storage.getItem(this.getStorageKey("session_id"));
			const timestamp = storage.getItem(this.getStorageKey("session_ts"));

			if (stored && timestamp) {
				const lastActivity = Number.parseInt(timestamp, 10);
				const timeout =
					this.config.sessionTimeout ?? ANALYTICS_SESSION_TIMEOUT_MS;

				if (Date.now() - lastActivity < timeout) {
					// Update timestamp
					storage.setItem(
						this.getStorageKey("session_ts"),
						Date.now().toString(),
					);
					return stored;
				}
			}
		}

		const id = this.generateId();
		this.persistSessionId(id);
		return id;
	}

	private persistSessionId(id: string): void {
		const storage = this.getStorage();
		if (storage) {
			storage.setItem(this.getStorageKey("session_id"), id);
			storage.setItem(this.getStorageKey("session_ts"), Date.now().toString());
		}
	}

	private loadQueue(): void {
		const storage = this.getStorage();
		if (storage) {
			const stored = storage.getItem(this.getStorageKey("queue"));
			if (stored) {
				try {
					this.queue = JSON.parse(stored);
				} catch {
					this.queue = [];
				}
			}
		}
	}

	private persistQueue(): void {
		const storage = this.getStorage();
		if (storage) {
			storage.setItem(this.getStorageKey("queue"), JSON.stringify(this.queue));
		}
	}

	private loadInitialAttribution(key: keyof AttributionData): string | null {
		const storage = this.getStorage();
		if (storage) {
			return storage.getItem(this.getStorageKey(key));
		}
		return null;
	}

	private persistInitialAttribution(
		key: keyof AttributionData,
		value: string,
	): void {
		const storage = this.getStorage();
		if (storage) {
			storage.setItem(this.getStorageKey(key), value);
		}
	}

	// ==========================================
	// Utilities
	// ==========================================

	private generateId(): string {
		// Use crypto.randomUUID if available, otherwise fallback to manual UUID v4
		if (typeof crypto !== "undefined" && crypto.randomUUID) {
			return crypto.randomUUID();
		}
		return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
			const r = (Math.random() * 16) | 0;
			const v = c === "x" ? r : (r & 0x3) | 0x8;
			return v.toString(16);
		});
	}

	private debug(message: string, data?: unknown): void {
		if (this.config.debug) {
			console.log(`[Analytics] ${message}`, data ?? "");
		}
	}
}

// ==========================================
// Singleton
// ==========================================

let trackerInstance: AnalyticsTracker | null = null;

/**
 * Get or create analytics tracker
 */
export function getAnalyticsTracker(
	config?: Partial<AnalyticsConfig>,
): AnalyticsTracker {
	if (!trackerInstance) {
		trackerInstance = new AnalyticsTracker(config);
	}
	return trackerInstance;
}

/**
 * Initialize analytics
 */
export function initAnalytics(
	config?: Partial<AnalyticsConfig>,
): AnalyticsTracker {
	const tracker = getAnalyticsTracker(config);
	tracker.init();
	return tracker;
}

/**
 * Reset analytics instance (for testing)
 */
export function resetAnalyticsTracker(): void {
	trackerInstance?.shutdown();
	trackerInstance = null;
}
