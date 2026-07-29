/**
 * Platform Hooks
 *
 * Hooks for billing, analytics, notifications, and referrals.
 */

"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useContext } from "react";
import { STALE_TIME_FREQUENT_MS } from "../constants";
import {
	type AnalyticsQuery,
	type AnalyticsQueryResult,
	type ClickIds,
	type ConversionData,
	type DestinationPlatform,
	type InAppMessagePriority,
	type InAppMessageType,
	type InAppMessageWithReadStatus,
	type InboxPreferences,
	type Plan,
	PlatformContext,
	type PushPreferences,
	type RedeemResult,
	type ReferralRewardDefaults,
	type ReferralStats,
	type Subscription,
	type TrackOptions,
} from "./platform-context";
import { usePlatformContext } from "./types";

// ============================================
// useReferral
// ============================================

export interface UseReferralReturn {
	/** Referral statistics */
	stats: ReferralStats | null;
	/** Whether referral data is loading */
	isLoading: boolean;
	/** Error loading referral data */
	error: Error | null;
	/** Whether there was an error */
	isError: boolean;
	/** User's referral code */
	code: string | null;
	/** Referral link to share */
	link: string | null;
	/** Copy referral code to clipboard */
	copyCode: () => Promise<void>;
	/** Copy referral link to clipboard */
	copyLink: () => Promise<void>;
	/** Regenerate referral code */
	regenerateCode: () => Promise<string>;
	/**
	 * Redeem a referral code with optional inline defaults
	 *
	 * If the referral program rewards aren't configured in Console, the provided
	 * defaults will be used. Console can override any values without deployment.
	 *
	 * @param code - Referral code to redeem
	 * @param defaults - Optional inline defaults for reward configuration
	 *
	 * @example
	 * ```tsx
	 * const { redeemCode } = useReferral()
	 *
	 * const handleRedeem = async (code: string) => {
	 *   const result = await redeemCode(code, {
	 *     referrerReward: { type: 'premium_trial', days: 7 },
	 *     refereeReward: { type: 'premium_trial', days: 7 },
	 *   })
	 *   if (result.success) {
	 *     toast.success('Code redeemed!')
	 *   }
	 * }
	 * ```
	 */
	redeemCode: (
		code: string,
		defaults?: ReferralRewardDefaults,
	) => Promise<RedeemResult>;
	/**
	 * Get leaderboard of top referrers
	 *
	 * @param options - Leaderboard options
	 * @param options.limit - Maximum entries (1-100, default: 10)
	 * @param options.period - Time period ('all', 'month', 'week')
	 */
	getLeaderboard: (options?: {
		limit?: number;
		period?: "all" | "month" | "week";
	}) => Promise<{
		period: "all" | "month" | "week";
		entries: Array<{
			rank: number;
			userId: string | null;
			/** Masked username for privacy */
			name: string;
			avatarUrl: string | null;
			/** Number of successful referrals */
			referrals: number;
			totalReferrals: number;
			isCurrentUser: boolean;
		}>;
		currentUserRank: number | null;
	}>;
}

/**
 * Hook for referral program
 *
 * @example
 * ```tsx
 * function ReferralCard() {
 *   const { code, link, stats, copyLink } = useReferral()
 *
 *   return (
 *     <div>
 *       <p>Your code: {code}</p>
 *       <p>Successful referrals: {stats?.successfulReferrals || 0}</p>
 *       <button onClick={copyLink}>Share Link</button>
 *     </div>
 *   )
 * }
 * ```
 */
export function useReferral(): UseReferralReturn {
	const ctx = usePlatformContext();

	const code = ctx.referralCode || null;
	const link = code ? `${ctx.platformUrl}/r/${code}` : null;

	const copyCode = useCallback(async () => {
		if (code) {
			await navigator.clipboard.writeText(code);
		}
	}, [code]);

	const copyLink = useCallback(async () => {
		if (link) {
			await navigator.clipboard.writeText(link);
		}
	}, [link]);

	return {
		stats: ctx.referralStats,
		isLoading: ctx.referralLoading,
		error: ctx.referralError,
		isError: ctx.referralError !== null,
		code,
		link,
		copyCode,
		copyLink,
		regenerateCode: ctx.regenerateReferralCode,
		redeemCode: ctx.redeemReferralCode,
		getLeaderboard: ctx.getReferralLeaderboard,
	};
}

// ============================================
// useAnalyticsQuery
// ============================================

export interface UseAnalyticsQueryOptions {
	/** The query parameters */
	query: AnalyticsQuery;
	/** Whether to skip initial fetch */
	skip?: boolean;
	/** Refetch interval in ms */
	refetchInterval?: number;
}

export interface UseAnalyticsQueryReturn {
	/** Query results */
	data: AnalyticsQueryResult | null;
	/** Whether query is loading */
	isLoading: boolean;
	/** Whether initial load is complete */
	isInitialized: boolean;
	/** Error from query */
	error: Error | null;
	/** Whether there was an error */
	isError: boolean;
	/** Refetch the query */
	refetch: () => Promise<void>;
}

