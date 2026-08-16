import { describe, expect, test } from 'bun:test'
import type { Plan } from '@sylphx/sdk/react'
import { buildUIPlans } from './pricing-plans'

function platformPlan(overrides: Partial<Plan> = {}): Plan {
	return {
		id: 'plan_premium',
		slug: 'premium',
		name: 'Puzzled Plus',
		description: null,
		features: ['allGames', 'archive'],
		monthlyPrice: 499,
		annualPrice: 3999,
		lifetimePrice: null,
		isPopular: true,
		isActive: true,
		sortOrder: 1,
		...overrides,
	}
}

describe('buildUIPlans', () => {
	test('keeps the free floor without inventing a paid offer', () => {
		expect(buildUIPlans([])).toEqual([
			expect.objectContaining({ id: 'free', slug: 'free', price: 0 }),
		])
	})

	test('does not promote inactive or zero-priced paid catalog rows', () => {
		const plans = buildUIPlans([
			platformPlan({ isActive: false }),
			platformPlan({ monthlyPrice: 0, annualPrice: 0 }),
		])

		expect(plans.map((plan) => plan.id)).toEqual(['free'])
	})

	test('maps paid prices, features, and checkout slug from Platform', () => {
		const plans = buildUIPlans([platformPlan()])

		expect(plans.map((plan) => plan.id)).toEqual(['free', 'premium', 'annual'])
		expect(plans[1]).toMatchObject({
			id: 'premium',
			slug: 'premium',
			price: 499,
			features: ['allGames', 'archive'],
			highlight: true,
		})
		expect(plans[2]).toMatchObject({
			id: 'annual',
			slug: 'premium',
			price: 3999,
			features: ['allGames', 'archive'],
		})
	})

	test('supports a catalog that only publishes an annual paid price', () => {
		const plans = buildUIPlans([platformPlan({ monthlyPrice: 0 })])

		expect(plans.map((plan) => plan.id)).toEqual(['free', 'annual'])
		expect(plans[1]).toMatchObject({ price: 3999, interval: 'annual' })
	})
})
