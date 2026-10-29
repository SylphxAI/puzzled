/**
 * One card for another of our own products, on the already-played view only.
 *
 * The free finish is what builds the habit, so the card is never part of that
 * screen: the already-played view is a later visit, after today's free game is
 * done. At most one card a product day (Asia/Hong_Kong, the same day the
 * puzzles use), chosen from the day so every player sees the same one and a
 * refresh cannot show a second. The link is public and carries no player data:
 * `utm_source=puzzled` says where the click came from, and the destination
 * keeps it only under its own recorded-consent rule.
 */

import { ordinal0FromDayKey } from '@/lib/product-day'

export type OwnProduct = {
	/** Stable id, also the `utm_campaign` on the link. */
	id: string
	/** Public home of the product. No player data is added to it. */
	url: string
}

/**
 * Products with a live public home a finished player can open today.
 * Puzzled is not in the list: the card points at our other products.
 * Cubeage titles are a separate company and are not linked from here.
 */
export const OWN_PRODUCTS: readonly OwnProduct[] = [
	{ id: 'tryit', url: 'https://tryit.fun' },
	{ id: 'luzzy', url: 'https://luzzy.chat' },
	{ id: 'viszy', url: 'https://viszy.ai' },
]

/** The one product for a product day, or null when there is nothing to show. */
export function productForDay(
	dayKey: string,
	products: readonly OwnProduct[] = OWN_PRODUCTS,
): OwnProduct | null {
	if (products.length === 0) return null
	const index = ordinal0FromDayKey(dayKey) % products.length
	return products[index] ?? null
}

/**
 * Public link for the card. Campaign tags only, so the destination can
 * attribute the click; nothing about the player is attached.
 */
export function productLink(product: OwnProduct): string {
	const url = new URL(product.url)
	url.searchParams.set('utm_source', 'puzzled')
	url.searchParams.set('utm_medium', 'referral')
	url.searchParams.set('utm_campaign', product.id)
	return url.toString()
}
