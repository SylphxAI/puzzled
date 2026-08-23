/**
 * Inbound presentation aliases for catalog modules.
 *
 * Canonical play path is `/games/<slug>` (CUTOVER.md share/deep-link).
 * Short `/crowns` and `/duo` are inbound aliases, not a second product.
 */

export const INBOUND_MODULE_ALIASES = [
	{ source: '/crowns', destination: '/games/crowns' },
	{ source: '/duo', destination: '/games/duo' },
] as const

export function inboundModuleRedirects(): Array<{
	source: string
	destination: string
	permanent: true
}> {
	return INBOUND_MODULE_ALIASES.flatMap(({ source, destination }) => [
		{ source, destination, permanent: true },
		{
			source: `/:locale${source}`,
			destination: `/:locale${destination}`,
			permanent: true,
		},
	])
}

export function inboundModulePublicRoutes(locales: readonly string[]): string[] {
	return INBOUND_MODULE_ALIASES.flatMap(({ source }) => [
		source,
		...locales.map((locale) => `/${locale}${source}`),
	])
}
