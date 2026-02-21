/**
 * @sylphx/platform-sdk/web-analytics
 *
 * Web Analytics entry point.
 * Exports the tracker, hook, and types for web page-view analytics.
 *
 * @example
 * ```typescript
 * import { initWebAnalytics } from '@sylphx/platform-sdk/web-analytics'
 *
 * initWebAnalytics({
 *   appKey: process.env.NEXT_PUBLIC_SYLPHX_APP_KEY!,
 *   endpoint: '',  // empty = same origin
 * })
 * ```
 */

export {
	WebAnalyticsTracker,
	getWebAnalyticsTracker,
	initWebAnalytics,
	type WebAnalyticsOptions,
	type PageViewPayload,
	type IdentifyPayload,
} from "./lib/analytics/web-analytics";
