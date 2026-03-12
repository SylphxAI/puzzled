/**
 * Web Analytics Tracker
 *
 * Lightweight page-view analytics tracker for Sylphx Platform SDK.
 * Automatically tracks page views, bounce rate, and session data.
 *
 * @example
 * ```typescript
 * import { SDK_API_PATH } from "../../constants";
import { WebAnalyticsTracker } from '@sylphx/platform-sdk/web-analytics'
 *
 * const tracker = new WebAnalyticsTracker()
 * tracker.init({
 *   appKey: 'app_prod_xxx',
 *   endpoint: 'https://your-app.com',
 * })
 * ```
 */

import { SDK_API_PATH } from '../../constants'

// ============================================
// Types
// ============================================

export interface WebAnalyticsOptions {
	/** App key for authentication */
	appKey: string
	/** Base endpoint URL (without trailing slash) */
	endpoint: string
	/** Auto-track page views (default: true) */
	trackPageViews?: boolean
	/** Track bounce rate (sessions with only 1 page view) (default: true) */
	trackBounce?: boolean
	/** SPA hash routing mode (tracks hash changes) (default: false) */
	hashMode?: boolean
	/** Debug logging (default: false) */
	debug?: boolean
}

export interface PageViewPayload {
	/** URL path (e.g. /about) */
	path: string
	/** Document referrer */
	referrer: string
	/** Navigator user agent */
	userAgent: string
	/** Screen width in pixels */
	screenWidth: number
	/** Session ID (UUID stored in sessionStorage) */
	sessionId: string
	/** Unix timestamp (ms) */
	timestamp: number
}

export interface IdentifyPayload {
	/** User ID */
	userId: string
	/** User traits/properties */
	traits?: Record<string, unknown>
	/** Session ID */
	sessionId: string
}

// ============================================
// Utilities
// ============================================

function generateSessionId(): string {
	if (typeof crypto !== 'undefined' && crypto.randomUUID) {
		return crypto.randomUUID()
	}
	// Fallback for older environments
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
		const r = (Math.random() * 16) | 0
		const v = c === 'x' ? r : (r & 0x3) | 0x8
		return v.toString(16)
	})
}

function getOrCreateSessionId(): string {
	if (typeof sessionStorage === 'undefined') return generateSessionId()
	const key = '_sylphx_sid'
	let id = sessionStorage.getItem(key)
	if (!id) {
		id = generateSessionId()
		sessionStorage.setItem(key, id)
	}
	return id
}

