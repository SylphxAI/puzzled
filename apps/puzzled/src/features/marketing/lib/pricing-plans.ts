/**
 * Price presentation helpers for the pricing surface.
 *
 * Pure functions over the billing authority's `Plan` payload: they select the
 * price for each interval, derive the annual saving, and format minor units.
 * Nothing here invents a number — a missing price stays `null` and the card
 * renders the "shown at checkout" state instead.
 */

export type PaidPlan = {
	slug: string
	monthlyPrice?: number
	annualPrice?: number
}

export type SelectedPlans = {
	monthly: PaidPlan | null
	annual: PaidPlan | null
	/** True when both intervals come from the same price code. */
	comparable: boolean
}

/**
 * Pick the authoritative price for each billing interval.

 * The commerce price list is grouped by price code, so monthly and annual can
 * arrive on one plan or on two. Two price codes are two products: comparing
 * them would produce a saving that means nothing, so `comparable` is false.
 */
export function selectPaidPlans(plans: readonly PaidPlan[]): SelectedPlans {
	const paid = plans.filter((plan) => plan.slug !== 'free')
	const monthly = paid.find((plan) => (plan.monthlyPrice ?? 0) > 0) ?? null
	const separateAnnual =
		paid.find((plan) => (plan.annualPrice ?? 0) > 0 && plan.slug !== monthly?.slug) ?? null
	const annual = separateAnnual ?? (monthly && (monthly.annualPrice ?? 0) > 0 ? monthly : null)

	return {
		monthly,
		annual,
		comparable: Boolean(monthly && annual && monthly.slug === annual.slug),
	}
}

/**
 * Annual saving against paying monthly for twelve months, in whole percent.
 *
 * Returns null when the two prices cannot be compared or when the year does
 * not actually cost less — a "save 0%" badge is noise, and a negative saving
 * would be a false claim. The percent is rounded down, so a badge never claims
 * more of a saving than the two authoritative prices really contain.
 */
export function annualSavingsPercent(
	monthlyMinor: number | null | undefined,
	annualMinor: number | null | undefined,
	comparable: boolean,
): number | null {
	if (!comparable || !monthlyMinor || !annualMinor) return null
	const percent = Math.floor((1 - annualMinor / (monthlyMinor * 12)) * 100)
	return percent > 0 ? percent : null
}

/**
 * Minor units to a displayed amount.
 *
 * The commerce peel hands over integer minor units and drops the currency, so
 * the amount is formatted in the currency the app bills in and the result
 * always carries the currency symbol — never a bare number.
 */
export function formatAmount(minorUnits: number, locale: string): string {
	return new Intl.NumberFormat(locale, {
		style: 'currency',
		currency: 'USD',
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	}).format(minorUnits / 100)
}
