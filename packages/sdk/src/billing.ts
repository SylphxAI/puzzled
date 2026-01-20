/**
 * Billing Functions
 *
 * Pure functions for billing and subscriptions.
 */

import { type SylphxConfig, callTrpc } from './config'

// ============================================================================
// Types
// ============================================================================

export interface Plan {
	id: string
	slug: string
	name: string
	description: string | null
	features: string[]
	monthlyPrice: number
	annualPrice: number
	lifetimePrice: number | null
	isPopular: boolean
	isActive: boolean
}

export interface Subscription {
	id: string
	planId: string
	planSlug: string
	planName: string
	status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'incomplete' | 'incomplete_expired' | 'paused'
	interval: 'monthly' | 'annual' | 'lifetime'
	currentPeriodStart: string
	currentPeriodEnd: string
	cancelAtPeriodEnd: boolean
}

export interface CheckoutInput {
	/** User ID */
	userId: string
	/** Plan slug */
	planSlug: string
	/** Billing interval */
	interval: 'monthly' | 'annual' | 'lifetime'
	/** URL to redirect after successful checkout */
	successUrl: string
	/** URL to redirect if user cancels */
	cancelUrl: string
}

// ============================================================================
// Functions
// ============================================================================

/**
 * Get available plans
 *
 * @example
 * ```typescript
 * const plans = await getPlans(config)
 * plans.forEach(plan => console.log(plan.name, plan.monthlyPrice))
 * ```
 */
export async function getPlans(config: SylphxConfig): Promise<Plan[]> {
	return callTrpc<void, Plan[]>(config, 'billing.getPlans', undefined, 'query')
}

/**
 * Get user's subscription
 *
 * @example
 * ```typescript
 * const sub = await getSubscription(config, 'user-123')
 * if (sub?.status === 'active') {
 *   console.log(`Active plan: ${sub.planName}`)
 * }
 * ```
 */
export async function getSubscription(
	config: SylphxConfig,
	userId: string
): Promise<Subscription | null> {
	return callTrpc<{ userId: string }, Subscription | null>(
		config,
		'billing.getSubscription',
		{ userId },
		'query'
	)
}

/**
 * Create a checkout session
 *
 * @example
 * ```typescript
 * const { checkoutUrl } = await createCheckout(config, {
 *   userId: 'user-123',
 *   planSlug: 'pro',
 *   interval: 'monthly',
 *   successUrl: 'https://myapp.com/success',
 *   cancelUrl: 'https://myapp.com/pricing',
 * })
 *
 * window.location.href = checkoutUrl
 * ```
 */
export async function createCheckout(
	config: SylphxConfig,
	input: CheckoutInput
): Promise<{ checkoutUrl: string }> {
	return callTrpc<CheckoutInput, { checkoutUrl: string }>(
		config,
		'billing.createCheckout',
		input,
		'mutation'
	)
}

/**
 * Create a billing portal session
 *
 * @example
 * ```typescript
 * const { portalUrl } = await createPortalSession(config, {
 *   userId: 'user-123',
 *   returnUrl: window.location.href,
 * })
 *
 * window.location.href = portalUrl
 * ```
 */
export async function createPortalSession(
	config: SylphxConfig,
	input: { userId: string; returnUrl: string }
): Promise<{ portalUrl: string }> {
	return callTrpc<typeof input, { portalUrl: string }>(
		config,
		'billing.createPortalSession',
		input,
		'mutation'
	)
}

/**
 * Get billing balance (credits, etc.)
 *
 * @example
 * ```typescript
 * const balance = await getBillingBalance(config)
 * console.log(`Credits: ${balance.credits}`)
 * ```
 */
export async function getBillingBalance(
	config: SylphxConfig
): Promise<{ credits: number; currency: string }> {
	return callTrpc<void, { credits: number; currency: string }>(
		config,
		'billing.getBalance',
		undefined,
		'query'
	)
}

/**
 * Get billing usage
 *
 * @example
 * ```typescript
 * const usage = await getBillingUsage(config, { month: '2024-01' })
 * ```
 */
export async function getBillingUsage(
	config: SylphxConfig,
	options?: { month?: string }
): Promise<Record<string, unknown>> {
	return callTrpc<typeof options, Record<string, unknown>>(
		config,
		'billing.getUsage',
		options ?? {},
		'query'
	)
}
