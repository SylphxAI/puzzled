import type { Plan as PlatformPlan } from '@sylphx/sdk/react'

/** UI plan representation derived only from the Platform catalog. */
export interface UIPlan {
	id: string
	slug: string
	price: number
	currency: string
	period: 'perMonth' | 'perYear' | null
	interval: 'monthly' | 'annual'
	highlight: boolean
	badge: string | null
	badgeColor: string | null
	features: string[]
}

const FREE_FEATURES = ['dailyPuzzle', 'basicStats']

/**
 * Build pricing cards from the authoritative Platform catalog.
 *
 * An empty or free-only catalog intentionally returns only the free card. It
 * must never invent a paid price, feature list, or checkout slug locally.
 */
export function buildUIPlans(platformPlans: readonly PlatformPlan[]): UIPlan[] {
	const plans: UIPlan[] = [
		{
			id: 'free',
			slug: 'free',
			price: 0,
			currency: 'usd',
			period: null,
			interval: 'monthly',
			highlight: false,
			badge: null,
			badgeColor: null,
			features: [...FREE_FEATURES],
		},
	]

	const premiumPlan = [...platformPlans]
		.filter(
			(plan) =>
				plan.slug !== 'free' && plan.isActive && (plan.monthlyPrice > 0 || plan.annualPrice > 0),
		)
		.sort((a, b) => a.sortOrder - b.sortOrder)[0]

	if (!premiumPlan) return plans

	const features = [...premiumPlan.features]
	const isPopular = premiumPlan.isPopular

	if (premiumPlan.monthlyPrice > 0) {
		plans.push({
			id: 'premium',
			slug: premiumPlan.slug,
			price: premiumPlan.monthlyPrice,
			currency: 'usd',
			period: 'perMonth',
			interval: 'monthly',
			highlight: isPopular,
			badge: isPopular ? 'popular' : null,
			badgeColor: isPopular ? 'bg-primary' : null,
			features,
		})
	}

	if (premiumPlan.annualPrice > 0) {
		plans.push({
			id: 'annual',
			slug: premiumPlan.slug,
			price: premiumPlan.annualPrice,
			currency: 'usd',
			period: 'perYear',
			interval: 'annual',
			highlight: false,
			badge: null,
			badgeColor: null,
			features,
		})
	}

	return plans
}
