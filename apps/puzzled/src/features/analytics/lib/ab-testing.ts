'use client'

import posthog from 'posthog-js'
import { useEffect, useState } from 'react'
import { canTrackAnalytics } from './consent'
import { trackEvent } from './events'

// ==========================================
// Experiment Hook (Client-side)
// ==========================================

/**
 * Hook to get experiment variant and track exposure
 *
 * Returns:
 * - The variant string if experiment is active and user has consent
 * - 'control' if consent is denied or experiment not found
 *
 * Automatically tracks exposure when variant is determined
 *
 * @example
 * const ctaVariant = useExperiment('pricing_cta_variant')
 * // Returns: 'start_trial' | 'get_premium' | 'upgrade_now' | 'control'
 */
export function useExperiment(experimentKey: string): string {
	const [variant, setVariant] = useState<string>('control')

	useEffect(() => {
		if (!canTrackAnalytics()) {
			setVariant('control')
			return
		}

		// Wait for PostHog to be ready and feature flags to load
		const checkVariant = () => {
			// Check if PostHog has loaded feature flags
			if (!posthog.isFeatureEnabled) {
				// PostHog not ready yet
				return
			}

			const featureFlag = posthog.getFeatureFlag(experimentKey)
			const variantValue = typeof featureFlag === 'string' ? featureFlag : 'control'

			setVariant(variantValue)

			// Track exposure only once when variant is determined
			if (variantValue !== 'control') {
				trackExperimentExposure(experimentKey, variantValue)
			}
		}

		// Check immediately
		checkVariant()

		// Listen for feature flags being loaded
		const onFlagsLoaded = () => {
			checkVariant()
		}

		posthog.onFeatureFlags?.(onFlagsLoaded)

		// Cleanup
		return () => {
			// PostHog doesn't provide a way to unsubscribe from onFeatureFlags
			// but the callback will be a no-op after unmount due to closure
		}
	}, [experimentKey])

	return variant
}

// ==========================================
// Experiment Tracking
// ==========================================

/**
 * Track when a user is exposed to an experiment variant
 * Called automatically by useExperiment hook
 */
function trackExperimentExposure(experimentKey: string, variant: string) {
	if (!canTrackAnalytics()) return

	trackEvent('experiment_exposure', {
		experiment: experimentKey,
		variant,
	})
}

/**
 * Track when a user converts in an experiment (e.g., clicks the CTA, subscribes)
 *
 * @example
 * trackExperimentConversion('pricing_cta_variant', 'start_trial', { plan: 'premium' })
 */
export function trackExperimentConversion(
	experimentKey: string,
	variant: string,
	properties?: Record<string, unknown>,
) {
	if (!canTrackAnalytics()) return

	trackEvent('experiment_conversion', {
		experiment: experimentKey,
		variant,
		...properties,
	})
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

export type ExperimentKey = keyof typeof EXPERIMENTS
export type ExperimentVariant<K extends ExperimentKey> = (typeof EXPERIMENTS)[K]['variants'][number]
