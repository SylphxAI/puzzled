/**
 * Billing Hooks
 *
 * Composable hooks for billing plans and subscriptions.
 * No provider needed - uses config directly.
 *
 * ## React Query Integration
 *
 * All hooks use React Query for:
 * - Automatic caching (plans: 30 min, subscription: 5 min)
 * - Deduplication of concurrent requests
 * - Background refetching
 * - Optimistic updates
 */

'use client'

import { useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSylphxConfig } from './core'
import {
	getPlans as getPlansFn,
	getSubscription as getSubscriptionFn,
	createCheckout as createCheckoutFn,
	createPortalSession as createPortalSessionFn,
	type Plan,
	type Subscription,
} from '../../billing'

// ============================================================================
// Hooks
// ============================================================================

/**
 * Plans hook with caching
 *
 * Uses React Query for caching - plans rarely change so 30 min staleTime.
 *
 * @example
 * ```tsx
 * function PricingTable() {
 *   const { plans, isLoading, error } = usePlans()
 *
 *   if (isLoading) return <Spinner />
 *   if (error) return <Error message={error.message} />
 *
 *   return plans.map(plan => <PlanCard key={plan.id} plan={plan} />)
 * }
 * ```
 */
export function usePlans() {
	const config = useSylphxConfig()
	const queryClient = useQueryClient()

	// React Query for plans fetching
	const plansQuery = useQuery({
		queryKey: ['sylphx', 'billing', 'plans'],
		queryFn: () => getPlansFn(config),
		staleTime: 30 * 60 * 1000, // 30 min - plans rarely change
	})

	// Refetch via React Query
	const refetch = useCallback(async () => {
		await queryClient.invalidateQueries({
			queryKey: ['sylphx', 'billing', 'plans'],
		})
	}, [queryClient])

	return {
		plans: plansQuery.data ?? [],
		isLoading: plansQuery.isLoading,
		error: plansQuery.error as Error | null,
		refetch,
	}
}

/**
 * Subscription hook with caching
 *
 * Uses React Query for caching - subscription may change so 5 min staleTime.
 *
 * @example
 * ```tsx
 * function SubscriptionStatus({ userId }) {
 *   const { subscription, isLoading } = useSubscription(userId)
 *
 *   if (isLoading) return <Spinner />
 *   if (subscription?.status === 'active') return <Badge>Pro</Badge>
 *   return <Button>Upgrade</Button>
 * }
 * ```
 */
export function useSubscription(userId: string | null | undefined) {
	const config = useSylphxConfig()
	const queryClient = useQueryClient()

	// React Query for subscription fetching
	const subscriptionQuery = useQuery({
		queryKey: ['sylphx', 'billing', 'subscription', userId],
		queryFn: () => getSubscriptionFn(config, userId!),
		enabled: !!userId,
		staleTime: 5 * 60 * 1000, // 5 min - subscription may change
	})

	// Refetch via React Query
	const refetch = useCallback(async () => {
		await queryClient.invalidateQueries({
			queryKey: ['sylphx', 'billing', 'subscription', userId],
		})
	}, [queryClient, userId])

	return {
		subscription: subscriptionQuery.data ?? null,
		isLoading: subscriptionQuery.isLoading,
		error: subscriptionQuery.error as Error | null,
		refetch,
	}
}

/**
 * Checkout mutation hook
 *
 * @example
 * ```tsx
 * function UpgradeButton({ plan, userId }) {
 *   const { checkout, isLoading, error } = useCheckout()
 *
 *   const handleClick = async () => {
 *     const url = await checkout({
 *       userId,
 *       planSlug: plan.slug,
 *       interval: 'monthly',
 *     })
 *     window.location.href = url
 *   }
 *
 *   return (
 *     <button onClick={handleClick} disabled={isLoading}>
 *       {isLoading ? 'Loading...' : `Upgrade to ${plan.name}`}
 *     </button>
 *   )
 * }
 * ```
 */
export function useCheckout() {
	const config = useSylphxConfig()
	const queryClient = useQueryClient()

	const mutation = useMutation({
		mutationFn: async (input: {
			userId: string
			planSlug: string
			interval: 'monthly' | 'annual' | 'lifetime'
			successUrl?: string
			cancelUrl?: string
		}) => {
			const { checkoutUrl } = await createCheckoutFn(config, {
				userId: input.userId,
				planSlug: input.planSlug,
				interval: input.interval,
				successUrl: input.successUrl ?? window.location.href,
				cancelUrl: input.cancelUrl ?? window.location.href,
			})
			return checkoutUrl
		},
		onSuccess: (_data, variables) => {
			// Invalidate subscription when checkout completes
			queryClient.invalidateQueries({
				queryKey: ['sylphx', 'billing', 'subscription', variables.userId],
			})
		},
	})

	return {
		checkout: mutation.mutateAsync,
		isLoading: mutation.isPending,
		error: mutation.error as Error | null,
	}
}

/**
 * Portal session mutation hook
 *
 * @example
 * ```tsx
 * function ManageBillingButton({ userId }) {
 *   const { openPortal, isLoading } = usePortal()
 *
 *   return (
 *     <button onClick={() => openPortal({ userId })} disabled={isLoading}>
 *       Manage Billing
 *     </button>
 *   )
 * }
 * ```
 */
export function usePortal() {
	const config = useSylphxConfig()
	const queryClient = useQueryClient()

	const mutation = useMutation({
		mutationFn: async (input: {
			userId: string
			returnUrl?: string
		}) => {
			const { portalUrl } = await createPortalSessionFn(config, {
				userId: input.userId,
				returnUrl: input.returnUrl ?? window.location.href,
			})
			return portalUrl
		},
		onSuccess: (_data, variables) => {
			// Invalidate subscription when returning from portal
			queryClient.invalidateQueries({
				queryKey: ['sylphx', 'billing', 'subscription', variables.userId],
			})
		},
	})

	return {
		openPortal: mutation.mutateAsync,
		isLoading: mutation.isPending,
		error: mutation.error as Error | null,
	}
}

// Re-export types for convenience
export type { Plan, Subscription }
