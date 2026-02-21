/**
 * SPA Navigation Tracking
 *
 * Tracks page views and navigation in single-page applications.
 * Works with pushState, replaceState, and popstate events.
 */

import type {
	DeviceContext,
	PageContext,
	ReferrerData,
	UtmParams,
} from "./types";

// ==========================================
// Types
// ==========================================

export interface PageViewEvent {
	url: string;
	path: string;
	title: string;
	referrer?: string;
	context: PageContext;
	utm?: UtmParams;
	device?: DeviceContext;
	timestamp: number;
	/** Time spent on previous page (ms) */
	previousPageTime?: number;
	/** Scroll depth on previous page (0-100) */
	previousScrollDepth?: number;
}

export interface PageLeaveEvent {
	url: string;
	path: string;
	timeOnPage: number;
	scrollDepth: number;
	timestamp: number;
}

type PageViewCallback = (event: PageViewEvent) => void;
type PageLeaveCallback = (event: PageLeaveEvent) => void;

// ==========================================
// Navigation Tracker
// ==========================================

/**
 * SPA Navigation Tracker
 *
 * Tracks page views and time on page for single-page applications.
 */
export class NavigationTracker {
	private pageViewCallback: PageViewCallback;
	private pageLeaveCallback?: PageLeaveCallback;
	private isEnabled = false;
	private currentPage: {
		url: string;
		path: string;
		enteredAt: number;
		maxScrollDepth: number;
	} | null = null;
	private cleanupFns: (() => void)[] = [];

	constructor(onPageView: PageViewCallback, onPageLeave?: PageLeaveCallback) {
		this.pageViewCallback = onPageView;
		this.pageLeaveCallback = onPageLeave;
	}

	// ==========================================
	// Lifecycle
	// ==========================================

	/**
	 * Start tracking navigation
	 */
	start(): void {
		if (typeof window === "undefined") return;
		if (this.isEnabled) return;

		this.isEnabled = true;

		// Track initial page view
		this.trackPageView();

		// Hook into History API
		this.hookHistoryApi();

		// Listen for popstate (back/forward)
		const popstateHandler = () => this.handleNavigation("popstate");
		window.addEventListener("popstate", popstateHandler);
		this.cleanupFns.push(() =>
			window.removeEventListener("popstate", popstateHandler),
		);

		// Track scroll depth
		this.trackScrollDepth();

		// Track page visibility changes
		this.trackVisibility();

		// Track page unload
		const beforeUnloadHandler = () => this.handlePageLeave();
		window.addEventListener("beforeunload", beforeUnloadHandler);
		this.cleanupFns.push(() =>
			window.removeEventListener("beforeunload", beforeUnloadHandler),
		);
	}

	/**
	 * Stop tracking navigation
	 */
	stop(): void {
		if (!this.isEnabled) return;

		this.isEnabled = false;

		// Run cleanup functions
		for (const cleanup of this.cleanupFns) {
			cleanup();
		}
		this.cleanupFns = [];

		// Fire page leave for current page
		if (this.currentPage) {
			this.handlePageLeave();
		}
	}

	/**
	 * Manually track a page view
	 */
	trackPageView(customUrl?: string): void {
		if (!this.isEnabled && !customUrl) return;

		const previousPage = this.currentPage;
		const now = Date.now();

		// Calculate previous page metrics
		let previousPageTime: number | undefined;
		let previousScrollDepth: number | undefined;

		if (previousPage) {
			previousPageTime = now - previousPage.enteredAt;
			previousScrollDepth = previousPage.maxScrollDepth;

			// Fire page leave for previous page
			if (this.pageLeaveCallback) {
				this.pageLeaveCallback({
					url: previousPage.url,
					path: previousPage.path,
					timeOnPage: previousPageTime,
					scrollDepth: previousScrollDepth,
					timestamp: now,
				});
			}
		}

		// Set current page
		const url = customUrl || window.location.href;
		const path = window.location.pathname;

		this.currentPage = {
			url,
			path,
			enteredAt: now,
			maxScrollDepth: 0,
		};

		// Build page view event
		const event: PageViewEvent = {
			url,
			path,
			title: document.title,
			referrer: previousPage?.url || document.referrer || undefined,
			context: this.getPageContext(),
			utm: this.getUtmParams(),
			device: this.getDeviceContext(),
			timestamp: now,
			previousPageTime,
			previousScrollDepth,
		};

		this.pageViewCallback(event);
	}

