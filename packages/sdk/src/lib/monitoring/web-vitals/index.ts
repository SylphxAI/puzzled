/**
 * Web Vitals Monitoring
 *
 * State-of-the-art Core Web Vitals measurement with automatic reporting
 * and analytics integration.
 *
 * ## Metrics Captured
 *
 * **Core Web Vitals (CWV)**:
 * - **LCP** (Largest Contentful Paint): Loading performance
 * - **INP** (Interaction to Next Paint): Interactivity (replaced FID)
 * - **CLS** (Cumulative Layout Shift): Visual stability
 *
 * **Additional Metrics**:
 * - **TTFB** (Time to First Byte): Server response time
 * - **FCP** (First Contentful Paint): First render time
 *
 * ## Usage
 *
 * @example
 * ```typescript
 * import { initWebVitals, getWebVitalsReport } from '@sylphx/platform-sdk'
 *
 * // Initialize with automatic reporting
 * initWebVitals({
 *   reportUrl: '/api/sdk/v1/monitoring/vitals',
 *   onReport: (metric) => console.log(metric),
 *   debug: process.env.NODE_ENV === 'development',
 * })
 *
 * // Get current metrics
 * const report = getWebVitalsReport()
 * ```
 *
 * @see https://web.dev/articles/vitals
 */

import {
	type CLSMetric,
	type FCPMetric,
	type INPMetric,
	type LCPMetric,
	type Metric,
	type ReportOpts,
	type TTFBMetric,
	onCLS,
	onFCP,
	onINP,
	onLCP,
	onTTFB,
} from "web-vitals";
import {
	WEB_VITALS_FCP_GOOD_MS,
	WEB_VITALS_FCP_POOR_MS,
	WEB_VITALS_INP_GOOD_MS,
	WEB_VITALS_INP_POOR_MS,
	WEB_VITALS_LCP_GOOD_MS,
	WEB_VITALS_LCP_POOR_MS,
	WEB_VITALS_TTFB_GOOD_MS,
	WEB_VITALS_TTFB_POOR_MS,
} from "../../../constants";

// ============================================
// Types
// ============================================

/** Core Web Vital metric names */
export type CoreWebVitalName = "CLS" | "INP" | "LCP";

/** All tracked metric names */
export type WebVitalName = CoreWebVitalName | "FCP" | "TTFB";

/** Metric rating thresholds */
export type MetricRating = "good" | "needs-improvement" | "poor";

/** Enhanced metric with additional context */
export interface WebVitalMetric {
	/** Metric name (e.g., 'LCP', 'CLS', 'INP') */
	name: WebVitalName;
	/** Metric value */
	value: number;
	/** Metric rating based on thresholds */
	rating: MetricRating;
	/** Delta from previous value */
	delta: number;
	/** Unique metric ID */
	id: string;
	/** Navigation type */
	navigationType:
		| "navigate"
		| "reload"
		| "back-forward"
		| "back-forward-cache"
		| "prerender"
		| "restore";
	/** Attribution data for debugging */
	attribution?: WebVitalAttribution;
	/** Timestamp when metric was captured */
	timestamp: number;
}

/** Attribution data for debugging metrics */
export interface WebVitalAttribution {
	/** Element contributing to the metric (for LCP, CLS) */
	element?: string;
	/** Target element for INP */
	eventTarget?: string;
	/** Event type for INP */
	eventType?: string;
	/** Event time for INP */
	eventTime?: number;
	/** Time to first byte breakdown (for TTFB) */
	waitingDuration?: number;
	cacheDuration?: number;
	dnsDuration?: number;
	connectionDuration?: number;
	requestDuration?: number;
	/** LCP resource info */
	lcpResourceEntry?: string;
	/** Largest shift sources for CLS */
	largestShiftSources?: string[];
}

