/**
 * Billing Functions
 *
 * Pure functions for billing and subscriptions.
 * Uses REST API at /api/sdk/billing/* for all operations.
 */

import { type SylphxConfig, callApi } from './config'

// ============================================================================
// Types
// ============================================================================

export interface Plan {
	id: string
	slug: string
	name: string
	description: string | null
	features: string[]
	// Price fields
	monthlyPrice: number
	annualPrice: number
	lifetimePrice: number | null
	// Display flags
	isPopular: boolean
	isActive: boolean
	isDefault?: boolean
	// Additional metadata
	limits?: Record<string, number>
	sortOrder?: number
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
	trialEnd?: string | null
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
	return callApi<Plan[]>(config, '/billing/plans')
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
	return callApi<Subscription | null>(config, '/billing/subscription', {
		query: { userId },
	})
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
	return callApi<{ checkoutUrl: string }>(config, '/billing/checkout', {
		method: 'POST',
		body: input,
	})
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
	return callApi<{ portalUrl: string }>(config, '/billing/portal', {
		method: 'POST',
		body: input,
	})
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
	return callApi<{ credits: number; currency: string }>(config, '/billing/balance')
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
	return callApi<Record<string, unknown>>(config, '/billing/usage', {
		query: options?.month ? { month: options.month } : undefined,
	})
}