	// ==========================================
	// History API Hooks
	// ==========================================

	private hookHistoryApi(): void {
		// Store original methods
		const originalPushState = history.pushState.bind(history);
		const originalReplaceState = history.replaceState.bind(history);

		// Override pushState
		history.pushState = (...args) => {
			const result = originalPushState(...args);
			this.handleNavigation("pushState");
			return result;
		};

		// Override replaceState
		history.replaceState = (...args) => {
			const result = originalReplaceState(...args);
			this.handleNavigation("replaceState");
			return result;
		};

		// Cleanup: restore original methods
		this.cleanupFns.push(() => {
			history.pushState = originalPushState;
			history.replaceState = originalReplaceState;
		});
	}

	private handleNavigation(source: string): void {
		if (!this.isEnabled) return;

		// Debounce rapid navigations
		setTimeout(() => {
			const currentUrl = window.location.href;

			// Only track if URL actually changed
			if (this.currentPage?.url !== currentUrl) {
				this.trackPageView();
			}
		}, 0);
	}

	// ==========================================
	// Scroll Tracking
	// ==========================================

	private trackScrollDepth(): void {
		let ticking = false;

		const scrollHandler = () => {
			if (!ticking) {
				requestAnimationFrame(() => {
					this.updateScrollDepth();
					ticking = false;
				});
				ticking = true;
			}
		};

		window.addEventListener("scroll", scrollHandler, { passive: true });
		this.cleanupFns.push(() =>
			window.removeEventListener("scroll", scrollHandler),
		);

		// Also track on resize (content height may change)
		window.addEventListener("resize", scrollHandler, { passive: true });
		this.cleanupFns.push(() =>
			window.removeEventListener("resize", scrollHandler),
		);
	}

	private updateScrollDepth(): void {
		if (!this.currentPage) return;

		const scrollTop = window.scrollY || document.documentElement.scrollTop;
		const windowHeight = window.innerHeight;
		const documentHeight = Math.max(
			document.body.scrollHeight,
			document.documentElement.scrollHeight,
		);

		// Calculate scroll percentage
		const maxScroll = documentHeight - windowHeight;
		const scrollPercent =
			maxScroll > 0 ? Math.round((scrollTop / maxScroll) * 100) : 100;

		// Update max scroll depth
		if (scrollPercent > this.currentPage.maxScrollDepth) {
			this.currentPage.maxScrollDepth = Math.min(scrollPercent, 100);
		}
	}

	// ==========================================
	// Visibility Tracking
	// ==========================================

	private trackVisibility(): void {
		const visibilityHandler = () => {
			if (document.hidden) {
				// Page became hidden - could pause timer
			} else {
				// Page became visible - could resume timer
			}
		};

		document.addEventListener("visibilitychange", visibilityHandler);
		this.cleanupFns.push(() =>
			document.removeEventListener("visibilitychange", visibilityHandler),
		);
	}

	// ==========================================
	// Page Leave
	// ==========================================

	private handlePageLeave(): void {
		if (!this.currentPage || !this.pageLeaveCallback) return;

		const now = Date.now();
		const timeOnPage = now - this.currentPage.enteredAt;

		this.pageLeaveCallback({
			url: this.currentPage.url,
			path: this.currentPage.path,
			timeOnPage,
			scrollDepth: this.currentPage.maxScrollDepth,
			timestamp: now,
		});
	}

	// ==========================================
	// Context Helpers
	// ==========================================

	private getPageContext(): PageContext {
		return {
			$current_url: window.location.href,
			$host: window.location.host,
			$pathname: window.location.pathname,
			$search: window.location.search || undefined,
			$hash: window.location.hash || undefined,
			$title: document.title,
		};
	}

	private getUtmParams(): UtmParams | undefined {
		const params = new URLSearchParams(window.location.search);
		const utm: UtmParams = {};

		const utmKeys = [
			"utm_source",
			"utm_medium",
			"utm_campaign",
			"utm_term",
			"utm_content",
		] as const;

		let hasUtm = false;
		for (const key of utmKeys) {
			const value = params.get(key);
			if (value) {
				utm[key] = value;
				hasUtm = true;
			}
		}

		return hasUtm ? utm : undefined;
	}

