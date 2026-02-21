/**
 * WebAnalytics React Component
 *
 * Drop-in component that auto-tracks page views. Works with Next.js App Router,
 * Pages Router, and any React SPA. Add to your root layout once.
 *
 * @example
 * ```tsx
 * // app/layout.tsx
 * import { WebAnalytics } from '@sylphx/platform-sdk/react'
 *
 * export default function Layout({ children }) {
 *   return (
 *     <html>
 *       <body>
 *         {children}
 *         <WebAnalytics appKey={process.env.NEXT_PUBLIC_SYLPHX_APP_KEY} />
 *       </body>
 *     </html>
 *   )
 * }
 * ```
 */

"use client";

import { useEffect } from "react";
import {
	type WebAnalyticsOptions,
	getWebAnalyticsTracker,
} from "../../lib/analytics/web-analytics";

export interface WebAnalyticsProps {
	/** App key (NEXT_PUBLIC_SYLPHX_APP_KEY) */
	appKey?: string;
	/** API endpoint base URL (default: empty = same-origin) */
	endpoint?: string;
	/** Auto-track page views (default: true) */
	trackPageViews?: boolean;
	/** SPA hash-routing mode (default: false) */
	hashMode?: boolean;
	/** Debug logging (default: false in prod) */
	debug?: boolean;
}

/**
 * WebAnalytics Component
 *
 * Auto-tracks page views, handles Next.js soft navigation,
 * and integrates with the Sylphx Analytics backend.
 */
export function WebAnalytics({
	appKey,
	endpoint = "",
	trackPageViews = true,
	hashMode = false,
	debug = false,
}: WebAnalyticsProps) {
	useEffect(() => {
		if (!appKey) {
			if (debug) {
				console.warn("[WebAnalytics] No appKey provided, tracking disabled");
			}
			return;
		}

		const options: WebAnalyticsOptions = {
			appKey,
			endpoint,
			trackPageViews,
			hashMode,
			debug,
		};

		const tracker = getWebAnalyticsTracker();
		tracker.init(options);

		// Cleanup on unmount (rare in layout components)
		return () => {
			// Don't destroy — it would break navigations. Tracker is a singleton.
		};
	}, [appKey, endpoint, trackPageViews, hashMode, debug]);

	// Render nothing
	return null;
}

// ============================================
// useWebAnalytics hook
// ============================================

export interface UseWebAnalyticsReturn {
	/** Manually track a page view */
	trackPageView: (path?: string) => void;
	/** Identify a user */
	identify: (userId: string, traits?: Record<string, unknown>) => void;
}

/**
 * Hook for manual web analytics tracking
 *
 * @example
 * ```tsx
 * function CheckoutSuccess() {
 *   const { trackPageView, identify } = useWebAnalytics()
 *
 *   useEffect(() => {
 *     identify(user.id, { plan: 'pro' })
 *   }, [user.id])
 * }
 * ```
 */
export function useWebAnalytics(): UseWebAnalyticsReturn {
	const tracker = getWebAnalyticsTracker();

	return {
		trackPageView: (path?: string) => tracker.trackPageView(path),
		identify: (userId: string, traits?: Record<string, unknown>) =>
			tracker.identify(userId, traits),
	};
}
