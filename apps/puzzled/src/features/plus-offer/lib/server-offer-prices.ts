import { cookies, headers } from 'next/headers'
import { getServerPlans } from '@/lib/api/server'
import {
	availableCurrencies,
	COUNTRY_HEADER,
	CURRENCY_COOKIE,
	chooseCurrency,
} from '@/lib/billing/currency'
import { planCards } from '@/lib/billing/plus'
import { withPresentationDeadline } from '@/lib/presentation-document'
import { type OfferPriceSummary, selectOfferPrices } from './plus-offer'

/**
 * Live Individual yearly Plus + 3-Day Pass prices in the visitor's currency,
 * matching `/pricing`. Returns an empty summary when the catalogue is unreadable
 * or sales are closed, so surfaces degrade cleanly without fabricating prices.
 */
export async function getServerOfferPrices(locale: string): Promise<OfferPriceSummary> {
	const plans = await withPresentationDeadline(getServerPlans(), null)
	if (!plans?.salesOpen) return {}
	const [cookieStore, requestHeaders] = await Promise.all([cookies(), headers()])
	const currency = chooseCurrency({
		cookie: cookieStore.get(CURRENCY_COOKIE)?.value,
		country: requestHeaders.get(COUNTRY_HEADER),
		locale,
		available: availableCurrencies(plans.plans),
	})
	return selectOfferPrices(planCards(plans.plans, currency), currency, locale)
}
