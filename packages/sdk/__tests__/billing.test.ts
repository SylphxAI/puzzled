/**
 * Billing Functions Tests
 *
 * Tests for billing and subscription pure functions.
 */

import { describe, test, expect, afterEach } from 'bun:test'
import { createConfig } from '../src/config'
import {
	getPlans,
	getSubscription,
	createCheckout,
	createPortalSession,
	getBillingBalance,
	getBillingUsage,
	type Plan,
	type Subscription,
} from '../src/billing'

// ============================================================================
// Test Setup
// ============================================================================

const createTestConfig = () =>
	createConfig({
		appId: 'test-app',
		appSecret: 'test-secret',
		platformUrl: 'https://test.sylphx.com',
	})

const originalFetch = globalThis.fetch

afterEach(() => {
	globalThis.fetch = originalFetch
})

const mockFetch = (response: unknown, status = 200) => {
	globalThis.fetch = async () => {
		return new Response(JSON.stringify(response), { status })
	}
}

const mockFetchError = (message: string, status: number) => {
	globalThis.fetch = async () => {
		return new Response(JSON.stringify({ error: { message } }), { status })
	}
}

// ============================================================================
// Test Data
// ============================================================================

const mockPlans: Plan[] = [
	{
		id: 'plan-1',
		slug: 'free',
		name: 'Free',
		description: 'Get started for free',
		features: ['Basic features', 'Limited storage'],
		monthlyPrice: 0,
		annualPrice: 0,
		lifetimePrice: null,
		isPopular: false,
		isActive: true,
		isDefault: true,
	},
	{
		id: 'plan-2',
		slug: 'pro',
		name: 'Pro',
		description: 'For power users',
		features: ['All features', 'Unlimited storage', 'Priority support'],
		monthlyPrice: 999, // $9.99
		annualPrice: 9900, // $99.00
		lifetimePrice: 29900, // $299.00
		isPopular: true,
		isActive: true,
	},
]

const mockSubscription: Subscription = {
	id: 'sub-123',
	planId: 'plan-2',
	planSlug: 'pro',
	planName: 'Pro',
	status: 'active',
	interval: 'monthly',
	currentPeriodStart: '2024-01-01T00:00:00Z',
	currentPeriodEnd: '2024-02-01T00:00:00Z',
	cancelAtPeriodEnd: false,
}

// ============================================================================
// getPlans Tests
// ============================================================================

describe('getPlans', () => {
	test('returns list of plans', async () => {
		mockFetch(mockPlans)

		const config = createTestConfig()
		const plans = await getPlans(config)

		expect(plans).toHaveLength(2)
		expect(plans[0].slug).toBe('free')
		expect(plans[1].slug).toBe('pro')
	})

	test('includes all plan properties', async () => {
		mockFetch(mockPlans)

		const config = createTestConfig()
		const plans = await getPlans(config)

		const proPlan = plans.find((p) => p.slug === 'pro')!
		expect(proPlan.id).toBe('plan-2')
		expect(proPlan.name).toBe('Pro')
		expect(proPlan.description).toBe('For power users')
		expect(proPlan.features).toContain('All features')
		expect(proPlan.monthlyPrice).toBe(999)
		expect(proPlan.annualPrice).toBe(9900)
		expect(proPlan.lifetimePrice).toBe(29900)
		expect(proPlan.isPopular).toBe(true)
	})

	test('calls correct endpoint', async () => {
		let capturedUrl: string | undefined

		globalThis.fetch = async (url) => {
			capturedUrl = url.toString()
			return new Response(JSON.stringify([]))
		}

		const config = createTestConfig()
		await getPlans(config)

		expect(capturedUrl).toContain('/api/sdk/billing/plans')
	})
})

// ============================================================================
// getSubscription Tests
// ============================================================================

describe('getSubscription', () => {
	test('returns subscription for user', async () => {
		mockFetch(mockSubscription)

		const config = createTestConfig()
		const sub = await getSubscription(config, 'user-123')

		expect(sub).not.toBeNull()
		expect(sub!.planSlug).toBe('pro')
		expect(sub!.status).toBe('active')
	})

	test('returns null when no subscription', async () => {
		mockFetch(null)

		const config = createTestConfig()
		const sub = await getSubscription(config, 'user-456')

		expect(sub).toBeNull()
	})

	test('includes userId in query', async () => {
		let capturedUrl: string | undefined

		globalThis.fetch = async (url) => {
			capturedUrl = url.toString()
			return new Response(JSON.stringify(null))
		}

		const config = createTestConfig()
		await getSubscription(config, 'user-xyz')

		expect(capturedUrl).toContain('userId=user-xyz')
	})

	test('handles various subscription statuses', async () => {
		const statuses: Subscription['status'][] = [
			'active',
			'trialing',
			'past_due',
			'canceled',
			'incomplete',
			'incomplete_expired',
			'paused',
		]

		for (const status of statuses) {
			mockFetch({ ...mockSubscription, status })

			const config = createTestConfig()
			const sub = await getSubscription(config, 'user-123')

			expect(sub!.status).toBe(status)
		}
	})

	test('includes trial info when present', async () => {
		mockFetch({
			...mockSubscription,
			status: 'trialing',
			trialEnd: '2024-01-15T00:00:00Z',
		})

		const config = createTestConfig()
		const sub = await getSubscription(config, 'user-123')

		expect(sub!.status).toBe('trialing')
		expect(sub!.trialEnd).toBe('2024-01-15T00:00:00Z')
	})
})

// ============================================================================
// createCheckout Tests
// ============================================================================

