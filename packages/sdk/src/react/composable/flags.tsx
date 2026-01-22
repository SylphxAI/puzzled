/**
 * Feature Flags Hooks
 *
 * Composable hooks for feature flag evaluation.
 * No provider needed - uses config directly.
 *
 * ## React Query Integration
 *
 * All hooks use React Query for:
 * - Automatic caching (5 min staleTime)
 * - Deduplication of concurrent requests
 * - Background refetching
 */

'use client'

import { useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSylphxConfig } from './core'
import {
	checkFlag as checkFlagFn,
	getFlags as getFlagsFn,
	getVariant as getVariantFn,
	type FlagResult,
	type FlagContext,
} from '../../flags'

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

	// React Query for flag evaluation
	const flagQuery = useQuery({
		queryKey: ['sylphx', 'flag', flagKey, context?.userId, context?.anonymousId],
		queryFn: () => checkFlagFn(config, flagKey, context),
		staleTime: 5 * 60 * 1000, // 5 min - flags are relatively stable
	})

	// Refetch via React Query
	const refetch = useCallback(async () => {
		await queryClient.invalidateQueries({
			queryKey: ['sylphx', 'flag', flagKey],
		})
	}, [queryClient, flagKey])

	return {
		enabled: flagQuery.data?.enabled ?? false,
		variant: flagQuery.data?.variant,
		payload: flagQuery.data?.payload,
		isLoading: flagQuery.isLoading,
		error: flagQuery.error as Error | null,
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

	// Stable key for array
	const flagKeysKey = flagKeys.join(',')

	// React Query for batch flag evaluation
	const flagsQuery = useQuery({
		queryKey: ['sylphx', 'flags', flagKeysKey, context?.userId, context?.anonymousId],
		queryFn: () => getFlagsFn(config, flagKeys, context),
		staleTime: 5 * 60 * 1000, // 5 min - flags are relatively stable
	})

	// Refetch via React Query
	const refetch = useCallback(async () => {
		await queryClient.invalidateQueries({
			queryKey: ['sylphx', 'flags', flagKeysKey],
		})
	}, [queryClient, flagKeysKey])

	return {
		flags: flagsQuery.data ?? ({} as Record<string, FlagResult>),
		isLoading: flagsQuery.isLoading,
		error: flagsQuery.error as Error | null,
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

	// React Query for variant evaluation
	const variantQuery = useQuery({
		queryKey: ['sylphx', 'variant', flagKey, context?.userId, context?.anonymousId],
		queryFn: () => getVariantFn(config, flagKey, context),
		staleTime: 5 * 60 * 1000, // 5 min - variants are relatively stable
	})

	// Refetch via React Query
	const refetch = useCallback(async () => {
		await queryClient.invalidateQueries({
			queryKey: ['sylphx', 'variant', flagKey],
		})
	}, [queryClient, flagKey])

	return {
		variant: variantQuery.data,
		isLoading: variantQuery.isLoading,
		error: variantQuery.error as Error | null,
		refetch,
	}
}
