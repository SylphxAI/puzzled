import { formatPrice, minorUnitsToMajor } from '@/lib/billing/plus'
import catalogue from '../../../../../../config/commercial/catalogue.json'

/**
 * List prices quoted in public marketing copy (use cases, comparisons,
 * llms.txt), read from the catalogue that CI applies to Money. Copy never
 * carries a second price list, so a price change reaches every page at once.
 */
export type ListedPriceKey =
	| 'puzzled_starter_unlock'
	| 'plus_individual_monthly'
	| 'plus_individual_yearly'
	| 'plus_family_monthly'
	| 'plus_family_yearly'

export type ListedCurrency = 'usd' | 'gbp'

/** Catalogue amount in minor units (cents, pence), VAT included. */
export function listPriceMinor(key: ListedPriceKey, currency: ListedCurrency = 'usd'): number {
	const plan = catalogue.plans.find((entry) => entry.price_key === key)
	const amount = plan?.unit_amounts[currency]
	if (amount === undefined) throw new Error(`catalogue has no ${currency} price for ${key}`)
	return amount
}

/** Minor units as written in English copy, e.g. `$4.99` or `£3.99`. */
export function formatListPrice(amountMinor: number, currency: ListedCurrency = 'usd'): string {
	return formatPrice(amountMinor, currency, 'en-US')
}

/** VAT-inclusive list price as written in English copy, e.g. `$4.99` or `£3.99`. */
export function listPrice(key: ListedPriceKey, currency: ListedCurrency = 'usd'): string {
	return formatListPrice(listPriceMinor(key, currency), currency)
}

/** The same price as a schema.org `Offer.price` string, e.g. `4.99`. */
export function offerPrice(key: ListedPriceKey, currency: ListedCurrency = 'usd'): string {
	return minorUnitsToMajor(listPriceMinor(key, currency), currency).toFixed(2)
}

/** People one family plan covers, the plan owner included. */
export const FAMILY_SEATS = Number(
	catalogue.plans.find((entry) => entry.price_key === 'plus_family_monthly')?.grants.seats,
)
