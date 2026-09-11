/**
 * Catalog data mapping (presentation layer).
 *
 * The `/games` page lists the whole registered suite (home stays bounded).
 * This module maps registry metadata to the player-facing entry shape and
 * applies the optional `q` title filter. It is pure: the page resolves the
 * i18n keys and reads today's free rotation and premium entitlement.
 */

import type { GameMetadata } from '@/games/registry'
import { canonicalizeGameSlug, playerTitle, slugToCamelCase } from '@/lib/game-slug'

export type CatalogEntry = {
	/** Canonical registry slug (`/games/<slug>`). */
	slug: string
	/** next-intl key for the player title, e.g. `games.wordGuess.name`. */
	titleKey: string
	/** Canonical English player title (CATALOG SSOT); i18n fallback. */
	canonicalTitle: string
	/** next-intl key for the short tagline, e.g. `games.wordGuess.tagline`. */
	taglineKey: string
	/** Estimated play time from registry display meta. */
	duration: string
	/** Today's free-rotation module: playable without premium. */
	freeToday: boolean
	/** Premium gate for this viewer today (false for premium viewers + free module). */
	locked: boolean
}

/**
 * Map the registered modules to catalog entries. Input order is preserved
 * (the registry returns games sorted by sortOrder).
 */
export function buildCatalogEntries(input: {
	modules: readonly GameMetadata[]
	/** Free-rotation slug for the product day. */
	freeGameSlug: string
	/** Viewer's premium entitlement; false when it could not be proved. */
	isPremium: boolean
}): CatalogEntry[] {
	const freeSlug = canonicalizeGameSlug(input.freeGameSlug)

	return input.modules.map((module) => {
		const translationSlug = slugToCamelCase(module.slug)
		const freeToday = module.slug === freeSlug

		return {
			slug: module.slug,
			titleKey: `games.${translationSlug}.name`,
			canonicalTitle: playerTitle(module.slug),
			taglineKey: `games.${translationSlug}.tagline`,
			duration: module.display.duration,
			freeToday,
			locked: !input.isPremium && !freeToday,
		}
	})
}

/**
 * Optional `q` filter by player title. Empty query returns the full list in
 * registry order; matching is case-insensitive on the rendered title.
 */
export function filterCatalogEntries<T extends { title: string }>(
	entries: readonly T[],
	query: string,
): T[] {
	const needle = query.trim().toLowerCase()
	if (!needle) return [...entries]
	return entries.filter((entry) => entry.title.toLowerCase().includes(needle))
}
