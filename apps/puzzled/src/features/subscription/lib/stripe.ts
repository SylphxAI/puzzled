import { eq } from 'drizzle-orm'
import Stripe from 'stripe'
import { TRIAL_CONFIG, WINBACK_CONFIG } from '@/lib/config/subscription'
import { db } from '@/lib/db'
import { planPrices, plans } from '@/lib/db/schema'

// Lazy initialization to avoid build-time errors when env vars aren't set
let stripeInstance: Stripe | null = null

export function getStripeInstance(): Stripe {
	if (!stripeInstance) {
		if (!process.env.STRIPE_SECRET_KEY) {
			throw new Error('STRIPE_SECRET_KEY is not configured')
		}
		stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY, {
			apiVersion: '2025-12-15.clover',
			typescript: true,
		})
	}
	return stripeInstance
}

// Lazy proxy for convenient access - defers initialization until first use
export const stripe = new Proxy({} as Stripe, {
	get(_target, prop) {
		return (getStripeInstance() as unknown as Record<string | symbol, unknown>)[prop]
	},
})

// ==================
// Plan Management (DB as source of truth)
// ==================

/**
 * Get all active plans with their prices
 */
export async function getPlans() {
	return db.query.plans.findMany({
		where: eq(plans.isActive, true),
		with: {
			prices: {
				where: eq(planPrices.isActive, true),
			},
		},
		orderBy: plans.sortOrder,
	})
}

/**
 * Get a specific plan by slug
 */
export async function getPlanBySlug(slug: string) {
	return db.query.plans.findFirst({
		where: eq(plans.slug, slug),
		with: {
			prices: {
				where: eq(planPrices.isActive, true),
			},
		},
	})
}

/**
 * Get price by plan slug and interval
 */
export async function getPriceId(planSlug: string, interval: 'monthly' | 'annual' | 'lifetime') {
	const plan = await db.query.plans.findFirst({
		where: eq(plans.slug, planSlug),
		with: {
			prices: true,
		},
	})

	if (!plan) return null

	const price = plan.prices.find((p) => p.interval === interval && p.isActive)
	return price?.stripePriceId ?? null
}

// ==================
// Stripe Sync (Platform → Stripe)
// ==================

/**
 * Sync a plan to Stripe (create or update product)
 */
export async function syncPlanToStripe(planId: string) {
	const plan = await db.query.plans.findFirst({
		where: eq(plans.id, planId),
		with: { prices: true },
	})

	if (!plan) throw new Error('Plan not found')
	if (plan.slug === 'free') return plan // Free plan doesn't need Stripe product

	let stripeProductId = plan.stripeProductId

	// Create or update Stripe product
	if (!stripeProductId) {
		const product = await stripe.products.create({
			name: plan.name,
			description: plan.description ?? undefined,
			metadata: {
				planId: plan.id,
				planSlug: plan.slug,
				brand: 'puzzled',
			},
		})
		stripeProductId = product.id

		// Save product ID to DB
		await db.update(plans).set({ stripeProductId }).where(eq(plans.id, planId))
	} else {
		// Update existing product
		await stripe.products.update(stripeProductId, {
			name: plan.name,
			description: plan.description ?? undefined,
		})
	}

	// Sync prices
	for (const price of plan.prices) {
		if (!price.stripePriceId) {
			// Create new price in Stripe
			const stripePrice = await stripe.prices.create({
				product: stripeProductId,
				unit_amount: price.amount,
				currency: price.currency,
				recurring:
					price.interval === 'lifetime'
						? undefined
						: {
								interval: price.interval === 'monthly' ? 'month' : 'year',
							},
				metadata: {
					planId: plan.id,
					priceId: price.id,
					brand: 'puzzled',
				},
			})

			// Save price ID to DB
			await db
				.update(planPrices)
				.set({ stripePriceId: stripePrice.id })
				.where(eq(planPrices.id, price.id))
		}
	}

	return db.query.plans.findFirst({
		where: eq(plans.id, planId),
		with: { prices: true },
	})
}

/**
 * Sync all plans to Stripe
 */
export async function syncAllPlansToStripe() {
	const allPlans = await db.query.plans.findMany({
		where: eq(plans.isActive, true),
	})

	const results = []
	for (const plan of allPlans) {
		if (plan.slug !== 'free') {
			const synced = await syncPlanToStripe(plan.id)
			results.push(synced)
		}
	}

	return results
}

// ==================
// Checkout & Billing
// ==================

