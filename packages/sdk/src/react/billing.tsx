/**
 * Billing Provider (Legacy)
 *
 * Provider-based billing for components that need shared state.
 * For simpler use cases, prefer the composable hooks from './composable/billing'.
 *
 * ## React Query Integration
 *
 * All data fetching uses React Query internally for:
 * - Automatic caching (plans: 30 min, subscription: 5 min)
 * - Deduplication of concurrent requests
 * - Background refetching
 */

'use client'

import {
	createContext,
	useContext,
	useCallback,
	useMemo,
	type ReactNode,
} from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSylphxConfig } from './composable/core'
import {
	getPlans as getPlansFn,
	getSubscription as getSubscriptionFn,
	createCheckout as createCheckoutFn,
	createPortalSession as createPortalSessionFn,
	type Plan,
	type Subscription,
} from '../billing'

// Re-export composable hooks for direct usage
export {
	usePlans as usePlansHook,
	useSubscription as useSubscriptionHook,
	useCheckout as useCheckoutHook,
	usePortal as usePortalHook,
} from './composable/billing'

// ============================================================================
// Types
// ============================================================================

interface BillingContextValue {
	plans: Plan[]
	plansLoading: boolean
	plansError: Error | null
	subscription: Subscription | null
	subscriptionLoading: boolean
	subscriptionError: Error | null
	createCheckout: (planSlug: string, interval: 'monthly' | 'annual' | 'lifetime') => Promise<string>
	openPortal: () => Promise<void>
	refreshSubscription: () => Promise<void>
}

// ============================================================================
// Context
// ============================================================================

const BillingContext = createContext<BillingContextValue | null>(null)

// ============================================================================
// Provider
// ============================================================================

interface BillingProviderProps {
	children: ReactNode
	/** User ID (required for subscription fetching) */
	userId?: string
}

/**
 * Billing provider
 *
 * For simpler use cases, prefer the composable hooks:
 * - usePlans() - Get plans without a provider
 * - useSubscription(userId) - Get subscription without a provider
 *
 * @example
 * ```tsx
 * <SylphxCore appId="my-app" secretKey={key}>
 *   <BillingProvider userId={user?.id}>
 *     <PricingPage />
 *   </BillingProvider>
 * </SylphxCore>
 * ```
 */
export function BillingProvider({ children, userId }: BillingProviderProps) {
	const config = useSylphxConfig()
	const queryClient = useQueryClient()

	// Plans query with React Query
	const plansQuery = useQuery({
		queryKey: ['sylphx', 'billing', 'plans'],
		queryFn: () => getPlansFn(config),
		staleTime: 30 * 60 * 1000, // 30 min - plans rarely change
	})

	// Subscription query with React Query
	const subscriptionQuery = useQuery({
		queryKey: ['sylphx', 'billing', 'subscription', userId],
		queryFn: () => getSubscriptionFn(config, userId!),
		enabled: !!userId,
		staleTime: 5 * 60 * 1000, // 5 min - subscription may change
	})

	// Checkout mutation
	const checkoutMutation = useMutation({
		mutationFn: async (input: { planSlug: string; interval: 'monthly' | 'annual' | 'lifetime' }) => {
			if (!userId) {
				throw new Error('User must be authenticated to checkout')
			}
			const { checkoutUrl } = await createCheckoutFn(config, {
				userId,
				planSlug: input.planSlug,
				interval: input.interval,
				successUrl: window.location.href,
				cancelUrl: window.location.href,
			})
			return checkoutUrl
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ['sylphx', 'billing', 'subscription', userId],
			})
		},
	})

	// Portal mutation
	const portalMutation = useMutation({
		mutationFn: async () => {
			if (!userId) {
				throw new Error('User must be authenticated to access billing portal')
			}
			const { portalUrl } = await createPortalSessionFn(config, {
				userId,
				returnUrl: window.location.href,
			})
			return portalUrl
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ['sylphx', 'billing', 'subscription', userId],
			})
		},
	})

	// Create checkout
	const createCheckout = useCallback(
		async (planSlug: string, interval: 'monthly' | 'annual' | 'lifetime'): Promise<string> => {
			return checkoutMutation.mutateAsync({ planSlug, interval })
		},
		[checkoutMutation]
	)

	// Open portal
	const openPortal = useCallback(async () => {
		const portalUrl = await portalMutation.mutateAsync()
		window.location.href = portalUrl
	}, [portalMutation])

	// Refresh subscription
	const refreshSubscription = useCallback(async () => {
		await queryClient.invalidateQueries({
			queryKey: ['sylphx', 'billing', 'subscription', userId],
		})
	}, [queryClient, userId])

	const value = useMemo(
		() => ({
			plans: plansQuery.data ?? [],
			plansLoading: plansQuery.isLoading,
			plansError: plansQuery.error as Error | null,
			subscription: subscriptionQuery.data ?? null,
			subscriptionLoading: subscriptionQuery.isLoading,
			subscriptionError: subscriptionQuery.error as Error | null,
			createCheckout,
			openPortal,
			refreshSubscription,
		}),
		[
			plansQuery.data,
			plansQuery.isLoading,
			plansQuery.error,
			subscriptionQuery.data,
			subscriptionQuery.isLoading,
			subscriptionQuery.error,
			createCheckout,
			openPortal,
			refreshSubscription,
		]
	)

	return <BillingContext.Provider value={value}>{children}</BillingContext.Provider>
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Full billing context
 */
export function useBilling(): BillingContextValue {
	const context = useContext(BillingContext)
	if (!context) {
		throw new Error('useBilling must be used within a BillingProvider')
	}
	return context
}

/**
 * Just plans
 *
 * @example
 * ```tsx
 * function PricingTable() {
 *   const { plans, isLoading } = usePlans()
 *   return plans.map(plan => <PlanCard key={plan.id} plan={plan} />)
 * }
 * ```
 */
export function usePlans() {
	const { plans, plansLoading, plansError } = useBilling()
	return { plans, isLoading: plansLoading, error: plansError }
}

/**
 * Just subscription
 *
 * @example
 * ```tsx
 * function SubscriptionStatus() {
 *   const { subscription, isLoading } = useSubscription()
 *   if (subscription?.status === 'active') return <Badge>Pro</Badge>
 *   return <Button>Upgrade</Button>
 * }
 * ```
 */
export function useSubscription() {
	const { subscription, subscriptionLoading, subscriptionError, refreshSubscription } = useBilling()
	return {
		subscription,
		isLoading: subscriptionLoading,
		error: subscriptionError,
		refresh: refreshSubscription,
	}
}

/**
 * Checkout action
 *
 * @example
 * ```tsx
 * function UpgradeButton({ plan }) {
 *   const checkout = useCheckout()
 *   return (
 *     <button onClick={async () => {
 *       const url = await checkout(plan.slug, 'monthly')
 *       window.location.href = url
 *     }}>
 *       Upgrade to {plan.name}
 *     </button>
 *   )
 * }
 * ```
 */
export function useCheckout() {
	return useBilling().createCheckout
}