/**
 * Hook for querying analytics data
 *
 * Uses React Query for automatic caching, deduplication, and background refetching.
 *
 * @example
 * ```tsx
 * function AnalyticsDashboard() {
 *   const { data, isLoading, refetch } = useAnalyticsQuery({
 *     query: {
 *       type: 'events',
 *       dateRange: { start: '2024-01-01', end: '2024-01-31' },
 *       groupBy: ['day'],
 *       metrics: ['count'],
 *     },
 *     refetchInterval: 60000, // Auto-refresh every minute
 *   })
 *
 *   if (isLoading) return <Spinner />
 *
 *   return (
 *     <div>
 *       <p>Rows: {data?.meta.rowCount}</p>
 *       <Chart data={data?.data} />
 *       <button onClick={refetch}>Refresh</button>
 *     </div>
 *   )
 * }
 * ```
 */
export function useAnalyticsQuery(
	options: UseAnalyticsQueryOptions,
): UseAnalyticsQueryReturn {
	const ctx = usePlatformContext();
	const queryClient = useQueryClient();

	// Stable query key from options
	const queryKey = ["sylphx", ctx.appId, "analytics", options.query] as const;

	// React Query for analytics data
	const analyticsQuery = useQuery({
		queryKey,
		queryFn: () => ctx.queryAnalytics(options.query),
		enabled: !options.skip,
		staleTime: STALE_TIME_FREQUENT_MS, // 1 min - analytics data is often time-sensitive
		refetchInterval: options.refetchInterval ?? false,
	});

	// Refetch via React Query invalidation
	const refetch = useCallback(async () => {
		await queryClient.invalidateQueries({ queryKey });
	}, [queryClient, queryKey]);

	return {
		data: analyticsQuery.data ?? null,
		isLoading: analyticsQuery.isLoading,
		isInitialized: analyticsQuery.isFetched,
		error: analyticsQuery.error as Error | null,
		isError: analyticsQuery.isError,
		refetch,
	};
}

// ============================================
// useConversionTracking
// ============================================

export interface UseConversionTrackingReturn {
	/**
	 * Track a conversion event with automatic enrichment
	 *
	 * Automatically includes:
	 * - Click IDs (gclid, fbclid, ttclid) from URL capture
	 * - User data from auth state (email, name)
	 *
	 * Events are forwarded to all configured destinations with auto-forward enabled.
	 */
	trackConversion: (
		event: string,
		data: {
			value?: number;
			currency?: string;
			orderId?: string;
			properties?: Record<string, unknown>;
		},
		options?: {
			/** Override auto-captured click ID */
			clickId?: string;
			/** Override auto-captured user email */
			userEmail?: string;
			/** Override auto-captured user phone */
			userPhone?: string;
			/** Only forward to specific destinations (default: all with auto-forward enabled) */
			destinations?: DestinationPlatform[];
		},
	) => Promise<void>;
	/**
	 * Auto-captured click IDs from URL parameters
	 */
	clickIds: ClickIds;
	/**
	 * Get the primary click ID (gclid > fbclid > ttclid)
	 */
	primaryClickId: string | undefined;
}

/**
 * Hook for conversion tracking with automatic click ID and user data enrichment
 *
 * This is a convenience hook that wraps useAnalytics.track() with
 * conversion-specific defaults and automatic data enrichment.
 *
 * @example Basic conversion tracking
 * ```tsx
 * function CheckoutSuccess({ order }) {
 *   const { trackConversion } = useConversionTracking()
 *
 *   useEffect(() => {
 *     // Click IDs and user data are automatically included
 *     trackConversion('purchase', {
 *       value: order.total,
 *       currency: 'USD',
 *       orderId: order.id,
 *     })
 *   }, [order])
 *
 *   return <div>Thank you for your purchase!</div>
 * }
 * ```
 *
 * @example With custom properties
 * ```tsx
 * function SignupComplete({ user }) {
 *   const { trackConversion } = useConversionTracking()
 *
 *   useEffect(() => {
 *     trackConversion('signup', {
 *       properties: {
 *         plan: 'free',
 *         source: 'landing_page',
 *       }
 *     })
 *   }, [])
 * }
 * ```
 *
 * @example Check for click IDs
 * ```tsx
 * function LandingPage() {
 *   const { clickIds, primaryClickId } = useConversionTracking()
 *
 *   // Show different content for ad traffic
 *   if (primaryClickId) {
 *     return <AdLandingPage />
 *   }
 *
 *   return <OrganicLandingPage />
 * }
 * ```
 */
export function useConversionTracking(): UseConversionTrackingReturn {
	const ctx = usePlatformContext();

	const trackConversion = useCallback(
		async (
			event: string,
			data: {
				value?: number;
				currency?: string;
				orderId?: string;
				properties?: Record<string, unknown>;
			},
			options?: {
				clickId?: string;
				userEmail?: string;
				userPhone?: string;
				destinations?: DestinationPlatform[];
			},
		) => {
			// Track with conversion data (auto-enriched by ctx.track)
			await ctx.track(event, data.properties || {}, {
				destinations: options?.destinations,
				conversion: {
					value: data.value,
					currency: data.currency,
					orderId: data.orderId,
					clickId: options?.clickId,
					userEmail: options?.userEmail,
					userPhone: options?.userPhone,
				},
			});
		},
		[ctx],
	);

	const primaryClickId =
		ctx.clickIds.gclid || ctx.clickIds.fbclid || ctx.clickIds.ttclid;

	return {
		trackConversion,
		clickIds: ctx.clickIds,
		primaryClickId,
	};
}