export async function createCheckoutSession({
	userId,
	email,
	priceId,
	successUrl,
	cancelUrl,
	interval,
	customerId,
}: {
	userId: string
	email: string
	priceId: string
	successUrl: string
	cancelUrl: string
	interval: 'monthly' | 'annual' | 'lifetime'
	/** Existing Stripe customer ID - prevents duplicate customers */
	customerId?: string | null
}) {
	// Use 'payment' mode for lifetime (one-time), 'subscription' for recurring
	const isLifetime = interval === 'lifetime'

	const session = await stripe.checkout.sessions.create({
		// Use existing customer if available, otherwise use email to create/find customer
		...(customerId ? { customer: customerId } : { customer_email: email }),
		mode: isLifetime ? 'payment' : 'subscription',
		payment_method_types: ['card'],
		line_items: [
			{
				price: priceId,
				quantity: 1,
			},
		],
		success_url: successUrl,
		cancel_url: cancelUrl,
		// Enable automatic tax calculation for VAT/GST compliance
		automatic_tax: {
			enabled: true,
		},
		// Collect billing address for accurate tax calculation
		billing_address_collection: 'required',
		// Allow promo codes
		allow_promotion_codes: true,
		metadata: {
			userId,
			brand: 'puzzled',
			purchaseType: isLifetime ? 'lifetime' : 'subscription',
		},
		// subscription_data only applies to subscription mode
		...(isLifetime
			? {}
			: {
					subscription_data: {
						metadata: {
							userId,
							brand: 'puzzled',
						},
						trial_period_days: TRIAL_CONFIG.TRIAL_PERIOD_DAYS,
					},
				}),
	})

	return session
}

export async function createBillingPortalSession({
	customerId,
	returnUrl,
}: {
	customerId: string
	returnUrl: string
}) {
	const session = await stripe.billingPortal.sessions.create({
		customer: customerId,
		return_url: returnUrl,
	})

	return session
}

/**
 * Check if Stripe is configured
 */
export function isStripeConfigured(): boolean {
	return !!process.env.STRIPE_SECRET_KEY
}

/**
 * Create a Stripe customer for a new user
 */
export async function createStripeCustomer({
	userId,
	email,
	name,
}: {
	userId: string
	email: string
	name?: string | null
}): Promise<string> {
	const customer = await stripe.customers.create({
		email,
		name: name ?? undefined,
		metadata: {
			userId,
			brand: 'puzzled',
		},
	})

	return customer.id
}

/**
 * Ensure a user has a Stripe customer ID, creating one if needed
 * Use this for lazy customer creation when user upgrades from free tier
 */
export async function ensureStripeCustomer({
	userId,
	email,
	name,
	existingCustomerId,
}: {
	userId: string
	email: string
	name?: string | null
	existingCustomerId?: string | null
}): Promise<string> {
	// Return existing if already set
	if (existingCustomerId) {
		return existingCustomerId
	}

	// Create new customer
	const customerId = await createStripeCustomer({ userId, email, name })

	// Update subscription with new customer ID
	const { subscriptions } = await import('@/lib/db/schema')
	const { eq } = await import('drizzle-orm')

	await db
		.update(subscriptions)
		.set({ stripeCustomerId: customerId })
		.where(eq(subscriptions.userId, userId))

	return customerId
}

export async function cancelSubscription(subscriptionId: string) {
	return stripe.subscriptions.update(subscriptionId, {
		cancel_at_period_end: true,
	})
}

// ==================
// Coupons & Promotions
// ==================

/**
 * Get or create the WINBACK50 coupon (50% off for churned users)
 * Creates if it doesn't exist, returns existing one if it does
 */
export async function getOrCreateWinBackCoupon(): Promise<string> {
	const couponId = 'WINBACK50'

	try {
		// Try to retrieve existing coupon
		const existingCoupon = await stripe.coupons.retrieve(couponId)
		return existingCoupon.id
	} catch (_error) {
		// Coupon doesn't exist, create it
		const coupon = await stripe.coupons.create({
			id: couponId,
			name: 'Win-Back 50% Off',
			percent_off: 50,
			duration: 'once', // Only applies to first payment
			metadata: {
				campaign: 'win-back',
				type: 'churn-recovery',
				brand: 'puzzled',
			},
		})

		return coupon.id
	}
}

/**
 * Create a time-limited promotion code for the win-back coupon
 * Expires after trial period days
 */
export async function createWinBackPromotionCode(userId: string): Promise<string> {
	const couponId = await getOrCreateWinBackCoupon()

	// Create a unique promotion code for this user
	const expiresAt = Math.floor(Date.now() / 1000) + TRIAL_CONFIG.TRIAL_PERIOD_SECONDS

	const promotionCode = await stripe.promotionCodes.create({
		promotion: {
			type: 'coupon',
			coupon: couponId,
		},
		code: `COMEBACK${userId.slice(0, 8).toUpperCase()}`, // Unique code per user
		max_redemptions: 1, // Can only be used once
		expires_at: expiresAt,
		metadata: {
			userId,
			campaign: WINBACK_CONFIG.CAMPAIGN_ID,
			brand: 'puzzled',
		},
	})

	return promotionCode.code
}
