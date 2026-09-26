/**
 * Puzzled Plus presentation rules. The Rust api decides access (Connect
 * `PuzzleService` refuses with `plus_required` / `plus_required_archive`);
 * these helpers only choose what the page shows, from the same facts.
 */

import type {
	GetSubscriptionResponse,
	ListPlansResponse,
} from '@/gen/connect/puzzled/v1/billing_pb'

/** What a page needs to know about the viewer and the store. */
export type PlusAccess = {
	/** Puzzled Plus is on sale. False: nothing is sold and nothing is locked. */
	salesOpen: boolean
	/** The viewer may play every game and the archive. */
	entitled: boolean
}

export const OPEN_ACCESS: PlusAccess = { salesOpen: false, entitled: false }

/** Is this game or day locked for the viewer? Mirrors `billing_access::policy::play_access`. */
export function isPlayLocked(
	access: PlusAccess,
	input: { slug: string; freeSlug: string; archive: boolean },
): boolean {
	if (!access.salesOpen || access.entitled) return false
	if (input.archive) return true
	return input.slug !== input.freeSlug
}

/** Connect error messages that mean "Puzzled Plus needed". */
export function isPlusRequiredError(message: string | undefined | null): boolean {
	return Boolean(message && /plus_required/.test(message))
}

export type PlanId = 'individual_monthly' | 'individual_yearly' | 'family_monthly' | 'family_yearly'

/** Currency shown for a locale: pounds for en-GB, US dollars otherwise. */
export function currencyForLocale(locale: string): 'gbp' | 'usd' {
	return locale.toLowerCase() === 'en-gb' ? 'gbp' : 'usd'
}

export type PlanCard = {
	id: PlanId
	family: boolean
	interval: 'month' | 'year'
	currency: string
	/** Minor units, tax included. */
	amountMinor: number
}

/** Plan cards in one currency; a plan without a price in it is left out. */
export function planCards(plans: ListPlansResponse['plans'], currency: string): PlanCard[] {
	const cards: PlanCard[] = []
	for (const plan of plans) {
		const price =
			plan.prices.find((p) => p.currency === currency) ??
			plan.prices.find((p) => p.currency === 'usd')
		if (!price) continue
		cards.push({
			id: plan.id as PlanId,
			family: plan.family,
			interval: plan.interval === 'year' ? 'year' : 'month',
			currency: price.currency,
			amountMinor: Number(price.unitAmountMinor),
		})
	}
	return cards
}

/** Format minor units as a price in the viewer's locale. */
export function formatPrice(amountMinor: number, currency: string, locale: string): string {
	return new Intl.NumberFormat(locale, {
		style: 'currency',
		currency: currency.toUpperCase(),
	}).format(amountMinor / 100)
}

/** Whole-number saving of a yearly price against twelve monthly payments. */
export function yearlySavingPercent(monthlyMinor: number, yearlyMinor: number): number | null {
	if (monthlyMinor <= 0 || yearlyMinor <= 0) return null
	const saving = Math.round((1 - yearlyMinor / (monthlyMinor * 12)) * 100)
	return saving > 0 ? saving : null
}

/** A stable view of GetSubscription for the settings page. */
export type SubscriptionView = {
	salesOpen: boolean
	entitled: boolean
	source: 'none' | 'plus' | 'family'
	planId: PlanId | null
	status: string | null
	periodEndMs: number | null
	cancelAtPeriodEnd: boolean
	refundUntilMs: number | null
	family: {
		role: 'owner' | 'member'
		inviteCode: string | null
		maxMembers: number
		members: { userId: string; displayName: string; owner: boolean }[]
	} | null
}

export function subscriptionView(res: GetSubscriptionResponse): SubscriptionView {
	const source = res.source === 'plus' || res.source === 'family' ? res.source : 'none'
	return {
		salesOpen: res.salesOpen,
		entitled: res.entitled,
		source,
		// Unset optional fields read as their zero value.
		planId: (res.planId || null) as PlanId | null,
		status: res.status || null,
		periodEndMs: Number(res.currentPeriodEndMs) || null,
		cancelAtPeriodEnd: res.cancelAtPeriodEnd,
		refundUntilMs: Number(res.refundUntilMs) || null,
		family: res.family
			? {
					role: res.family.role === 'owner' ? 'owner' : 'member',
					inviteCode: res.family.inviteCode || null,
					maxMembers: res.family.maxMembers,
					members: res.family.members.map((m) => ({
						userId: m.userId,
						displayName: m.displayName,
						owner: m.owner,
					})),
				}
			: null,
	}
}
