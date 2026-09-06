/**
 * Inbound presentation aliases for catalog modules.
 *
 * Canonical play path is `/games/<slug>` (CUTOVER.md share/deep-link).
 * Short `/crowns` and `/duo` are inbound aliases, not a second product.
 *
 * Locale prefixes are enumerated (both BCP-47 and lowercase). A `/:locale`
 * glob treats `games` as a locale, so `/games/crowns` 308s to
 * `/games/games/crowns` (404).
 */

import { locales } from './i18n/config'

export const INBOUND_MODULE_ALIASES = [
	{ source: '/crowns', destination: '/games/crowns' },
	{ source: '/duo', destination: '/games/duo' },
] as const

function localePrefixVariants(codes: readonly string[]): string[] {
	const prefixes: string[] = []
	for (const locale of codes) {
		if (!prefixes.includes(locale)) {
			prefixes.push(locale)
		}
		const lower = locale.toLowerCase()
		if (!prefixes.includes(lower)) {
			prefixes.push(lower)
		}
	}
	return prefixes
}

export function inboundModuleRedirects(): Array<{
	source: string
	destination: string
	permanent: true
}> {
	const prefixes = localePrefixVariants(locales)
	return INBOUND_MODULE_ALIASES.flatMap(({ source, destination }) => [
		{ source, destination, permanent: true },
		...prefixes.map((locale) => ({
			source: `/${locale}${source}`,
			destination: `/${locale}${destination}`,
			permanent: true as const,
		})),
	])
}

export function inboundModulePublicRoutes(locales: readonly string[]): string[] {
	return INBOUND_MODULE_ALIASES.flatMap(({ source }) => [
		source,
		...localePrefixVariants(locales).map((locale) => `/${locale}${source}`),
	])
}