/** Report containing all captured metrics */
export interface WebVitalsReport {
	/** Core Web Vitals */
	lcp?: WebVitalMetric;
	inp?: WebVitalMetric;
	cls?: WebVitalMetric;
	/** Additional metrics */
	fcp?: WebVitalMetric;
	ttfb?: WebVitalMetric;
	/** Overall score (0-100) */
	score: number;
	/** Page URL */
	url: string;
	/** User agent */
	userAgent: string;
	/** Report timestamp */
	timestamp: number;
}

/** Web Vitals configuration */
export interface WebVitalsConfig {
	/** URL to report metrics to (POST request) */
	reportUrl?: string;
	/** Callback for each metric */
	onReport?: (metric: WebVitalMetric) => void;
	/** Report all metrics at once (on page unload) */
	onReportAll?: (report: WebVitalsReport) => void;
	/** Enable debug logging */
	debug?: boolean;
	/** Custom headers for reporting */
	headers?: Record<string, string>;
	/** Report immediately or batch (default: immediate) */
	reportingMode?: "immediate" | "batch";
	/** Attribution level: 'basic' or 'detailed' */
	attribution?: "basic" | "detailed";
	/** Sampling rate (0-1, default: 1.0) */
	samplingRate?: number;
}

// ============================================
// Thresholds
// ============================================

/**
 * Core Web Vitals thresholds (from web.dev)
 * @see https://web.dev/articles/vitals
 */
export const WEB_VITALS_THRESHOLDS = {
	// Core Web Vitals
	LCP: { good: WEB_VITALS_LCP_GOOD_MS, poor: WEB_VITALS_LCP_POOR_MS }, // ms
	INP: { good: WEB_VITALS_INP_GOOD_MS, poor: WEB_VITALS_INP_POOR_MS }, // ms
	CLS: { good: 0.1, poor: 0.25 }, // score (not time-based)

	// Additional metrics
	FCP: { good: WEB_VITALS_FCP_GOOD_MS, poor: WEB_VITALS_FCP_POOR_MS }, // ms
	TTFB: { good: WEB_VITALS_TTFB_GOOD_MS, poor: WEB_VITALS_TTFB_POOR_MS }, // ms
} as const;

/** Default configuration */
export const DEFAULT_WEB_VITALS_CONFIG: Required<WebVitalsConfig> = {
	reportUrl: "",
	onReport: () => {},
	onReportAll: () => {},
	debug: false,
	headers: {},
	reportingMode: "immediate",
	attribution: "basic",
	samplingRate: 1.0,
};

// ============================================
// State
// ============================================

let config: Required<WebVitalsConfig> = { ...DEFAULT_WEB_VITALS_CONFIG };
let initialized = false;
let metrics: Partial<Record<WebVitalName, WebVitalMetric>> = {};

// ============================================
// Utilities
// ============================================

/**
 * Get metric rating based on thresholds
 */
function getRating(name: WebVitalName, value: number): MetricRating {
	const threshold = WEB_VITALS_THRESHOLDS[name];
	if (value <= threshold.good) return "good";
	if (value <= threshold.poor) return "needs-improvement";
	return "poor";
}

/**
 * Calculate overall score (0-100)
 */
function calculateScore(
	report: Partial<Record<WebVitalName, WebVitalMetric>>,
): number {
	const weights = {
		LCP: 25,
		INP: 30,
		CLS: 25,
		FCP: 10,
		TTFB: 10,
	};

	let totalWeight = 0;
	let weightedScore = 0;

	for (const [name, weight] of Object.entries(weights)) {
		const metric = report[name as WebVitalName];
		if (metric) {
			totalWeight += weight;
			const metricScore =
				metric.rating === "good"
					? 100
					: metric.rating === "needs-improvement"
						? 50
						: 0;
			weightedScore += metricScore * weight;
		}
	}

	return totalWeight > 0 ? Math.round(weightedScore / totalWeight) : 0;
}

/**
 * Extract attribution data from metric
 */
