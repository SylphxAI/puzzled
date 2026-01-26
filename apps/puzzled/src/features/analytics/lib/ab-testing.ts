/**
 * A/B Testing Integration
 *
 * Uses Sylphx Platform SDK's feature flag system for experiments.
 * This provides:
 * - Unified flag management through the SDK
 * - Consistent analytics tracking
 * - Server-side flag evaluation support
 */

'use client'

import { useAnalytics, useFeatureFlag } from '@sylphx/sdk/react'
import { useCallback, useEffect, useRef } from 'react'

// ==========================================
// Experiment Hook (Client-side)
// ==========================================

/**
 * Hook to get experiment variant and track exposure
 *
 * Uses SDK feature flags with variant support.
 * Automatically tracks exposure when variant is determined.
 *
 * @example
 * const ctaVariant = useExperiment('pricing_cta_variant')
 * // Returns: 'start_trial' | 'get_premium' | 'upgrade_now' | 'control'
 */
function useExperiment(experimentKey: string): string {
	const { variant, isLoading } = useFeatureFlag(experimentKey)
	const { track } = useAnalytics()
	const hasTrackedRef = useRef(false)

	// Track exposure once when variant is determined
	useEffect(() => {
		if (isLoading || hasTrackedRef.current) return

		const variantValue = variant ?? 'control'
		if (variantValue !== 'control') {
			track('experiment_exposure', {
				experiment: experimentKey,
				variant: variantValue,
			})
			hasTrackedRef.current = true
		}
	}, [variant, isLoading, experimentKey, track])

	return variant ?? 'control'
}

// ==========================================
// Experiment Tracking
// ==========================================

/**
 * Track when a user converts in an experiment (e.g., clicks the CTA, subscribes)
 *
 * Uses SDK analytics for consistent event tracking.
 *
 * @example
 * const { trackConversion } = useExperimentTracking()
 * trackConversion('pricing_cta_variant', 'start_trial', { plan: 'premium' })
 */
function useExperimentTracking() {
	const { track } = useAnalytics()

	const trackConversion = useCallback(
		(experimentKey: string, variant: string, properties?: Record<string, unknown>) => {
			track('experiment_conversion', {
				experiment: experimentKey,
				variant,
				...properties,
			})
		},
		[track],
	)

	return { trackConversion }
}

// ==========================================
// Experiment Definitions
// ==========================================

/**
 * Type-safe experiment definitions
 * Add new experiments here to get autocomplete and type checking
 */
export const EXPERIMENTS = {
	pricing_cta_variant: {
		key: 'pricing_cta_variant',
		variants: ['control', 'start_trial', 'get_premium', 'upgrade_now'] as const,
		description: 'Test different CTA text on pricing page',
	},
	trial_length: {
		key: 'trial_length',
		variants: ['control', '7_days', '14_days'] as const,
		description: 'Test different trial lengths',
	},
} as const

type ExperimentKey = keyof typeof EXPERIMENTS
type ExperimentVariant<K extends ExperimentKey> = (typeof EXPERIMENTS)[K]['variants'][number]
