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

// Re-export types for convenience
export type { TrackOptions, ConversionData, DestinationPlatform, ClickIds };
export type {
	InAppMessageWithReadStatus,
	InAppMessageType,
	InAppMessagePriority,
	InboxPreferences,
};

/** Alias for easier naming */
export type InAppMessage = InAppMessageWithReadStatus;

/**
 * Internal hook to get platform context
 */
export function usePlatformContext() {
	const context = useContext(PlatformContext);
	if (!context) {
		throw new Error("Platform hooks must be used within a SylphxProvider");
	}
	return context;
}

/**
 * Internal hook to get platform context (safe version - returns null if no provider)
 * Use this for hooks that need to work outside SylphxProvider during SSR/prerendering
 */
function usePlatformContextSafe() {
	return useContext(PlatformContext);
}