function getCurrentPath(hashMode: boolean): string {
	if (typeof window === 'undefined' || !window.location) return '/'
	if (hashMode) {
		return window.location.hash.replace(/^#/, '') || '/'
	}
	return window.location.pathname + window.location.search
}

// ============================================
// WebAnalyticsTracker
// ============================================

export class WebAnalyticsTracker {
	private options: Required<WebAnalyticsOptions> | null = null
	private initialized = false
	private lastPath: string | null = null
	private pageViewCount = 0
	private cleanupFns: Array<() => void> = []

	/**
	 * Initialize the tracker and start auto-tracking page views
	 */
	init(options: WebAnalyticsOptions): void {
		if (typeof window === 'undefined') return
		if (this.initialized) return

		this.options = {
			trackPageViews: true,
			trackBounce: true,
			hashMode: false,
			debug: false,
			...options,
		}

		this.initialized = true

		if (this.options.trackPageViews) {
			// Track current page view
			this.trackPageView()

			// Track Next.js router events (soft navigation)
			this._hookNextRouter()

			// Track hash changes (for hash-mode SPAs)
			if (this.options.hashMode) {
				const onHashChange = () => this.trackPageView()
				window.addEventListener('hashchange', onHashChange)
				this.cleanupFns.push(() => window.removeEventListener('hashchange', onHashChange))
			}

			// Track History API (pushState / replaceState)
			this._hookHistoryApi()
		}

		if (this.options.debug) {
			console.log('[WebAnalytics] Initialized', this.options)
		}
	}

	/**
	 * Manually track a page view
	 */
	trackPageView(path?: string): void {
		if (!this.options) return
		if (typeof window === 'undefined') return

		const currentPath = path ?? getCurrentPath(this.options.hashMode)

		// Avoid duplicate tracking on same path
		if (currentPath === this.lastPath) return
		this.lastPath = currentPath
		this.pageViewCount++

		const payload: PageViewPayload = {
			path: currentPath,
			referrer: typeof document !== 'undefined' ? document.referrer || '' : '',
			userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
			screenWidth: window.screen?.width,
			sessionId: getOrCreateSessionId(),
			timestamp: Date.now(),
		}

		if (this.options.debug) {
			console.log('[WebAnalytics] Page view:', payload)
		}

		this._send(`${SDK_API_PATH}/analytics/pageview`, payload)
	}

	/**
	 * Identify a user
	 */
	identify(userId: string, traits?: Record<string, unknown>): void {
		if (!this.options) return
		if (typeof window === 'undefined') return

		const payload: IdentifyPayload = {
			userId,
			traits,
			sessionId: getOrCreateSessionId(),
		}

		if (this.options.debug) {
			console.log('[WebAnalytics] Identify:', payload)
		}

		this._send(`${SDK_API_PATH}/analytics/identify`, payload)
	}

	/**
	 * Destroy the tracker and remove event listeners
	 */
	destroy(): void {
		for (const fn of this.cleanupFns) {
			fn()
		}
		this.cleanupFns = []
		this.initialized = false
		this.options = null
		this.lastPath = null
		this.pageViewCount = 0
	}

	// ==========================================
	// Private helpers
	// ==========================================

	private _send(path: string, payload: unknown): void {
		if (!this.options) return

		const url = `${this.options.endpoint}${path}`
		const data = JSON.stringify(payload)

		try {
			if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
				const blob = new Blob([data], { type: 'application/json' })
				const sent = navigator.sendBeacon(url, blob)
				if (!sent && this.options.debug) {
					console.warn('[WebAnalytics] sendBeacon failed, falling back to fetch')
				}
				if (sent) return
			}

			// Fallback: fetch with keepalive
			fetch(url, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'x-app-key': this.options.appKey,
				},
				body: data,
				keepalive: true,
			}).catch((err) => {
				if (this.options?.debug) {
					console.error('[WebAnalytics] Failed to send:', err)
				}
			})
		} catch (err) {
			if (this.options?.debug) {
				console.error('[WebAnalytics] Send error:', err)
			}
		}
	}

	private _hookHistoryApi(): void {
		if (typeof window === 'undefined') return

		const originalPush = window.history.pushState.bind(window.history)
		const originalReplace = window.history.replaceState.bind(window.history)

		window.history.pushState = (...args) => {
			originalPush(...args)
			// Small delay to allow URL to update
			setTimeout(() => this.trackPageView(), 0)
		}

		window.history.replaceState = (...args) => {
			originalReplace(...args)
			// Don't track replaceState (usually internal SPA navigation)
		}

		const onPopState = () => setTimeout(() => this.trackPageView(), 0)
		window.addEventListener('popstate', onPopState)

		this.cleanupFns.push(() => {
			window.history.pushState = originalPush
			window.history.replaceState = originalReplace
			window.removeEventListener('popstate', onPopState)
		})
	}

	private _hookNextRouter(): void {
		// Next.js App Router: listen to route-change events dispatched on document
		if (typeof document === 'undefined') return

		// Next.js 13+ soft navigation events
		const onRouteAnnounced = () => setTimeout(() => this.trackPageView(), 0)
		document.addEventListener('nextjs:route-announced', onRouteAnnounced as EventListener)

		this.cleanupFns.push(() => {
			document.removeEventListener('nextjs:route-announced', onRouteAnnounced as EventListener)
		})
	}
}

// ============================================
// Singleton instance
// ============================================

let _tracker: WebAnalyticsTracker | null = null

/**
 * Get or create the global WebAnalyticsTracker singleton
 */
export function getWebAnalyticsTracker(): WebAnalyticsTracker {
	if (!_tracker) {
		_tracker = new WebAnalyticsTracker()
	}
	return _tracker
}

/**
 * Initialize global web analytics tracker
 */
export function initWebAnalytics(options: WebAnalyticsOptions): void {
	getWebAnalyticsTracker().init(options)
}
