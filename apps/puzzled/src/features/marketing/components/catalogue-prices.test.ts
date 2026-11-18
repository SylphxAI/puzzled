import { describe, expect, test } from 'bun:test'
import catalogue from '../../../../../../config/commercial/catalogue.json'
import { FAMILY_SEATS, type ListedPriceKey, listPrice, offerPrice } from './catalogue-prices'

const KEYS: ListedPriceKey[] = [
	'puzzled_starter_unlock',
	'plus_individual_monthly',
	'plus_individual_yearly',
	'plus_family_monthly',
	'plus_family_yearly',
]

describe('catalogue list prices', () => {
	test('format every quoted plan from the catalogue minor units', () => {
		for (const key of KEYS) {
			const plan = catalogue.plans.find((entry) => entry.price_key === key)
			expect(plan).toBeDefined()
			expect(offerPrice(key)).toBe(((plan?.unit_amounts.usd ?? 0) / 100).toFixed(2))
			expect(listPrice(key)).toBe(`$${offerPrice(key)}`)
			expect(listPrice(key, 'gbp')).toBe(`£${offerPrice(key, 'gbp')}`)
		}
	})

	test('family seats come from the family plans grants', () => {
		const family = catalogue.plans.filter((plan) => plan.product === 'puzzled_plus_family')
		expect(family.length).toBeGreaterThan(0)
		for (const plan of family) expect(Number(plan.grants.seats)).toBe(FAMILY_SEATS)
		expect(Number.isInteger(FAMILY_SEATS) && FAMILY_SEATS > 1).toBe(true)
	})
})
