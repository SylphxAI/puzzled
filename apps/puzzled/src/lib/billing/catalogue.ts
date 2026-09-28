/**
 * The commercial catalogue — the one authored place for Puzzled's products,
 * price keys, amounts, features (entitlements), family seats and refund policy.
 *
 * The file is `config/commercial/catalogue.json` at the repository root: the
 * declaration input for Sylphx Money, and until the cutover the source the app
 * reads. This module is the web reader: the pricing page renders its prices and
 * its names from here, so changing a price or a name is one line in one file.
 * The same file is embedded by the Rust api
 * (`crates/puzzled-core/src/capabilities/billing_access/catalogue.rs`, which
 * serves `ListPlans` from it and keeps sales closed while the payment
 * processor's published prices differ from it) and published to Stripe by
 * `scripts/stripe-setup.ts`.
 *
 * At the Money cutover the runtime reads move to Money (its catalogue endpoint
 * and its entitlement checks), this module goes away, and the file stays as the
 * record of what was declared.
 *
 * Import with `import type` from client components; a value import would put
 * the catalogue into the browser bundle.
 */

import catalogue from '../../../../../config/commercial/catalogue.json'

/** Display names by locale; a locale the file does not carry falls back to en-US. */
export type LocalizedNames = Record<string, string>

export type Plan = {
	/** The stable key Sylphx Money declares this price under. */
	price_key: string
	/** The app's plan id (`individual_monthly`, ...), also the lookup key's suffix. */
	plan_id: string
	/** The payment processor's price lookup key while Stripe is the processor. */
	provider_lookup_key: string
	product: string
	name: LocalizedNames
	interval: string
	/** Currency (lowercase) to amount in minor units, tax included. */
	unit_amounts: Record<string, number>
	tax_behavior: string
	/**
	 * What this price grants, feature id to value: a boolean feature is
	 * `'true'`, the `seats` limit is a decimal string. The shape Sylphx
	 * Money's entitlement check answers in.
	 */
	grants: Record<string, string>
	trial_days: number
	source: string
}

export type Product = {
	id: string
	name: LocalizedNames
	source: string
}

export type Feature = {
	/** `boolean` (granted as `'true'`) or `limit` (granted as a decimal string). */
	kind: string
	name: LocalizedNames
	unlocks: string[]
	implies?: string[]
	granted_by?: string[]
	value?: string
	gated_by: string
	source: string
}

export type FreeTier = {
	id: string
	name: LocalizedNames
	purchasable: boolean
	price_minor: number
	unlocks: string[]
	gated_by: string
	source: string
}

/** A plan as the pricing page shows it: one currency, one interval. */
export type PlanCard = {
	priceKey: string
	id: string
	name: LocalizedNames
	product: string
	family: boolean
	seats: number
	interval: 'month' | 'year'
	currency: string
	/** Minor units, tax included. */
	amountMinor: number
}

export const PRODUCTS: readonly Product[] = catalogue.products
// TypeScript infers the union of the file's plan literals, where a key a price
// does not grant (`family` on the single-seat prices) is optional; the guard
// test and the api's own parse hold the file to the Plan shape.
export const PLANS: readonly Plan[] = catalogue.plans as Plan[]
export const FEATURES: Record<string, Feature> = catalogue.features
export const FREE: FreeTier = catalogue.free
export const POLICY = catalogue.policy
export const BASE_CURRENCY: string = catalogue.base_currency

/**
 * People a price covers, the plan owner included: its `seats` limit grant (a
 * decimal string in the file). At the Money cutover the app asks Money for
 * this (`entitlement_grants:check { feature: 'seats' }`) instead.
 */
export function planSeats(plan: Plan): number {
	const seats = Number(plan.grants.seats)
	return Number.isInteger(seats) && seats >= 1 ? seats : 1
}

/** People on one family plan, the owner included (the family price's seats grant). */
export const FAMILY_MAX_MEMBERS: number = Math.max(
	1,
	...PLANS.filter((plan) => hasGrant(plan, 'family')).map(planSeats),
)

/** Days after the first subscription starts in which cancelling refunds it in full. */
export const CANCELLATION_DAYS: number = catalogue.policy.cancellation.days

/** The subscription terms as an in-app path, from the catalogue's public URL. */
export const TERMS_PATH: string = (() => {
	const url = new URL(catalogue.policy.terms_url)
	return `${url.pathname}${url.hash}`
})()

/** The shipped name for a locale, falling back to en-US. */
export function localizedName(names: LocalizedNames, locale: string): string {
	return names[locale] ?? names['en-US'] ?? Object.values(names)[0] ?? ''
}

/** The name the store goes by in a locale: the single-seat product's name. */
export function brandName(locale: string): string {
	const product = PRODUCTS.find((candidate) => !isFamilyProduct(candidate.id)) ?? PRODUCTS[0]
	return localizedName(product?.name ?? FREE.name, locale)
}

export function productById(id: string): Product | undefined {
	return catalogue.products.find((product) => product.id === id)
}

export function planById(id: string): Plan | undefined {
	return PLANS.find((plan) => plan.plan_id === id)
}

export function planByPriceKey(priceKey: string): Plan | undefined {
	return PLANS.find((plan) => plan.price_key === priceKey)
}

/** The value a price grants a feature, when it declares one. */
export function grantValue(plan: Plan, feature: string): string | undefined {
	return plan.grants[feature]
}

/** Does a price grant the named boolean feature? */
export function hasGrant(plan: Plan, feature: string): boolean {
	return plan.grants[feature] === 'true'
}

/** A plan that shares its access grants the `family` feature. */
export function isFamilyPlan(id: string): boolean {
	const plan = planById(id)
	return plan ? hasGrant(plan, 'family') : false
}

/** Does any price for this product share its access? */
export function isFamilyProduct(productId: string): boolean {
	return PLANS.some((plan) => plan.product === productId && hasGrant(plan, 'family'))
}

/** The price to show in a currency: what the catalogue publishes there, else USD. */
export function priceFor(
	unitAmounts: Record<string, number>,
	currency: string,
): { currency: string; amountMinor: number } | null {
	const wanted = currency.toLowerCase()
	const chosen = unitAmounts[wanted] !== undefined ? wanted : BASE_CURRENCY
	const amount = unitAmounts[chosen]
	return amount === undefined ? null : { currency: chosen, amountMinor: amount }
}

/** Currency shown for a locale: the catalogue's mapping, else its default. */
export function currencyForLocale(locale: string): string {
	const wanted = locale.toLowerCase()
	for (const [name, currency] of Object.entries(catalogue.currency_display.by_locale)) {
		if (name.toLowerCase() === wanted) return currency
	}
	return catalogue.currency_display.default
}

/** Plan cards in one currency, in catalogue order; a plan with no price is left out. */
export function planCards(currency: string): PlanCard[] {
	const cards: PlanCard[] = []
	for (const plan of PLANS) {
		const price = priceFor(plan.unit_amounts, currency)
		if (!price) continue
		cards.push({
			priceKey: plan.price_key,
			id: plan.plan_id,
			name: plan.name,
			product: plan.product,
			family: hasGrant(plan, 'family'),
			seats: planSeats(plan),
			interval: plan.interval === 'year' ? 'year' : 'month',
			currency: price.currency,
			amountMinor: price.amountMinor,
		})
	}
	return cards
}
