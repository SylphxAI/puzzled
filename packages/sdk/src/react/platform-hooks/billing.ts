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
// useBilling
// ============================================

export interface UseBillingReturn {
	/** Current subscription (null if free/none) */
	subscription: Subscription | null;
	/** Whether subscription is loading */
	isLoading: boolean;
	/** Error loading subscription */
	error: Error | null;
	/** Whether there was an error loading subscription */
	isError: boolean;
	/** All available plans */
	plans: Plan[];
	/** Whether plans are loading */
	plansLoading: boolean;
	/** Error loading plans */
	plansError: Error | null;
	/** Whether user has an active paid subscription */
	isPremium: boolean;
	/** Whether user is on a trial */
	isTrialing: boolean;
	/** Create checkout session and get URL */
	createCheckout: (
		planSlug: string,
		interval: "monthly" | "annual" | "lifetime",
	) => Promise<string>;
	/** Open billing portal to manage subscription */
	openPortal: () => Promise<void>;
	/** Refresh subscription data */
	refresh: () => Promise<void>;
}

/**
 * Hook for billing and subscription management
 *
 * @example
 * ```tsx
 * function PricingPage() {
 *   const { plans, subscription, isPremium, createCheckout } = useBilling()
 *
 *   if (isPremium) {
 *     return <div>You're on {subscription?.planName}!</div>
 *   }
 *
 *   return (
 *     <div>
 *       {plans.map(plan => (
 *         <button
 *           key={plan.id}
 *           onClick={() => createCheckout(plan.slug, 'monthly')}
 *         >
 *           Subscribe to {plan.name}
 *         </button>
 *       ))}
 *     </div>
 *   )
 * }
 * ```
 */
export function useBilling(): UseBillingReturn {
	const ctx = usePlatformContext();

	const isPremium =
		ctx.subscription?.status === "active" ||
		ctx.subscription?.status === "trialing";

	const isTrialing = ctx.subscription?.status === "trialing";

	return {
		subscription: ctx.subscription,
		isLoading: ctx.subscriptionLoading,
		error: ctx.subscriptionError,
		isError: ctx.subscriptionError !== null,
		plans: ctx.plans,
		plansLoading: ctx.plansLoading,
		plansError: ctx.plansError,
		isPremium,
		isTrialing,
		createCheckout: ctx.createCheckout,
		openPortal: ctx.openPortal,
		refresh: ctx.refreshSubscription,
	};
}

// ============================================
// useSafeBilling (SSR-safe version)
// ============================================

export interface UseSafeBillingReturn {
	/** Whether SDK is configured */
	isConfigured: boolean;
	/** Current subscription (null if free/none or not configured) */
	subscription: Subscription | null;
	/** Whether subscription is loading */
	isLoading: boolean;
	/** Whether user has an active paid subscription */
	isPremium: boolean;
	/** Whether user is on a trial */
	isTrialing: boolean;
}

/**
 * SSR-safe version of useBilling that returns safe defaults when outside SylphxProvider
 *
 * Use this in components that may render during SSR/static generation.
 *
 * @example
 * ```tsx
 * function FeatureGate({ children }) {
 *   const { isConfigured, isPremium } = useSafeBilling()
 *
 *   // Not configured - show content to all
 *   if (!isConfigured) return children
 *
 *   // Configured - check premium status
 *   return isPremium ? children : <UpgradePrompt />
 * }
 * ```
 */
export function useSafeBilling(): UseSafeBillingReturn {
	const ctx = usePlatformContextSafe();

	if (!ctx) {
		return {
			isConfigured: false,
			subscription: null,
			isLoading: false,
			isPremium: false,
			isTrialing: false,
		};
	}

	const isPremium =
		ctx.subscription?.status === "active" ||
		ctx.subscription?.status === "trialing";

	const isTrialing = ctx.subscription?.status === "trialing";

	return {
		isConfigured: true,
		subscription: ctx.subscription,
		isLoading: ctx.subscriptionLoading,
		isPremium,
		isTrialing,
	};
}

