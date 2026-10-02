/**
 * Which currency the pricing page shows. Prices come only from the catalogue
 * (ListPlans); this module only chooses among the currencies it publishes.
 *
 * Order of choice: the visitor's own choice (cookie), then the country the
 * edge saw, then the region of the page locale, then US dollars.
 */

import type { ListPlansResponse } from '@/gen/connect/puzzled/v1/billing_pb'
import { currencyForLocale } from './plus'

/** Strictly necessary preference: remembers the currency the visitor picked. No identifier, never sent to analytics. */
export const CURRENCY_COOKIE = 'puzzled_currency'

/**
 * Country header set by the edge. puzzled.gg is served through Cloudflare
 * (`server: cloudflare`, `cf-ray` on every response), which adds `CF-IPCountry`
 * with the ISO 3166-1 alpha-2 code of the client (`XX` unknown, `T1` Tor).
 */
export const COUNTRY_HEADER = 'cf-ipcountry'

const MAX_AGE_SECONDS = 60 * 60 * 24 * 365

/** Countries whose visitors default to pounds: the UK and its Crown Dependencies. */
const GBP_COUNTRIES = new Set(['GB', 'GG', 'JE', 'IM'])

const CODE_PATTERN = /^[a-z]{3}$/

/** A currency code from a cookie or header, lower-cased, or null when malformed. */
export function normalizeCurrency(raw: string | null | undefined): string | null {
	const code = raw?.trim().toLowerCase()
	return code && CODE_PATTERN.test(code) ? code : null
}

/** Currencies every plan publishes, so one choice prices every card. Sorted, with US dollars and pounds first. */
export function availableCurrencies(plans: ListPlansResponse['plans']): string[] {
	if (plans.length === 0) return []
	const common = plans
		.map((plan) => new Set(plan.prices.map((p) => p.currency)))
		.reduce((acc, set) => new Set([...acc].filter((code) => set.has(code))))
	const rank = (code: string) => (code === 'gbp' ? 0 : code === 'usd' ? 1 : 2)
	return [...common].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
}

/** The default from where the visitor is: country first, then the locale region, else dollars. */
export function defaultCurrency(country: string | null | undefined, locale: string): string {
	const code = country?.trim().toUpperCase()
	if (code && /^[A-Z]{2}$/.test(code) && code !== 'XX' && code !== 'T1') {
		return GBP_COUNTRIES.has(code) ? 'gbp' : 'usd'
	}
	return currencyForLocale(locale)
}

/** The currency to show, always one of `available` (empty when nothing is published). */
export function chooseCurrency(input: {
	cookie: string | null | undefined
	country: string | null | undefined
	locale: string
	available: readonly string[]
}): string {
	const { available } = input
	const picked = normalizeCurrency(input.cookie)
	if (picked && available.includes(picked)) return picked
	const fallback = defaultCurrency(input.country, input.locale)
	if (available.includes(fallback)) return fallback
	if (available.includes('usd')) return 'usd'
	return available[0] ?? 'usd'
}

export function serializeCurrencyCookie(code: string, secure: boolean): string {
	return `${CURRENCY_COOKIE}=${code}; Path=/; Max-Age=${MAX_AGE_SECONDS}; SameSite=Lax${
		secure ? '; Secure' : ''
	}`
}
