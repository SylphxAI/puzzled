/**
 * Plan Features - Single Source of Truth (SSOT)
 *
 * All plan feature definitions should be derived from this file.
 * Do NOT duplicate feature lists in components or pages.
 */

import type { LucideIcon } from 'lucide-react'
import { Calendar, Crown, Flame, Gamepad2, Snowflake, Target, TrendingUp } from 'lucide-react'

/**
 * Feature definition with metadata for display
 */
export interface PlanFeature {
	/** Unique key for feature (used for i18n lookup) */
	key: string
	/** Icon component for visual representation */
	icon: LucideIcon
	/** Whether this feature is available in free plan */
	free: boolean
	/** Whether this feature is available in premium plan */
	premium: boolean
	/** Tailwind text color class for theming */
	color: string
	/** Tailwind background color class for theming */
	bgColor: string
}

/**
 * All plan features with their availability
 * Order: common features first, then premium-only features
 */
export const PLAN_FEATURES: readonly PlanFeature[] = [
	// Features available to all users
	{
		key: 'dailyPuzzles',
		icon: Target,
		free: true,
		premium: true,
		color: 'text-green-500',
		bgColor: 'bg-green-500/10',
	},
	{
		key: 'basicStats',
		icon: TrendingUp,
		free: true,
		premium: true,
		color: 'text-blue-500',
		bgColor: 'bg-blue-500/10',
	},
	// Premium-only features
	{
		key: 'allGames',
		icon: Gamepad2,
		free: false,
		premium: true,
		color: 'text-purple-500',
		bgColor: 'bg-purple-500/10',
	},
	{
		key: 'puzzleArchive',
		icon: Calendar,
		free: false,
		premium: true,
		color: 'text-indigo-500',
		bgColor: 'bg-indigo-500/10',
	},
	{
		key: 'streakFreeze',
		icon: Snowflake,
		free: false,
		premium: true,
		color: 'text-cyan-500',
		bgColor: 'bg-cyan-500/10',
	},
	{
		key: 'leaderboards',
		icon: Crown,
		free: false,
		premium: true,
		color: 'text-yellow-500',
		bgColor: 'bg-yellow-500/10',
	},
	{
		key: 'noAds',
		icon: Flame,
		free: false,
		premium: true,
		color: 'text-orange-500',
		bgColor: 'bg-orange-500/10',
	},
] as const

/**
 * Premium prompt features (subset for upsell UI)
 */
export const PREMIUM_PROMPT_FEATURES = [
	PLAN_FEATURES.find((f) => f.key === 'puzzleArchive')!,
	PLAN_FEATURES.find((f) => f.key === 'streakFreeze')!,
	PLAN_FEATURES.find((f) => f.key === 'leaderboards')!,
] as const

/**
 * Settings page feature display format
 * Returns features with their inclusion status for a given plan
 */
export interface SettingsFeature {
	key: string
	included: boolean
}

/**
 * Get included features for a plan (for settings page "Your Features" section)
 */
export function getIncludedFeatures(plan: 'free' | 'premium'): readonly SettingsFeature[] {
	return PLAN_FEATURES.filter((f) => f[plan]).map((feature) => ({
		key: feature.key,
		included: true,
	}))
}

/**
 * Get excluded features for free plan (features to unlock)
 */
export function getExcludedFreeFeatures(): readonly SettingsFeature[] {
	return PLAN_FEATURES.filter((f) => !f.free).map((feature) => ({
		key: feature.key,
		included: false,
	}))
}

/**
 * Pricing page feature configuration
 * Derived from SSOT with plan-specific display customizations
 */
export interface PricingFeatureDisplay {
	key: string
	icon: LucideIcon
	included: boolean
}

/**
 * Get features formatted for pricing page display
 * Annual plan gets enhanced versions of some features
 */
export function getPricingFeatures(
	planId: 'free' | 'premium' | 'annual',
): readonly PricingFeatureDisplay[] {
	if (planId === 'free') {
		return [
			{ key: 'dailyPuzzles', icon: Target, included: true },
			{ key: 'basicStats', icon: TrendingUp, included: true },
			{ key: 'puzzleArchive', icon: Calendar, included: false },
			{ key: 'streakFreeze', icon: Snowflake, included: false },
		]
	}

	if (planId === 'premium') {
		return [
			{ key: 'allDailyPuzzles', icon: Target, included: true },
			{ key: 'puzzleArchive', icon: Calendar, included: true },
			{ key: 'streakFreeze', icon: Snowflake, included: true },
			{ key: 'leaderboards', icon: Crown, included: true },
		]
	}

	// Annual plan - enhanced features
	return [
		{ key: 'allDailyPuzzles', icon: Target, included: true },
		{ key: 'puzzleArchive', icon: Calendar, included: true },
		{ key: 'streakFreeze6', icon: Snowflake, included: true },
		{ key: 'leaderboards', icon: Crown, included: true },
		{ key: 'earlyAccess', icon: Flame, included: true },
	]
}
