/**
 * Guard for the catalogue Money applies: `config/commercial/catalogue.json` must
 * convert into a spec Money accepts (keys, kinds, decimal-string amounts), and
 * the app must not carry an amount of its own.
 */

import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { toSpec } from '../../../scripts/money-catalogue-spec'

const root = join(import.meta.dir, '../../..')
const catalogue = JSON.parse(readFileSync(join(root, 'config/commercial/catalogue.json'), 'utf8'))

describe('money catalogue spec', () => {
	const spec = toSpec(catalogue)

	test('declares the plus, family and seats features with the right kinds', () => {
		const kinds = Object.fromEntries(spec.features.map((f) => [f.key, f.kind]))
		expect(kinds).toEqual({ plus: 'boolean', family: 'boolean', seats: 'limit' })
	})

	test('every plan becomes a price of its product with Money-shaped amounts', () => {
		const prices = spec.products.flatMap((p) => p.prices)
		expect(prices.length).toBe(catalogue.plans.length)
		for (const price of prices) {
			expect(['month', 'year']).toContain(price.recurring_interval)
			expect(price.tax_behavior).toBe('inclusive')
			for (const [code, minor] of Object.entries(price.unit_amounts)) {
				expect(code).toMatch(/^[A-Z]{3}$/)
				expect(minor).toMatch(/^[0-9]+$/)
			}
		}
	})

	test('products carry the seats limit that ranks them: 1 individual, above 1 family', () => {
		const seats = Object.fromEntries(spec.products.map((p) => [p.key, p.features.seats]))
		expect(seats).toEqual({ puzzled_plus: '1', puzzled_plus_family: '4' })
		for (const product of spec.products) expect(product.features.plus).toBe('true')
	})

	test('no price carries a trial until the Money trial notice is live', () => {
		const trials = Object.fromEntries(
			spec.products.flatMap((p) => p.prices).map((price) => [price.key, price.trial_days ?? 0]),
		)
		expect(trials).toEqual({
			plus_individual_monthly: 0,
			plus_individual_yearly: 0,
			plus_family_monthly: 0,
			plus_family_yearly: 0,
		})
	})

	test('a price key Money would refuse is rejected', () => {
		const bad = structuredClone(catalogue)
		bad.plans[0].price_key = 'Plus-Monthly'
		expect(() => toSpec(bad)).toThrow(/not accepted/)
	})

	test('prices of one product must grant the same features', () => {
		const bad = structuredClone(catalogue)
		bad.plans[0].grants = { plus: 'true', seats: '2' }
		expect(() => toSpec(bad)).toThrow(/different features/)
	})

	test('the catalogue names the writer and no reader', () => {
		expect(catalogue.readme).toContain('CI applies it to Sylphx Money')
		expect(JSON.stringify(catalogue)).not.toMatch(/stripe/i)
	})
})
