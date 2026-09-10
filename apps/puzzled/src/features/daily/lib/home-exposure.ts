/**
 * Bounded home exposure (presentation layer).
 *
 * The destination catalog is unbounded (115 modules); home must stay small
 * (`docs/north-star/CATALOG.md` §1: "Large catalog is capability; exposure
 * stays small."). This pure selector picks the bounded set the home hero may
 * render from the registered modules:
 *
 * - today's free-rotation module always leads, so the free ritual CTA is the
 *   first card and cannot be rotated away (free floor untouched);
 * - modules with a server-proved completion today stay visible, so returning
 *   players keep their progress in front of them;
 * - remaining slots rotate deterministically per product day key: stable
 *   within the day, different across days;
 * - unknown or unavailable completion status is never treated as completed
 *   (#130 semantics), so a failed read cannot mark a module done.
 *
 * Everything not exposed here stays reachable through the `/games` catalog.
 */

/** Maximum number of modules the home hero may show. */
export const HOME_EXPOSURE_LIMIT = 6

export type HomeExposureModule = {
	slug: string
	/** Registry sort key; deterministic tie-breaker for equal day scores. */
	sortOrder: number
}

export type HomeExposureCompletion = {
	hasCompleted: boolean
	/** False when the server could not prove this module's state. */
	statusAvailable: boolean
}

export type HomeExposureInput = {
	/** Registered modules, e.g. `getAllGameMetadata()` mapped to slug + sortOrder. */
	modules: readonly HomeExposureModule[]
	/** Free-rotation slug for the product day. */
	freeGameSlug: string
	/** Server-proved per-module completion state (missing entry = not proved). */
	completions: Readonly<Record<string, HomeExposureCompletion | undefined>>
	/** Product day key (`YYYY-MM-DD`, Asia/Hong_Kong) seeding the fill order. */
	dayKey: string
	/** Upper bound on exposure. Values below 1 expose nothing. */
	limit: number
}

export type HomeExposure = {
	/** Bounded, duplicate-free slugs: free module first, then proved completions, then day fill. */
	slugs: string[]
	/** Registered modules not shown on home; they stay reachable on /games. */
	hiddenCount: number
}

/**
 * FNV-1a over `dayKey:slug`. Stable across runs and platforms, and the dayKey
 * input makes the fill order change with the product day.
 */
function dayScore(dayKey: string, slug: string): number {
	let hash = 0x811c9dc5
	const value = `${dayKey}:${slug}`
	for (let index = 0; index < value.length; index += 1) {
		hash ^= value.charCodeAt(index)
		hash = Math.imul(hash, 0x01000193)
	}
	return hash >>> 0
}

/**
 * True only when the server proved today's finish. A missing entry, an
 * unavailable read, or a claimed-but-unproved completion all fail closed.
 */
export function isServerProvedCompletion(completion: HomeExposureCompletion | undefined): boolean {
	return completion?.statusAvailable === true && completion.hasCompleted === true
}

/**
 * Deterministic bounded home exposure for the given product day.
 */
export function deriveHomeExposure(input: HomeExposureInput): HomeExposure {
	// A non-finite limit fails closed rather than exposing the whole catalog.
	const limit = Number.isFinite(input.limit) ? Math.max(0, Math.floor(input.limit)) : 0

	// First registration wins for a duplicated slug, keeping output duplicate-free.
	const modules: HomeExposureModule[] = []
	const moduleSlugs = new Set<string>()
	for (const module of input.modules) {
		if (moduleSlugs.has(module.slug)) continue
		moduleSlugs.add(module.slug)
		modules.push(module)
	}

	const slugs: string[] = []
	const selected = new Set<string>()
	const push = (slug: string) => {
		if (slugs.length >= limit || selected.has(slug)) return
		selected.add(slug)
		slugs.push(slug)
	}

	// 1. Today's free ritual always leads when it is a registered module.
	if (moduleSlugs.has(input.freeGameSlug)) {
		push(input.freeGameSlug)
	}

	// 2. Server-proved completions (free module already placed first).
	const completed = modules
		.filter(
			(module) =>
				module.slug !== input.freeGameSlug &&
				isServerProvedCompletion(input.completions[module.slug]),
		)
		.sort((a, b) => a.sortOrder - b.sortOrder || a.slug.localeCompare(b.slug))
	for (const module of completed) {
		push(module.slug)
	}

	// 3. Remaining slots: deterministic per product day, stable tie-break.
	const remaining = modules
		.filter((module) => !selected.has(module.slug))
		.sort(
			(a, b) =>
				dayScore(input.dayKey, a.slug) - dayScore(input.dayKey, b.slug) ||
				a.sortOrder - b.sortOrder ||
				a.slug.localeCompare(b.slug),
		)
	for (const module of remaining) {
		push(module.slug)
	}

	return {
		slugs,
		hiddenCount: modules.length - slugs.length,
	}
}
