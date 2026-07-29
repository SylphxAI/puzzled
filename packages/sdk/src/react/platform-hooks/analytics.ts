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
// useAnalytics
// ============================================

export interface UseAnalyticsReturn {
	/**
	 * Track a custom event with optional destination forwarding
	 *
	 * @example Basic tracking
	 * ```ts
	 * track('page_view', { path: '/products' })
	 * ```
	 *
	 * @example Track purchase with conversion data
	 * ```ts
	 * track('purchase', { product: 'Premium' }, {
	 *   destinations: ['google_ads', 'meta'],
	 *   conversion: {
	 *     value: 99.99,
	 *     currency: 'USD',
	 *     orderId: 'ORDER-123',
	 *     userEmail: user.email,
	 *   }
	 * })
	 * ```
	 *
	 * @example Skip destinations for internal events
	 * ```ts
	 * track('button_click', { button: 'nav' }, { skipDestinations: true })
	 * ```
	 */
	track: (
		event: string,
		properties?: Record<string, unknown>,
		options?: TrackOptions,
	) => Promise<void>;
	/** Track a page view */
	page: (name: string, properties?: Record<string, unknown>) => Promise<void>;
	/** Identify user with traits */
	identify: (traits?: Record<string, unknown>) => Promise<void>;
	/** Error from analytics operations */
	error: Error | null;
	/** Whether there was an error */
	isError: boolean;
}

/**
 * Hook for analytics tracking with conversion destinations
 *
 * @example Basic tracking
 * ```tsx
 * function GameComplete() {
 *   const { track } = useAnalytics()
 *
 *   useEffect(() => {
 *     track('game_completed', {
 *       score: 100,
 *       timeMs: 5000,
 *       difficulty: 'hard',
 *     })
 *   }, [])
 *
 *   return <div>Game Complete!</div>
 * }
 * ```
 *
 * @example Track conversion with ad platform forwarding
 * ```tsx
 * function CheckoutSuccess() {
 *   const { track } = useAnalytics()
 *
 *   useEffect(() => {
 *     track('purchase', { product: 'Premium Plan' }, {
 *       destinations: ['google_ads', 'meta', 'tiktok'],
 *       conversion: {
 *         value: 99.99,
 *         currency: 'USD',
 *         orderId: order.id,
 *         userEmail: user.email,
 *         clickId: gclid || fbclid || ttclid,
 *       }
 *     })
 *   }, [])
 *
 *   return <div>Thank you for your purchase!</div>
 * }
 * ```
 */
export function useAnalytics(): UseAnalyticsReturn {
	const ctx = usePlatformContext();

	return {
		track: ctx.track,
		page: ctx.page,
		identify: ctx.identify,
		error: ctx.analyticsError,
		isError: ctx.analyticsError !== null,
	};
}

// ============================================
// useSafeAnalytics (SSR-safe version)
// ============================================

export interface UseSafeAnalyticsReturn {
	/** Whether SDK is configured */
	isConfigured: boolean;
	/** Track a custom event (no-op if not configured) */
	track: (
		event: string,
		properties?: Record<string, unknown>,
		options?: TrackOptions,
	) => Promise<void>;
	/** Track a page view (no-op if not configured) */
	page: (name: string, properties?: Record<string, unknown>) => Promise<void>;
	/** Identify user with traits (no-op if not configured) */
	identify: (traits?: Record<string, unknown>) => Promise<void>;
}

// No-op async function for safe hooks
const noopAsync = async () => {};

/**
 * SSR-safe version of useAnalytics that returns no-op functions when outside SylphxProvider
 *
 * Use this in components that may render during SSR/static generation.
 *
 * @example
 * ```tsx
 * function Analytics() {
 *   const { isConfigured, track } = useSafeAnalytics()
 *
 *   useEffect(() => {
 *     // Safe to call even outside provider
 *     track('page_view', { path: window.location.pathname })
 *   }, [])
 *
 *   return null
 * }
 * ```
 */
export function useSafeAnalytics(): UseSafeAnalyticsReturn {
	const ctx = usePlatformContextSafe();

	if (!ctx) {
		return {
			isConfigured: false,
			track: noopAsync,
			page: noopAsync,
			identify: noopAsync,
		};
	}

	return {
		isConfigured: true,
		track: ctx.track,
		page: ctx.page,
		identify: ctx.identify,
	};
}

