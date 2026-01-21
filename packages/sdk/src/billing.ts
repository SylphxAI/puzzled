/**
 * Billing Functions
 *
 * Pure functions for billing and subscriptions.
 * Uses REST API at /api/sdk/billing/* for all operations.
 */

import { type SylphxConfig, buildHeaders } from './config'

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
// Internal Helpers
// ============================================================================

/**
 * Build REST API URL for SDK endpoints
 */
function buildRestUrl(config: SylphxConfig, path: string, query?: Record<string, string>): string {
	const url = new URL(`${config.platformUrl}/api/sdk${path}`)
	if (query) {
		Object.entries(query).forEach(([key, value]) => {
			if (value !== undefined) {
				url.searchParams.set(key, value)
			}
		})
	}
	return url.toString()
}

/**
 * Make a REST API call and handle errors
 */
async function callRest<TOutput>(
	config: SylphxConfig,
	path: string,
	options: {
		method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
		body?: unknown
		query?: Record<string, string>
	} = {}
): Promise<TOutput> {
	const { method = 'GET', body, query } = options
	const url = buildRestUrl(config, path, query)

	const response = await fetch(url, {
		method,
		headers: buildHeaders(config),
		...(config.platformMode && { credentials: 'include' as const }),
		...(body !== undefined && { body: JSON.stringify(body) }),
	})

	if (!response.ok) {
		const error = await response.json().catch(() => ({ error: { message: 'Request failed' } }))
		throw new Error(error.error?.message ?? error.message ?? 'Request failed')
	}

	return response.json()
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
	return callRest<Plan[]>(config, '/billing/plans')
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
	return callRest<Subscription | null>(config, '/billing/subscription', {
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
	return callRest<{ checkoutUrl: string }>(config, '/billing/checkout', {
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
	return callRest<{ portalUrl: string }>(config, '/billing/portal', {
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
	return callRest<{ credits: number; currency: string }>(config, '/billing/balance')
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
	return callRest<Record<string, unknown>>(config, '/billing/usage', {
		query: options?.month ? { month: options.month } : undefined,
	})
}
