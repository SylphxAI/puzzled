/**
 * Field Core Web Vitals: LCP, INP, CLS and TTFB from real visitors, reported
 * as a `web_vitals` GA4 event through the consent-gated Google tag. Analytics
 * consent only (never marketing), sampled at 10% per page load, and each event
 * carries the route template, the metric name, its rating and its value. No
 * address, id, query or user data leaves the page.
 */

export const VITALS_SAMPLE_RATE = 0.1

export type VitalName = 'LCP' | 'INP' | 'CLS' | 'TTFB'
export type VitalRating = 'good' | 'needs-improvement' | 'poor'

const LOCALE_PREFIX = /^\/(en-GB|zh-HK|zh-CN|zh-TW)(?=\/|$)/
const STATIC_ROUTES = new Set([
	'/',
	'/daily',
	'/games',
	'/archive',
	'/leaderboard',
	'/stats',
	'/profile',
	'/pricing',
	'/privacy',
	'/terms',
	'/support',
	'/login',
	'/signup',
	'/forgot-password',
	'/reset-password',
	'/verify-email',
	'/unsubscribe',
	'/challenge',
	'/family/join',
	'/settings',
	'/settings/preferences',
	'/settings/subscription',
	'/settings/privacy',
	'/settings/notifications',
	'/settings/account',
	'/settings/security',
	'/settings/profile',
])

/**
 * The route template for a path: locale removed, a game slug shown as
 * `[slug]`, anything not a known page (admin, share links, unknown) as
 * `other`. The result is from a fixed set, so it can never carry an id.
 */
export function routeTemplate(pathname: string): string {
	const stripped = pathname.replace(LOCALE_PREFIX, '') || '/'
	const path = stripped.length > 1 ? stripped.replace(/\/+$/, '') : stripped
	if (STATIC_ROUTES.has(path)) return path
	if (/^\/games\/[^/]+$/.test(path)) return '/games/[slug]'
	return 'other'
}

/** One sampling decision per page load. `random` is injectable for tests. */
export function sampled(random: () => number = Math.random): boolean {
	return random() < VITALS_SAMPLE_RATE
}

/** The `web_vitals` event parameters for one finished metric. */
export function vitalParams(input: {
	pathname: string
	name: VitalName
	rating: VitalRating
	value: number
}): Record<string, unknown> {
	return {
		vital_route: routeTemplate(input.pathname),
		vital_name: input.name,
		vital_rating: input.rating,
		vital_value: Math.round(input.value * 1000) / 1000,
	}
}
