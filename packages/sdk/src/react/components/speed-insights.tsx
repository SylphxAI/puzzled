/**
 * SpeedInsights React Component
 *
 * Auto-collects Core Web Vitals (LCP, CLS, INP, FCP, TTFB) and reports
 * them to the Sylphx analytics backend. Add to your root layout once.
 *
 * @example
 * ```tsx
 * // app/layout.tsx
 * import { SpeedInsights } from '@sylphx/platform-sdk/react'
 *
 * export default function Layout({ children }) {
 *   return (
 *     <html>
 *       <body>
 *         {children}
 *         <SpeedInsights appKey={process.env.NEXT_PUBLIC_SYLPHX_APP_KEY} />
 *       </body>
 *     </html>
 *   )
 * }
 * ```
 */

"use client";

import { useEffect } from "react";
import {
	type WebVitalMetric,
	initWebVitals,
} from "../../lib/monitoring/web-vitals";

export interface SpeedInsightsProps {
	/** App key (NEXT_PUBLIC_SYLPHX_APP_KEY) */
	appKey?: string;
	/** API endpoint base URL (default: empty = same-origin) */
	endpoint?: string;
	/** Sampling rate 0–1 (default: 1.0 = 100%) */
	samplingRate?: number;
	/** Debug logging */
	debug?: boolean;
	/** Report on every metric update, or only final values (default: false = final only) */
	reportAllChanges?: boolean;
}

export interface VitalReportPayload {
	name: "LCP" | "CLS" | "INP" | "FCP" | "TTFB";
	value: number;
	rating: "good" | "needs-improvement" | "poor";
	delta: number;
	id: string;
	navigationType: string;
	path: string;
}

function sendVital(
	url: string,
	appKey: string,
	payload: VitalReportPayload,
): void {
	const data = JSON.stringify(payload);
	const headers: Record<string, string> = {
		"Content-Type": "application/json",
	};
	if (appKey) headers["x-app-key"] = appKey;

	try {
		if (typeof navigator !== "undefined" && navigator.sendBeacon) {
			const blob = new Blob([data], { type: "application/json" });
			if (navigator.sendBeacon(url, blob)) return;
		}
		fetch(url, {
			method: "POST",
			headers,
			body: data,
			keepalive: true,
		}).catch(() => {});
	} catch {
		// Ignore send errors
	}
}

/**
 * SpeedInsights Component
 *
 * Automatically collects Core Web Vitals and reports them to
 * `POST /api/sdk/v1/analytics/vitals`.
 */
export function SpeedInsights({
	appKey,
	endpoint = "",
	samplingRate = 1.0,
	debug = false,
	reportAllChanges = false,
}: SpeedInsightsProps) {
	useEffect(() => {
		if (typeof window === "undefined") return;

		const reportUrl = `${endpoint}/api/sdk/v1/analytics/vitals`;

		initWebVitals({
			samplingRate,
			debug,
			reportingMode: "immediate",
			onReport: (metric: WebVitalMetric) => {
				const path = window.location.pathname + window.location.search;

				const payload: VitalReportPayload = {
					name: metric.name as VitalReportPayload["name"],
					value: metric.value,
					rating: metric.rating,
					delta: metric.delta,
					id: metric.id,
					navigationType: metric.navigationType,
					path,
				};

				if (appKey) {
					sendVital(reportUrl, appKey, payload);
				} else if (debug) {
					console.warn("[SpeedInsights] No appKey provided, not reporting");
				}
			},
		});
	}, [appKey, endpoint, samplingRate, debug, reportAllChanges]);

	return null;
}