describe('createCheckout', () => {
	test('returns checkout URL', async () => {
		mockFetch({ checkoutUrl: 'https://checkout.stripe.com/session-xyz' })

		const config = createTestConfig()
		const result = await createCheckout(config, {
			userId: 'user-123',
			planSlug: 'pro',
			interval: 'monthly',
			successUrl: 'https://myapp.com/success',
			cancelUrl: 'https://myapp.com/cancel',
		})

		expect(result.checkoutUrl).toBe('https://checkout.stripe.com/session-xyz')
	})

	test('sends correct request body', async () => {
		let capturedBody: string | undefined

		globalThis.fetch = async (_url, init) => {
			capturedBody = init?.body as string
			return new Response(JSON.stringify({ checkoutUrl: 'https://checkout.stripe.com/xyz' }))
		}

		const config = createTestConfig()
		await createCheckout(config, {
			userId: 'user-abc',
			planSlug: 'pro',
			interval: 'annual',
			successUrl: 'https://app.com/success',
			cancelUrl: 'https://app.com/cancel',
		})

		const body = JSON.parse(capturedBody!)
		expect(body.userId).toBe('user-abc')
		expect(body.planSlug).toBe('pro')
		expect(body.interval).toBe('annual')
		expect(body.successUrl).toBe('https://app.com/success')
		expect(body.cancelUrl).toBe('https://app.com/cancel')
	})

	test('supports all intervals', async () => {
		const intervals: Array<'monthly' | 'annual' | 'lifetime'> = ['monthly', 'annual', 'lifetime']

		for (const interval of intervals) {
			let capturedBody: string | undefined

			globalThis.fetch = async (_url, init) => {
				capturedBody = init?.body as string
				return new Response(JSON.stringify({ checkoutUrl: 'https://checkout.stripe.com/xyz' }))
			}

			const config = createTestConfig()
			await createCheckout(config, {
				userId: 'user-123',
				planSlug: 'pro',
				interval,
				successUrl: 'https://app.com/success',
				cancelUrl: 'https://app.com/cancel',
			})

			const body = JSON.parse(capturedBody!)
			expect(body.interval).toBe(interval)
		}
	})

	test('throws on error', async () => {
		mockFetchError('Plan not found', 404)

		const config = createTestConfig()

		await expect(
			createCheckout(config, {
				userId: 'user-123',
				planSlug: 'invalid-plan',
				interval: 'monthly',
				successUrl: 'https://app.com/success',
				cancelUrl: 'https://app.com/cancel',
			})
		).rejects.toThrow('Plan not found')
	})
})

// ============================================================================
// createPortalSession Tests
// ============================================================================

describe('createPortalSession', () => {
	test('returns portal URL', async () => {
		mockFetch({ portalUrl: 'https://billing.stripe.com/session-abc' })

		const config = createTestConfig()
		const result = await createPortalSession(config, {
			userId: 'user-123',
			returnUrl: 'https://myapp.com/settings',
		})

		expect(result.portalUrl).toBe('https://billing.stripe.com/session-abc')
	})

	test('sends correct request body', async () => {
		let capturedBody: string | undefined

		globalThis.fetch = async (_url, init) => {
			capturedBody = init?.body as string
			return new Response(JSON.stringify({ portalUrl: 'https://billing.stripe.com/xyz' }))
		}

		const config = createTestConfig()
		await createPortalSession(config, {
			userId: 'user-xyz',
			returnUrl: 'https://app.com/return',
		})

		const body = JSON.parse(capturedBody!)
		expect(body.userId).toBe('user-xyz')
		expect(body.returnUrl).toBe('https://app.com/return')
	})

	test('throws when user has no billing account', async () => {
		mockFetchError('No billing account found', 404)

		const config = createTestConfig()

		await expect(
			createPortalSession(config, {
				userId: 'user-no-billing',
				returnUrl: 'https://app.com/return',
			})
		).rejects.toThrow('No billing account found')
	})
})

// ============================================================================
// getBillingBalance Tests
// ============================================================================

describe('getBillingBalance', () => {
	test('returns balance info', async () => {
		mockFetch({ credits: 5000, currency: 'USD' })

		const config = createTestConfig()
		const balance = await getBillingBalance(config)

		expect(balance.credits).toBe(5000)
		expect(balance.currency).toBe('USD')
	})

	test('calls correct endpoint', async () => {
		let capturedUrl: string | undefined

		globalThis.fetch = async (url) => {
			capturedUrl = url.toString()
			return new Response(JSON.stringify({ credits: 0, currency: 'USD' }))
		}

		const config = createTestConfig()
		await getBillingBalance(config)

		expect(capturedUrl).toContain('/api/sdk/billing/balance')
	})
})

// ============================================================================
// getBillingUsage Tests
// ============================================================================

describe('getBillingUsage', () => {
	test('returns usage data', async () => {
		mockFetch({
			apiCalls: 1500,
			storage: 256000000,
			aiTokens: 50000,
		})

		const config = createTestConfig()
		const usage = await getBillingUsage(config)

		expect(usage.apiCalls).toBe(1500)
		expect(usage.storage).toBe(256000000)
		expect(usage.aiTokens).toBe(50000)
	})

	test('accepts month filter', async () => {
		let capturedUrl: string | undefined

		globalThis.fetch = async (url) => {
			capturedUrl = url.toString()
			return new Response(JSON.stringify({}))
		}

		const config = createTestConfig()
		await getBillingUsage(config, { month: '2024-01' })

		expect(capturedUrl).toContain('month=2024-01')
	})

	test('works without month filter', async () => {
		let capturedUrl: string | undefined

		globalThis.fetch = async (url) => {
			capturedUrl = url.toString()
			return new Response(JSON.stringify({}))
		}

		const config = createTestConfig()
		await getBillingUsage(config)

		expect(capturedUrl).not.toContain('month=')
	})
})
