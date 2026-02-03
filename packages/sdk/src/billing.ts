/**
 * Billing Functions
 *
 * Pure functions for billing and subscriptions.
 * Uses REST API at /api/sdk/billing/* for all operations.
 *
 * Types are derived from the OpenAPI spec (generated/api.d.ts).
 * Run `bun run generate:types:local` to regenerate after API changes.
 */

import { type SylphxConfig, callApi } from './config'
import type { components } from './generated/api'

// ============================================================================
// Types (re-exported from generated OpenAPI spec)
// ============================================================================

export type Plan = components['schemas']['Plan']
export type Subscription = components['schemas']['Subscription']
export type CheckoutRequest = components['schemas']['CheckoutRequest']
export type CheckoutResponse = components['schemas']['CheckoutResponse']
export type PortalRequest = components['schemas']['PortalRequest']
export type PortalResponse = components['schemas']['PortalResponse']
export type BalanceResponse = components['schemas']['BalanceResponse']
export type UsageResponse = components['schemas']['UsageResponse']


// ============================================================================
// Functions
// ============================================================================

/**
 * Get available plans
 *
 * @example
 * ```typescript
 * const plans = await getPlans(config)
 * plans.forEach(plan => console.log(plan.name, plan.priceMonthly))
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
 *   console.log(`Active plan: ${sub.planSlug}`)
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
	input: CheckoutRequest
): Promise<CheckoutResponse> {
	return callApi<CheckoutResponse>(config, '/billing/checkout', {
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
	input: PortalRequest
): Promise<PortalResponse> {
	return callApi<PortalResponse>(config, '/billing/portal', {
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
 * console.log(`Balance: ${balance.balance.currentFormatted}`)
 * ```
 */
export async function getBillingBalance(config: SylphxConfig): Promise<BalanceResponse> {
	return callApi<BalanceResponse>(config, '/billing/balance')
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
): Promise<UsageResponse> {
	return callApi<UsageResponse>(config, '/billing/usage', {
		query: options?.month ? { month: options.month } : undefined,
	})
}
