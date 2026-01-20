/**
 * Feature Flags Hooks
 *
 * Composable hooks for feature flag evaluation.
 * No provider needed - uses config directly.
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSylphxConfig } from './provider'
import {
	checkFlag as checkFlagFn,
	getFlags as getFlagsFn,
	getVariant as getVariantFn,
	type FlagResult,
	type FlagContext,
} from '../flags'

// ============================================================================
// Hooks
// ============================================================================

/**
 * Single feature flag hook
 *
 * @example
 * ```tsx
 * function NewFeature() {
 *   const { enabled, isLoading } = useFlag('new-checkout', { userId: user?.id })
 *
 *   if (isLoading) return <Spinner />
 *   if (!enabled) return <OldCheckout />
 *   return <NewCheckout />
 * }
 * ```
 */
export function useFlag(flagKey: string, context?: FlagContext) {
	const config = useSylphxConfig()
	const [state, setState] = useState<{
		result: FlagResult | null
		isLoading: boolean
		error: Error | null
	}>({
		result: null,
		isLoading: true,
		error: null,
	})

	const fetch = useCallback(async () => {
		setState((s) => ({ ...s, isLoading: true, error: null }))

		try {
			const result = await checkFlagFn(config, flagKey, context)
			setState({ result, isLoading: false, error: null })
		} catch (e) {
			const error = e instanceof Error ? e : new Error('Failed to check flag')
			setState({ result: null, isLoading: false, error })
		}
	}, [config, flagKey, context?.userId, context?.anonymousId])

	useEffect(() => {
		fetch()
	}, [fetch])

	return {
		enabled: state.result?.enabled ?? false,
		variant: state.result?.variant,
		payload: state.result?.payload,
		isLoading: state.isLoading,
		error: state.error,
		refetch: fetch,
	}
}

/**
 * Multiple feature flags hook
 *
 * @example
 * ```tsx
 * function App() {
 *   const { flags, isLoading } = useFlags(['new-checkout', 'dark-mode', 'ai-features'], {
 *     userId: user?.id,
 *   })
 *
 *   if (isLoading) return <Spinner />
 *
 *   return (
 *     <div className={flags['dark-mode']?.enabled ? 'dark' : ''}>
 *       {flags['ai-features']?.enabled && <AIFeatures />}
 *     </div>
 *   )
 * }
 * ```
 */
export function useFlags(flagKeys: string[], context?: FlagContext) {
	const config = useSylphxConfig()
	const [state, setState] = useState<{
		flags: Record<string, FlagResult>
		isLoading: boolean
		error: Error | null
	}>({
		flags: {},
		isLoading: true,
		error: null,
	})

	const fetch = useCallback(async () => {
		setState((s) => ({ ...s, isLoading: true, error: null }))

		try {
			const flags = await getFlagsFn(config, flagKeys, context)
			setState({ flags, isLoading: false, error: null })
		} catch (e) {
			const error = e instanceof Error ? e : new Error('Failed to check flags')
			setState({ flags: {}, isLoading: false, error })
		}
	}, [config, flagKeys.join(','), context?.userId, context?.anonymousId])

	useEffect(() => {
		fetch()
	}, [fetch])

	return {
		flags: state.flags,
		isLoading: state.isLoading,
		error: state.error,
		refetch: fetch,
	}
}

/**
 * A/B test variant hook
 *
 * @example
 * ```tsx
 * function Checkout() {
 *   const { variant, isLoading } = useVariant('checkout-experiment', {
 *     userId: user?.id,
 *   })
 *
 *   if (isLoading) return <Spinner />
 *
 *   switch (variant) {
 *     case 'control': return <CheckoutV1 />
 *     case 'variant-a': return <CheckoutV2 />
 *     case 'variant-b': return <CheckoutV3 />
 *     default: return <CheckoutV1 />
 *   }
 * }
 * ```
 */
export function useVariant(flagKey: string, context?: FlagContext) {
	const config = useSylphxConfig()
	const [state, setState] = useState<{
		variant: string | undefined
		isLoading: boolean
		error: Error | null
	}>({
		variant: undefined,
		isLoading: true,
		error: null,
	})

	const fetch = useCallback(async () => {
		setState((s) => ({ ...s, isLoading: true, error: null }))

		try {
			const variant = await getVariantFn(config, flagKey, context)
			setState({ variant, isLoading: false, error: null })
		} catch (e) {
			const error = e instanceof Error ? e : new Error('Failed to get variant')
			setState({ variant: undefined, isLoading: false, error })
		}
	}, [config, flagKey, context?.userId, context?.anonymousId])

	useEffect(() => {
		fetch()
	}, [fetch])

	return {
		variant: state.variant,
		isLoading: state.isLoading,
		error: state.error,
		refetch: fetch,
	}
}
