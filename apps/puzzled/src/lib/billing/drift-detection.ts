import { eq } from 'drizzle-orm'
import { getStripeInstance } from '@/features/subscription/server'
import { db } from '@/lib/db'
import { planPrices, plans } from '@/lib/db/schema'

/**
 * Price drift detection result
 */
export interface PriceDrift {
	planId: string
	planName: string
	planSlug: string
	priceId: string
	interval: string
	dbAmount: number
	stripeAmount: number
	difference: number
	stripePriceId: string
}

/**
 * Check for price drift between database and Stripe
 *
 * Compares the prices stored in our database with the actual prices in Stripe
 * to detect any mismatches that could cause billing issues.
 *
 * @returns Array of price drifts found, empty if no drift
 */
export async function detectPriceDrift(): Promise<PriceDrift[]> {
	const stripe = getStripeInstance()
	const drifts: PriceDrift[] = []

	// Get all active plans with their prices
	const allPlans = await db.query.plans.findMany({
		where: eq(plans.isActive, true),
		with: {
			prices: {
				where: eq(planPrices.isActive, true),
			},
		},
	})

	// Check each price
	for (const plan of allPlans) {
		// Skip free plan (no Stripe product)
		if (plan.slug === 'free') continue

		for (const price of plan.prices) {
			// Skip prices without Stripe ID
			if (!price.stripePriceId) {
				console.warn(`[PriceDrift] Price ${price.id} has no Stripe price ID`)
				continue
			}

			try {
				// Fetch price from Stripe
				const stripePrice = await stripe.prices.retrieve(price.stripePriceId)

				// Compare amounts (both are in cents)
				if (stripePrice.unit_amount !== price.amount) {
					drifts.push({
						planId: plan.id,
						planName: plan.name,
						planSlug: plan.slug,
						priceId: price.id,
						interval: price.interval,
						dbAmount: price.amount,
						stripeAmount: stripePrice.unit_amount || 0,
						difference: (stripePrice.unit_amount || 0) - price.amount,
						stripePriceId: price.stripePriceId,
					})
				}

				// Check if Stripe price is inactive but DB says active
				if (!stripePrice.active && price.isActive) {
					console.warn(`[PriceDrift] Price ${price.id} is active in DB but inactive in Stripe`)
				}
			} catch (error) {
				console.error(`[PriceDrift] Error fetching Stripe price ${price.stripePriceId}:`, error)
				// Continue checking other prices
			}
		}
	}

	return drifts
}

/**
 * Format price drift for human-readable output
 */
export function formatPriceDrift(drift: PriceDrift): string {
	const dbPrice = (drift.dbAmount / 100).toFixed(2)
	const stripePrice = (drift.stripeAmount / 100).toFixed(2)
	const diff = Math.abs(drift.difference / 100).toFixed(2)
	const direction = drift.difference > 0 ? 'higher' : 'lower'

	return `${drift.planName} (${drift.interval}): DB=$${dbPrice}, Stripe=$${stripePrice} (Stripe is $${diff} ${direction})`
}