function extractAttribution(metric: Metric): WebVitalAttribution | undefined {
	if (config.attribution === "basic") return undefined;

	const attribution: WebVitalAttribution = {};

	// Type-safe attribution extraction
	const entries = metric.entries;
	if (entries.length > 0) {
		const entry = entries[0];

		// LCP attribution
		if ("element" in entry && entry.element instanceof Element) {
			attribution.element = entry.element.tagName.toLowerCase();
			if (entry.element.id) attribution.element += `#${entry.element.id}`;
			if (
				entry.element.className &&
				typeof entry.element.className === "string"
			) {
				attribution.element += `.${entry.element.className.split(" ")[0]}`;
			}
		}

		// INP attribution
		if ("target" in entry && entry.target instanceof Element) {
			attribution.eventTarget = entry.target.tagName?.toLowerCase();
		}
		if ("name" in entry && typeof entry.name === "string") {
			attribution.eventType = entry.name;
		}

		// TTFB attribution (from navigation timing)
		if ("serverTiming" in entry) {
			// Navigation timing entry has detailed breakdown
			const navEntry = entry as PerformanceNavigationTiming;
			attribution.dnsDuration =
				navEntry.domainLookupEnd - navEntry.domainLookupStart;
			attribution.connectionDuration =
				navEntry.connectEnd - navEntry.connectStart;
			attribution.requestDuration =
				navEntry.responseStart - navEntry.requestStart;
			attribution.waitingDuration =
				navEntry.responseEnd - navEntry.responseStart;
		}
	}

	return Object.keys(attribution).length > 0 ? attribution : undefined;
}

/**
 * Convert web-vitals metric to our enhanced type
 */
function toWebVitalMetric(metric: Metric): WebVitalMetric {
	return {
		name: metric.name as WebVitalName,
		value: metric.value,
		rating: getRating(metric.name as WebVitalName, metric.value),
		delta: metric.delta,
		id: metric.id,
		navigationType: metric.navigationType as WebVitalMetric["navigationType"],
		attribution: extractAttribution(metric),
		timestamp: Date.now(),
	};
}

/**
 * Report a metric
 */
async function reportMetric(metric: WebVitalMetric): Promise<void> {
	// Store metric
	metrics[metric.name] = metric;

	// Debug logging
	if (config.debug) {
		console.log(
			`[Web Vitals] ${metric.name}: ${metric.value.toFixed(2)} (${metric.rating})`,
		);
	}

	// Call callback
	config.onReport(metric);

	// Send to server (immediate mode)
	if (config.reportUrl && config.reportingMode === "immediate") {
		try {
			// Use sendBeacon for reliability
			const data = JSON.stringify(metric);
			if (navigator.sendBeacon) {
				const blob = new Blob([data], { type: "application/json" });
				navigator.sendBeacon(config.reportUrl, blob);
			} else {
				await fetch(config.reportUrl, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						...config.headers,
					},
					body: data,
					keepalive: true,
				});
			}
		} catch (error) {
			if (config.debug) {
				console.error("[Web Vitals] Failed to report metric:", error);
			}
		}
	}
}

/**
 * Report all metrics (batch mode, on page unload)
 */
async function reportAllMetrics(): Promise<void> {
	const report = getWebVitalsReport();

	// Call callback
	config.onReportAll(report);

	// Send to server
	if (config.reportUrl && config.reportingMode === "batch") {
		try {
			const data = JSON.stringify(report);
			if (navigator.sendBeacon) {
				const blob = new Blob([data], { type: "application/json" });
				navigator.sendBeacon(config.reportUrl, blob);
			} else {
				await fetch(config.reportUrl, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						...config.headers,
					},
					body: data,
					keepalive: true,
				});
			}
		} catch (error) {
			if (config.debug) {
				console.error("[Web Vitals] Failed to report all metrics:", error);
			}
		}
	}
}

// ============================================
// Public API
// ============================================

/**
 * Initialize Web Vitals monitoring
 *
 * @param userConfig - Configuration options
 *
 * @example
 * ```typescript
 * initWebVitals({
 *   reportUrl: '/api/sdk/v1/monitoring/vitals',
 *   debug: process.env.NODE_ENV === 'development',
 *   attribution: 'detailed',
 *   onReport: (metric) => {
 *     console.log(`${metric.name}: ${metric.value}`)
 *   },
 * })
 * ```
 */
