/**
 * The products Tryit has a comparison page for, in page order. `/vs/<slug>`
 * exists for exactly these slugs: the dynamic route, the sitemap, the footer
 * and the `/vs` hub all read this list, and `COMPARISON_SPECS` must hold one
 * spec per slug (checked by the compiler).
 *
 * Kept import-free so the route table and the footer can read it without
 * loading the comparison copy.
 */
export const COMPARISON_SLUGS = [
	'nyt-games',
	'lumosity',
	'linkedin-games',
	'elevate',
	'puzzmo',
	'brilliant',
	'wordle',
] as const

export type ComparisonSlug = (typeof COMPARISON_SLUGS)[number]

/** Narrows a route param to a known comparison slug. */
export function isComparisonSlug(value: string): value is ComparisonSlug {
	return (COMPARISON_SLUGS as readonly string[]).includes(value)
}

/** The hub that lists every comparison. */
export const COMPARISON_HUB_PATH = '/vs'