	private getDeviceContext(): DeviceContext {
		const ua = navigator.userAgent;

		return {
			$device_type: this.detectDeviceType(ua),
			$os: this.detectOS(ua),
			$browser: this.detectBrowser(ua),
			$browser_language: navigator.language,
			$screen_height: window.screen.height,
			$screen_width: window.screen.width,
			$viewport_height: window.innerHeight,
			$viewport_width: window.innerWidth,
			$device_pixel_ratio: window.devicePixelRatio,
			$timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
		};
	}

	private detectDeviceType(ua: string): DeviceContext["$device_type"] {
		if (/bot|crawler|spider|crawling/i.test(ua)) return "Bot";
		if (/mobile/i.test(ua)) return "Mobile";
		if (/tablet|ipad/i.test(ua)) return "Tablet";
		return "Desktop";
	}

	private detectOS(ua: string): string | undefined {
		const osPatterns: [RegExp, string][] = [
			[/Windows NT 10/i, "Windows 10"],
			[/Windows NT 6.3/i, "Windows 8.1"],
			[/Windows NT 6.2/i, "Windows 8"],
			[/Windows/i, "Windows"],
			[/Mac OS X ([0-9_]+)/i, "macOS"],
			[/iPhone|iPad|iPod/i, "iOS"],
			[/Android ([0-9.]+)/i, "Android"],
			[/Linux/i, "Linux"],
			[/CrOS/i, "Chrome OS"],
		];

		for (const [pattern, name] of osPatterns) {
			if (pattern.test(ua)) {
				return name;
			}
		}

		return undefined;
	}

	private detectBrowser(ua: string): string | undefined {
		const browserPatterns: [RegExp, string][] = [
			[/Edg\//i, "Edge"],
			[/OPR\//i, "Opera"],
			[/Chrome\/([0-9.]+)/i, "Chrome"],
			[/Safari\/([0-9.]+)/i, "Safari"],
			[/Firefox\/([0-9.]+)/i, "Firefox"],
		];

		for (const [pattern, name] of browserPatterns) {
			if (pattern.test(ua)) {
				return name;
			}
		}

		return undefined;
	}
}

// ==========================================
// Referrer Analysis
// ==========================================

/**
 * Analyze referrer to determine traffic source
 */
export function analyzeReferrer(referrer: string): ReferrerData {
	if (!referrer) {
		return {
			$referrer_source: "direct",
		};
	}

	try {
		const url = new URL(referrer);
		const domain = url.hostname.replace("www.", "");

		const result: ReferrerData = {
			$referrer: referrer,
			$referring_domain: domain,
		};

		// Categorize traffic source
		const searchEngines = [
			"google",
			"bing",
			"yahoo",
			"duckduckgo",
			"baidu",
			"yandex",
		];
		const socialNetworks = [
			"facebook",
			"twitter",
			"linkedin",
			"instagram",
			"tiktok",
			"reddit",
			"pinterest",
			"youtube",
		];

		if (searchEngines.some((se) => domain.includes(se))) {
			result.$referrer_source = "organic";
		} else if (socialNetworks.some((sn) => domain.includes(sn))) {
			result.$referrer_source = "social";
		} else if (domain.includes("mail") || domain.includes("outlook")) {
			result.$referrer_source = "email";
		} else {
			result.$referrer_source = "unknown";
		}

		return result;
	} catch {
		return {
			$referrer: referrer,
			$referrer_source: "unknown",
		};
	}
}

// ==========================================
// Factory
// ==========================================

let navigationTrackerInstance: NavigationTracker | null = null;

/**
 * Initialize navigation tracker
 */
export function initNavigationTracker(
	onPageView: PageViewCallback,
	onPageLeave?: PageLeaveCallback,
): NavigationTracker {
	navigationTrackerInstance = new NavigationTracker(onPageView, onPageLeave);
	return navigationTrackerInstance;
}

/**
 * Get navigation tracker instance
 */
function getNavigationTracker(): NavigationTracker | null {
	return navigationTrackerInstance;
}
