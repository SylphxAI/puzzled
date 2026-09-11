import { describe, expect, test } from 'bun:test'
import { buildCatalogEntries } from '@/features/catalog/lib/catalog'
import { getAllGameMetadata } from '@/games/registry'
import {
	deriveHomeExposure,
	HOME_EXPOSURE_LIMIT,
	type HomeExposureCompletion,
	type HomeExposureModule,
	isServerProvedCompletion,
} from './home-exposure'

const freeSlug = 'module-01'

function catalogOf(size: number): HomeExposureModule[] {
	return Array.from({ length: size }, (_, index) => ({
		slug: `module-${String(index + 1).padStart(2, '0')}`,
		sortOrder: index + 1,
	}))
}

const proved: HomeExposureCompletion = { hasCompleted: true, statusAvailable: true }
const notCompleted: HomeExposureCompletion = { hasCompleted: false, statusAvailable: true }
const unverified: HomeExposureCompletion = { hasCompleted: false, statusAvailable: false }
const unverifiedClaim: HomeExposureCompletion = { hasCompleted: true, statusAvailable: false }

describe('deriveHomeExposure', () => {
	test('only a server-proved completion counts', () => {
		expect(isServerProvedCompletion(undefined)).toBe(false)
		expect(isServerProvedCompletion(unverifiedClaim)).toBe(false)
		expect(isServerProvedCompletion(unverified)).toBe(false)
		expect(isServerProvedCompletion(notCompleted)).toBe(false)
		expect(isServerProvedCompletion(proved)).toBe(true)
	})

	test('is bounded by the limit and never duplicates a module', () => {
		const exposure = deriveHomeExposure({
			modules: catalogOf(12),
			freeGameSlug: freeSlug,
			completions: {},
			dayKey: '2026-09-10',
			limit: 6,
		})

		expect(exposure.slugs).toHaveLength(6)
		expect(new Set(exposure.slugs).size).toBe(6)
		for (const slug of exposure.slugs) {
			expect(slug.startsWith('module-')).toBe(true)
		}
	})

	test("always leads with today's free module, whatever the day", () => {
		for (let day = 1; day <= 28; day += 1) {
			const exposure = deriveHomeExposure({
				modules: catalogOf(12),
				freeGameSlug: freeSlug,
				completions: {},
				dayKey: `2026-09-${String(day).padStart(2, '0')}`,
				limit: 3,
			})

			expect(exposure.slugs[0]).toBe(freeSlug)
		}
	})

	test('includes server-proved completions when the day fill would not', () => {
		// 12 modules, limit 2: the second slot belongs to the proved completion
		// even though the day rotation ranks other modules first
		// (2026-01-01 fill order starts module-08, module-09, ... for these slugs).
		const exposure = deriveHomeExposure({
			modules: catalogOf(12),
			freeGameSlug: freeSlug,
			completions: { 'module-07': proved },
			dayKey: '2026-01-01',
			limit: 2,
		})

		expect(exposure.slugs).toEqual([freeSlug, 'module-07'])
	})

	test('fills the cap with the lowest-sortOrder proved completions and drops the surplus', () => {
		// More proved completions than non-free slots: `sortOrder` decides which
		// ones stay on home. The surplus must not displace lower-sortOrder ones.
		const exposure = deriveHomeExposure({
			modules: catalogOf(12),
			freeGameSlug: freeSlug,
			completions: {
				'module-07': proved,
				'module-03': proved,
				'module-05': proved,
				'module-02': proved,
			},
			dayKey: '2026-09-10',
			limit: 4,
		})

		expect(exposure.slugs).toEqual([freeSlug, 'module-02', 'module-03', 'module-05'])
		expect(exposure.slugs).not.toContain('module-07')
	})

	test('keeps surplus proved completions reachable on /games', () => {
		const registry = getAllGameMetadata()
		const modules = registry.map((game) => ({ slug: game.slug, sortOrder: game.sortOrder }))
		// 8 proved completions for 6 home slots (reviewer probe, 2026-09-11).
		const provedSlugs = [
			'word-guess',
			'word-groups',
			'word-hive',
			'crossword',
			'sudoku',
			'nonogram',
			'word-ladder',
			'arithmo',
		]
		const completions = Object.fromEntries(provedSlugs.map((slug) => [slug, proved]))

		const exposure = deriveHomeExposure({
			modules,
			freeGameSlug: 'sudoku',
			completions,
			dayKey: '2026-09-11',
			limit: HOME_EXPOSURE_LIMIT,
		})

		// The two highest-sortOrder completions are over the cap...
		expect(exposure.slugs).toEqual([
			'sudoku',
			'word-guess',
			'word-groups',
			'word-hive',
			'crossword',
			'nonogram',
		])
		// ...but the whole registry, surplus included, stays listed on /games.
		const catalogSlugs = buildCatalogEntries({
			modules: registry,
			freeGameSlug: 'sudoku',
			isPremium: true,
		}).map((entry) => entry.slug)
		for (const slug of ['word-ladder', 'arithmo']) {
			expect(exposure.slugs).not.toContain(slug)
			expect(catalogSlugs).toContain(slug)
		}
	})

	test('never treats unknown or unavailable status as completed', () => {
		const exposure = deriveHomeExposure({
			modules: catalogOf(12),
			freeGameSlug: freeSlug,
			completions: {
				// Claimed completion without server proof must not enter as progress.
				'module-07': unverifiedClaim,
				'module-08': proved,
			},
			dayKey: '2026-01-01',
			limit: 2,
		})

		expect(exposure.slugs).toEqual([freeSlug, 'module-08'])
		expect(exposure.slugs).not.toContain('module-07')
	})

	test('keeps the free module in front even when its status is unverified', () => {
		const exposure = deriveHomeExposure({
			modules: catalogOf(12),
			freeGameSlug: freeSlug,
			completions: { [freeSlug]: unverifiedClaim },
			dayKey: '2026-09-10',
			limit: 3,
		})

		expect(exposure.slugs[0]).toBe(freeSlug)
		expect(new Set(exposure.slugs).size).toBe(3)
	})

	test('does not duplicate a completed free module', () => {
		const exposure = deriveHomeExposure({
			modules: catalogOf(12),
			freeGameSlug: freeSlug,
			completions: { [freeSlug]: proved, 'module-04': proved },
			dayKey: '2026-09-10',
			limit: 2,
		})

		expect(exposure.slugs).toEqual([freeSlug, 'module-04'])
	})

	test('is stable within a product day', () => {
		const run = () =>
			deriveHomeExposure({
				modules: catalogOf(12),
				freeGameSlug: freeSlug,
				completions: { 'module-05': proved },
				dayKey: '2026-09-10',
				limit: 5,
			}).slugs

		expect(run()).toEqual(run())
	})

	test('varies across product days', () => {
		const orders = new Set<string>()
		for (let day = 1; day <= 28; day += 1) {
			const exposure = deriveHomeExposure({
				modules: catalogOf(12),
				freeGameSlug: freeSlug,
				completions: {},
				dayKey: `2026-09-${String(day).padStart(2, '0')}`,
				limit: 5,
			})
			orders.add(exposure.slugs.join(','))
		}

		expect(orders.size).toBeGreaterThan(1)
	})

	test('shows the whole catalog when it is smaller than the limit', () => {
		const modules = catalogOf(4)
		const exposure = deriveHomeExposure({
			modules,
			freeGameSlug: 'module-03',
			completions: {},
			dayKey: '2026-09-10',
			limit: 10,
		})

		expect(exposure.slugs).toHaveLength(modules.length)
		expect(new Set(exposure.slugs)).toEqual(new Set(modules.map((module) => module.slug)))
	})

	test('exposes nothing when the limit is not positive', () => {
		const exposure = deriveHomeExposure({
			modules: catalogOf(12),
			freeGameSlug: freeSlug,
			completions: {},
			dayKey: '2026-09-10',
			limit: 0,
		})

		expect(exposure.slugs).toEqual([])
	})

	test('fails closed for a non-finite limit', () => {
		const exposure = deriveHomeExposure({
			modules: catalogOf(12),
			freeGameSlug: freeSlug,
			completions: {},
			dayKey: '2026-09-10',
			limit: Number.NaN,
		})

		expect(exposure.slugs).toEqual([])
	})

	test('deduplicates repeated registrations', () => {
		const exposure = deriveHomeExposure({
			modules: [...catalogOf(3), catalogOf(3)[0]],
			freeGameSlug: freeSlug,
			completions: {},
			dayKey: '2026-09-10',
			limit: 10,
		})

		expect(exposure.slugs).toEqual(['module-01', 'module-02', 'module-03'])
	})

	test('ignores a free-rotation slug that is not a registered module', () => {
		const exposure = deriveHomeExposure({
			modules: catalogOf(3),
			freeGameSlug: 'not-registered',
			completions: {},
			dayKey: '2026-09-10',
			limit: 2,
		})

		expect(exposure.slugs).toHaveLength(2)
		expect(exposure.slugs).not.toContain('not-registered')
	})

	test('bounds the shipped registry below the full catalog', () => {
		const modules = getAllGameMetadata().map((game) => ({
			slug: game.slug,
			sortOrder: game.sortOrder,
		}))
		expect(modules.length).toBeGreaterThan(HOME_EXPOSURE_LIMIT)

		const exposure = deriveHomeExposure({
			modules,
			freeGameSlug: 'sudoku',
			completions: { 'word-guess': proved },
			dayKey: '2026-09-10',
			limit: HOME_EXPOSURE_LIMIT,
		})

		expect(exposure.slugs).toHaveLength(HOME_EXPOSURE_LIMIT)
		expect(new Set(exposure.slugs).size).toBe(HOME_EXPOSURE_LIMIT)
		expect(exposure.slugs[0]).toBe('sudoku')
		expect(exposure.slugs).toContain('word-guess')
	})
})
