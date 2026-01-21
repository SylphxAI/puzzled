/**
 * Billing Provider
 *
 * Composable billing provider with plans and subscription hooks.
 */

'use client'

import {
	createContext,
	useContext,
	useCallback,
	useEffect,
	useMemo,
	useState,
	type ReactNode,
} from 'react'
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

	// Plans state
	const [plans, setPlans] = useState<Plan[]>([])
	const [plansLoading, setPlansLoading] = useState(true)
	const [plansError, setPlansError] = useState<Error | null>(null)

	// Subscription state
	const [subscription, setSubscription] = useState<Subscription | null>(null)
	const [subscriptionLoading, setSubscriptionLoading] = useState(false)
	const [subscriptionError, setSubscriptionError] = useState<Error | null>(null)

	// Load plans
	useEffect(() => {
		let cancelled = false

		const loadPlans = async () => {
			setPlansLoading(true)
			setPlansError(null)

			try {
				const data = await getPlansFn(config)
				if (!cancelled) {
					setPlans(data)
				}
			} catch (e) {
				if (!cancelled) {
					setPlansError(e instanceof Error ? e : new Error('Failed to load plans'))
				}
			} finally {
				if (!cancelled) {
					setPlansLoading(false)
				}
			}
		}

		loadPlans()
		return () => {
			cancelled = true
		}
	}, [config])

	// Load subscription when userId changes
	const refreshSubscription = useCallback(async () => {
		if (!userId) {
			setSubscription(null)
			return
		}

		setSubscriptionLoading(true)
		setSubscriptionError(null)

		try {
			const data = await getSubscriptionFn(config, userId)
			setSubscription(data)
		} catch (e) {
			setSubscriptionError(e instanceof Error ? e : new Error('Failed to load subscription'))
		} finally {
			setSubscriptionLoading(false)
		}
	}, [config, userId])

	useEffect(() => {
		refreshSubscription()
	}, [refreshSubscription])

	// Create checkout
	const createCheckout = useCallback(
		async (planSlug: string, interval: 'monthly' | 'annual' | 'lifetime'): Promise<string> => {
			if (!userId) {
				throw new Error('User must be authenticated to checkout')
			}

			const { checkoutUrl } = await createCheckoutFn(config, {
				userId,
				planSlug,
				interval,
				successUrl: window.location.href,
				cancelUrl: window.location.href,
			})

			return checkoutUrl
		},
		[config, userId]
	)

	// Open portal
	const openPortal = useCallback(async () => {
		if (!userId) {
			throw new Error('User must be authenticated to access billing portal')
		}

		const { portalUrl } = await createPortalSessionFn(config, {
			userId,
			returnUrl: window.location.href,
		})

		window.location.href = portalUrl
	}, [config, userId])

	const value = useMemo(
		() => ({
			plans,
			plansLoading,
			plansError,
			subscription,
			subscriptionLoading,
			subscriptionError,
			createCheckout,
			openPortal,
			refreshSubscription,
		}),
		[
			plans,
			plansLoading,
			plansError,
			subscription,
			subscriptionLoading,
			subscriptionError,
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
