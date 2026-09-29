/**
 * Turns `config/commercial/catalogue.json` into the spec Sylphx Money's
 * `catalogs/default` accepts (cloud#10272: Catalog.spec with features and
 * products, each product with its prices). CI runs this and applies the result
 * (.github/workflows/money-catalogue.yml); nothing else writes the catalogue.
 *
 * Usage: bun scripts/money-catalogue-spec.ts  ->  prints {"spec": {...}}
 */

import { readFileSync } from 'node:fs'

type Names = Record<string, string>
type Catalogue = {
	features: Record<string, { kind: string; name: Names }>
	products: { id: string; name: Names }[]
	plans: {
		price_key: string
		product: string
		interval: string
		unit_amounts: Record<string, number>
		tax_behavior: string
		grants: Record<string, string>
		trial_days: number
	}[]
}

const KEY = /^[a-z][a-z0-9_]{0,63}$/
const FEATURE_KEY = /^[a-z][a-z0-9_.]{0,63}$/

export type Spec = {
	features: { key: string; display_name: string; kind: 'boolean' | 'limit' }[]
	products: {
		key: string
		display_name: string
		features: Record<string, string>
		prices: {
			key: string
			recurring_interval: string
			tax_behavior: string
			unit_amounts: Record<string, string>
			trial_days?: number
		}[]
	}[]
}

function fail(message: string): never {
	throw new Error(`catalogue: ${message}`)
}

export function toSpec(catalogue: Catalogue): Spec {
	const features = Object.entries(catalogue.features).map(([key, feature]) => {
		if (!FEATURE_KEY.test(key)) fail(`feature key ${key} is not accepted by Money`)
		if (feature.kind !== 'boolean' && feature.kind !== 'limit') {
			fail(`feature ${key} has kind ${feature.kind}`)
		}
		return { key, display_name: feature.name['en-US'] ?? key, kind: feature.kind }
	})
	const products = catalogue.products.map((product) => {
		if (!KEY.test(product.id)) fail(`product key ${product.id} is not accepted by Money`)
		const plans = catalogue.plans.filter((plan) => plan.product === product.id)
		if (plans.length === 0) fail(`product ${product.id} has no price`)
		// One product grants one set of features: every price of it must agree.
		const grants = plans[0].grants
		for (const plan of plans) {
			if (JSON.stringify(sorted(plan.grants)) !== JSON.stringify(sorted(grants))) {
				fail(`prices of ${product.id} grant different features`)
			}
		}
		for (const key of Object.keys(grants)) {
			if (!(key in catalogue.features)) fail(`${product.id} grants undeclared feature ${key}`)
		}
		return {
			key: product.id,
			display_name: product.name['en-US'] ?? product.id,
			features: grants,
			prices: plans.map((plan) => {
				if (!KEY.test(plan.price_key)) fail(`price key ${plan.price_key} is not accepted by Money`)
				return {
					key: plan.price_key,
					recurring_interval: plan.interval,
					tax_behavior: plan.tax_behavior,
					// Money: upper-case ISO 4217 code to minor units as a decimal string.
					unit_amounts: Object.fromEntries(
						Object.entries(plan.unit_amounts).map(([code, minor]) => [
							code.toUpperCase(),
							String(minor),
						]),
					),
					...(plan.trial_days > 0 ? { trial_days: plan.trial_days } : {}),
				}
			}),
		}
	})
	return { features, products }
}

function sorted(map: Record<string, string>): [string, string][] {
	return Object.entries(map).sort(([a], [b]) => a.localeCompare(b))
}

if (import.meta.main) {
	const path = process.argv[2] ?? 'config/commercial/catalogue.json'
	process.stdout.write(
		`${JSON.stringify({ spec: toSpec(JSON.parse(readFileSync(path, 'utf8'))) })}\n`,
	)
}
