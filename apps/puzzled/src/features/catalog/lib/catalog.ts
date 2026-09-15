/**
 * Catalog data mapping (presentation layer).
 *
 * The `/games` page lists the whole registered suite (home stays bounded).
 * This module maps registry metadata to the player-facing entry shape and
 * applies the optional title and category filters. It is pure: the page
 * resolves the i18n keys and reads today's free rotation and premium
 * entitlement.
 */

import type { GameMetadata } from '@/games/registry'
import type { GameColorTheme } from '@/games/theme-colors'
import type { GameCategory } from '@/games/types'
import { canonicalizeGameSlug, playerTitle, slugToCamelCase } from '@/lib/game-slug'

/** Categories the catalog filters by, in display order. */
export const CATALOG_CATEGORIES: readonly GameCategory[] = ['word', 'logic', 'math', 'spatial']

/** `all` keeps every category; every other value matches one registry category. */
export type CatalogCategoryFilter = GameCategory | 'all'

export type CatalogEntry = {
	/** Canonical registry slug (`/games/<slug>`). */
	slug: string
	/** next-intl key for the player title, e.g. `games.wordGuess.name`. */
	titleKey: string
	/** Canonical English player title (CATALOG SSOT); i18n fallback. */
	canonicalTitle: string
	/** next-intl key for the short tagline, e.g. `games.wordGuess.tagline`. */
	taglineKey: string
	/** next-intl key for the registry highlight, e.g. `games.wordGuess.highlight`. */
	highlightKey: string
	/** Estimated play time from registry display meta. */
	duration: string
	/** Registry colour theme; each tile renders in its own module colour. */
	theme: GameColorTheme
	/** Registry category, used by the catalog filter and related modules. */
	category: GameCategory
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
			highlightKey: module.display.highlightKey,
			duration: module.display.duration,
			theme: module.display.theme,
			category: module.category,
			freeToday,
			locked: !input.isPremium && !freeToday,
		}
	})
}

/**
 * Optional `q` (player title) and `category` filters. Empty filters return the
 * full list in registry order; title matching is case-insensitive and trimmed.
 */
export function filterCatalogEntries<T extends { title: string; category: GameCategory }>(
	entries: readonly T[],
	filters: { query?: string; category?: CatalogCategoryFilter },
): T[] {
	const needle = (filters.query ?? '').trim().toLowerCase()
	const category = filters.category ?? 'all'

	return entries.filter((entry) => {
		if (category !== 'all' && entry.category !== category) return false
		if (!needle) return true
		return entry.title.toLowerCase().includes(needle)
	})
}

/**
 * Read the `category` query parameter. Unknown or repeated values fall back to
 * the unfiltered catalog instead of rendering an empty grid.
 */
export function parseCatalogCategory(value: string | string[] | undefined): CatalogCategoryFilter {
	const raw = Array.isArray(value) ? value[0] : value
	if (!raw) return 'all'
	return CATALOG_CATEGORIES.includes(raw as GameCategory) ? (raw as GameCategory) : 'all'
}

/**
 * Related modules for a game page: same-category modules first (registry
 * order), then the remaining suite in registry order. The current module is
 * never its own related link.
 */
export function relatedCatalogSlugs(input: {
	slug: string
	modules: readonly GameMetadata[]
	limit?: number
}): string[] {
	const limit = input.limit ?? 3
	const others = input.modules.filter((module) => module.slug !== input.slug)
	const current = input.modules.find((module) => module.slug === input.slug)
	const sameCategory = current ? others.filter((m) => m.category === current.category) : []
	const rest = others.filter((module) => !sameCategory.includes(module))

	return [...sameCategory, ...rest].slice(0, limit).map((module) => module.slug)
}

type MessageReader = {
	(key: string): string
	has(key: string): boolean
}

/**
 * Resolve a message with an explicit fallback.
 *
 * next-intl ignores `defaultValue` and renders the dotted key path when a
 * message is missing, so registry copy has to be applied here instead.
 */
export function readMessage(reader: MessageReader, key: string, fallback: string): string {
	return reader.has(key) ? reader(key) : fallback
}