export function initWebVitals(userConfig: WebVitalsConfig = {}): void {
	if (typeof window === "undefined") return;
	if (initialized) return;

	// Apply sampling
	const samplingRate =
		userConfig.samplingRate ?? DEFAULT_WEB_VITALS_CONFIG.samplingRate;
	if (Math.random() > samplingRate) {
		if (userConfig.debug) {
			console.log("[Web Vitals] Sampling skipped this page view");
		}
		return;
	}

	config = { ...DEFAULT_WEB_VITALS_CONFIG, ...userConfig };
	initialized = true;
	metrics = {};

	// Report options
	const reportOpts: ReportOpts = {
		reportAllChanges: false,
	};

	// Register metric handlers
	onCLS(
		(metric: CLSMetric) => reportMetric(toWebVitalMetric(metric)),
		reportOpts,
	);
	onINP(
		(metric: INPMetric) => reportMetric(toWebVitalMetric(metric)),
		reportOpts,
	);
	onLCP(
		(metric: LCPMetric) => reportMetric(toWebVitalMetric(metric)),
		reportOpts,
	);
	onFCP(
		(metric: FCPMetric) => reportMetric(toWebVitalMetric(metric)),
		reportOpts,
	);
	onTTFB(
		(metric: TTFBMetric) => reportMetric(toWebVitalMetric(metric)),
		reportOpts,
	);

	// Report all on page unload (for batch mode)
	if (config.reportingMode === "batch") {
		window.addEventListener("visibilitychange", () => {
			if (document.visibilityState === "hidden") {
				reportAllMetrics();
			}
		});
	}

	if (config.debug) {
		console.log("[Web Vitals] Initialized");
	}
}

/**
 * Get current Web Vitals report
 *
 * @returns Current metrics report
 *
 * @example
 * ```typescript
 * const report = getWebVitalsReport()
 * console.log(`Overall score: ${report.score}`)
 * if (report.lcp) console.log(`LCP: ${report.lcp.value}ms`)
 * ```
 */
export function getWebVitalsReport(): WebVitalsReport {
	return {
		lcp: metrics.LCP,
		inp: metrics.INP,
		cls: metrics.CLS,
		fcp: metrics.FCP,
		ttfb: metrics.TTFB,
		score: calculateScore(metrics),
		url: typeof window !== "undefined" && window.location ? window.location.href : "",
		userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
		timestamp: Date.now(),
	};
}

/**
 * Get a specific metric value
 *
 * @param name - Metric name
 * @returns Metric value or undefined
 */
export function getMetric(name: WebVitalName): WebVitalMetric | undefined {
	return metrics[name];
}

/**
 * Check if Web Vitals are passing thresholds
 *
 * @returns Object with pass/fail status for each metric
 */
export function checkCoreWebVitals(): {
	lcp: boolean;
	inp: boolean;
	cls: boolean;
	passing: boolean;
} {
	const lcp =
		metrics.LCP?.rating === "good" ||
		metrics.LCP?.rating === "needs-improvement";
	const inp =
		metrics.INP?.rating === "good" ||
		metrics.INP?.rating === "needs-improvement";
	const cls =
		metrics.CLS?.rating === "good" ||
		metrics.CLS?.rating === "needs-improvement";

	return {
		lcp: lcp ?? false,
		inp: inp ?? false,
		cls: cls ?? false,
		passing: (lcp ?? false) && (inp ?? false) && (cls ?? false),
	};
}

/**
 * Reset Web Vitals tracking
 */
export function resetWebVitals(): void {
	metrics = {};
	initialized = false;
	config = { ...DEFAULT_WEB_VITALS_CONFIG };
}

/**
 * Check if Web Vitals are initialized
 */
export function isWebVitalsInitialized(): boolean {
	return initialized;
}

// Re-export useful types from web-vitals
export type { ReportOpts };
