/**
 * Feature Flags Hooks
 *
 * Composable hooks for feature flag evaluation.
 * No provider needed - uses config directly.
 */

'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { useSylphxConfig } from './composable/core'
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
	const queryClient = useQueryClient()

	const query = useQuery({
		queryKey: ['sylphx', 'flag', flagKey, context?.userId, context?.anonymousId],
		queryFn: () => checkFlagFn(config, flagKey, context),
		staleTime: 5 * 60 * 1000, // 5 min - flags are relatively stable
	})

	const refetch = useCallback(() => {
		queryClient.invalidateQueries({ queryKey: ['sylphx', 'flag', flagKey] })
	}, [queryClient, flagKey])

	return {
		enabled: query.data?.enabled ?? false,
		variant: query.data?.variant,
		payload: query.data?.payload,
		isLoading: query.isLoading,
		error: query.error instanceof Error ? query.error : query.error ? new Error('Failed to check flag') : null,
		refetch,
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
	const queryClient = useQueryClient()

	// Create stable key from flag keys array
	const flagKeysKey = flagKeys.slice().sort().join(',')

	const query = useQuery({
		queryKey: ['sylphx', 'flags', flagKeysKey, context?.userId, context?.anonymousId],
		queryFn: () => getFlagsFn(config, flagKeys, context),
		staleTime: 5 * 60 * 1000, // 5 min - flags are relatively stable
	})

	const refetch = useCallback(() => {
		queryClient.invalidateQueries({ queryKey: ['sylphx', 'flags', flagKeysKey] })
	}, [queryClient, flagKeysKey])

	return {
		flags: query.data ?? {},
		isLoading: query.isLoading,
		error: query.error instanceof Error ? query.error : query.error ? new Error('Failed to check flags') : null,
		refetch,
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
	const queryClient = useQueryClient()

	const query = useQuery({
		queryKey: ['sylphx', 'variant', flagKey, context?.userId, context?.anonymousId],
		queryFn: () => getVariantFn(config, flagKey, context),
		staleTime: 5 * 60 * 1000, // 5 min - variants are relatively stable
	})

	const refetch = useCallback(() => {
		queryClient.invalidateQueries({ queryKey: ['sylphx', 'variant', flagKey] })
	}, [queryClient, flagKey])

	return {
		variant: query.data,
		isLoading: query.isLoading,
		error: query.error instanceof Error ? query.error : query.error ? new Error('Failed to get variant') : null,
		refetch,
	}
}
