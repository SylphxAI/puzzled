/**
 * Commercial catalogue guard.
 *
 * Regression this exists for: a price lived in three places (the pricing page,
 * the Rust billing constants and the Stripe setup script), so changing a price
 * meant finding all three, and the page could show one amount while checkout
 * charged another. The catalogue (`config/commercial/catalogue.json`) is now
 * the one authored place; the page renders from it, the api embeds it, and the
 * setup script publishes it.
 *
 * The guard therefore checks three things:
 * 1. the catalogue is complete and consistent (products, plans, price keys,
 *    amounts, features, policy, seats);
 * 2. the page's prices and names are the catalogue's (and the one copy still
 *    in i18n, the console's plan names, agrees with it until cutover);
 * 3. no price literal is written anywhere else in shipped code — neither a
 *    formatted amount ("$4.99") nor the catalogue's minor-unit amounts.
 */

import { describe, expect, test } from 'bun:test'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import {
	brandName,
	CANCELLATION_DAYS,
	currencyForLocale,
	FAMILY_MAX_MEMBERS,
	FEATURES,
	FREE,
	grantValue,
	hasGrant,
	isFamilyProduct,
	localizedName,
	PLANS,
	POLICY,
	PRODUCTS,
	planById,
	planCards,
	planSeats,
	priceFor,
	TERMS_PATH,
} from './catalogue'
import { formatPrice } from './plus'

const CATALOGUE_PATH = 'config/commercial/catalogue.json'
const LOCALES = ['en-US', 'zh-HK', 'zh-CN']
const SCAN_ROOTS = ['apps/puzzled/src', 'packages/ui/src', 'proto', 'scripts']
/** Generated code, build output and dependencies are not shipped source. */
const SKIP_DIRS = new Set(['node_modules', '.next', 'gen', 'dist', 'coverage'])
const TEST_FILE = /\.test\.(ts|tsx|mts)$/
const SOURCE_FILE = /\.(ts|tsx|mts|json|proto|css)$/

function findRepoRoot(start: string): string {
	let dir = start
	for (;;) {
		if (existsSync(join(dir, CATALOGUE_PATH))) return dir
		const parent = dirname(dir)
		if (parent === dir) throw new Error(`catalogue guard: repo root not found from ${start}`)
		dir = parent
	}
}

const root = findRepoRoot(import.meta.dir)

function sourceFiles(dir: string): string[] {
	const found: string[] = []
	for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
		const path = `${dir}/${entry.name}`
		if (entry.isDirectory()) {
			if (!SKIP_DIRS.has(entry.name)) found.push(...sourceFiles(path))
			continue
		}
		if (SOURCE_FILE.test(entry.name) && !TEST_FILE.test(entry.name)) found.push(path)
	}
	return found
}

function read(path: string): string {
	return readFileSync(join(root, path), 'utf8')
}

/** The dotted i18n key resolved to its shipped string, or undefined. */
function message(path: string, key: string): string | undefined {
	let node: unknown = JSON.parse(read(path))
	for (const part of key.split('.')) {
		if (typeof node !== 'object' || node === null) return undefined
		node = (node as Record<string, unknown>)[part]
	}
	return typeof node === 'string' ? node : undefined
}

describe('commercial catalogue', () => {
	test('every plan names a product, a price key, an interval and both currencies', () => {
		expect(PLANS.length).toBe(4)
		expect(new Set(PLANS.map((plan) => plan.plan_id)).size).toBe(PLANS.length)
		expect(new Set(PLANS.map((plan) => plan.price_key)).size).toBe(PLANS.length)
		for (const plan of PLANS) {
			// Money's price key and today's Stripe lookup key both derive from
			// the plan id, so a rename cannot leave one of them behind.
			expect(plan.price_key).toBe(`plus_${plan.plan_id}`)
			expect(plan.provider_lookup_key).toBe(`puzzled_${plan.plan_id}`)
			expect(PRODUCTS.map((product) => product.id)).toContain(plan.product)
			expect(['month', 'year']).toContain(plan.interval)
			expect(plan.trial_days).toBe(0)
			expect(plan.tax_behavior).toBe('inclusive')
			expect(planSeats(plan)).toBeGreaterThanOrEqual(1)
			expect(Object.keys(plan.grants).length).toBeGreaterThan(0)
			expect(plan.source.length).toBeGreaterThan(0)
			for (const currency of ['usd', 'gbp']) {
				const amount = plan.unit_amounts[currency]
				expect(amount, `${plan.plan_id} ${currency}`).toBeDefined()
				expect(Number.isInteger(amount)).toBe(true)
				expect(amount).toBeGreaterThan(0)
			}
		}
	})

	test('a yearly plan costs less than twelve monthly payments', () => {
		for (const plan of PLANS.filter((candidate) => candidate.interval === 'year')) {
			const monthly = planById(plan.plan_id.replace('_yearly', '_monthly'))
			expect(monthly, `${plan.plan_id} has no monthly sibling`).toBeDefined()
			for (const currency of ['usd', 'gbp']) {
				expect(plan.unit_amounts[currency]).toBeLessThan(monthly!.unit_amounts[currency] * 12)
			}
		}
	})

	test('the family prices are the only multi-seat ones', () => {
		const shared = PLANS.filter((plan) => planSeats(plan) > 1)
		expect(shared.length).toBe(2)
		for (const plan of shared) expect(planSeats(plan)).toBe(FAMILY_MAX_MEMBERS)
		expect(isFamilyProduct('puzzled_plus_family')).toBe(true)
		expect(isFamilyProduct('puzzled_plus')).toBe(false)
		expect(planCards('usd').filter((card) => card.family).length).toBe(2)
		expect(planCards('usd').filter((card) => !card.family).length).toBe(2)
	})

	test('features are declared with the prices that grant them', () => {
		expect(Object.keys(FEATURES)).toContain('plus')
		expect(Object.keys(FEATURES)).toContain('family')
		expect(Object.keys(FEATURES)).toContain('seats')
		for (const feature of Object.values(FEATURES)) {
			expect(['boolean', 'limit']).toContain(feature.kind)
			expect(feature.unlocks.length).toBeGreaterThan(0)
			expect(feature.gated_by.length).toBeGreaterThan(0)
			expect(feature.source.length).toBeGreaterThan(0)
		}
		// Every grant names a declared feature and carries the value its kind
		// promises: a boolean is 'true', the seats limit is a decimal string
		// (the shape Money's entitlement check answers in).
		for (const plan of PLANS) {
			expect(hasGrant(plan, 'plus')).toBe(true)
			expect(hasGrant(plan, 'family')).toBe(planSeats(plan) > 1)
			for (const [feature, value] of Object.entries(plan.grants)) {
				const declared = FEATURES[feature]
				expect(declared, `${plan.plan_id} grants undeclared ${feature}`).toBeDefined()
				if (declared.kind === 'boolean') expect(value, `${plan.plan_id} ${feature}`).toBe('true')
				else expect(value, `${plan.plan_id} ${feature}`).toMatch(/^\d+$/)
			}
			for (const implied of FEATURES.family.implies ?? []) {
				expect(hasGrant(plan, implied)).toBe(true)
			}
		}
		expect(FEATURES.family.implies).toContain('plus')
		// The seat count lives in the file's `seats` grant and nowhere else.
		expect(planSeats(planById('family_monthly')!)).toBe(FAMILY_MAX_MEMBERS)
		expect(FAMILY_MAX_MEMBERS).toBe(Number(planById('family_monthly')!.grants.seats))
		expect(planById('individual_monthly')!.grants.seats).toBe('1')
		expect(grantValue(planById('family_yearly')!, 'family')).toBe('true')
		expect(grantValue(planById('individual_monthly')!, 'family')).toBeUndefined()
		expect(FREE.purchasable).toBe(false)
		expect(POLICY.cancellation.days).toBe(CANCELLATION_DAYS)
	})

	test('prices come back out of the catalogue, not a copy of it', () => {
		for (const currency of ['usd', 'gbp']) {
			const cards = planCards(currency)
			expect(cards.map((card) => card.id)).toEqual(PLANS.map((plan) => plan.plan_id))
			for (const card of cards) {
				const plan = planById(card.id)!
				expect(card.amountMinor).toBe(plan.unit_amounts[currency])
				expect(card.priceKey).toBe(plan.price_key)
				expect(card.currency).toBe(currency)
				expect(plan.interval).toBe(card.interval)
				expect(card.family).toBe(hasGrant(plan, 'family'))
				expect(card.seats).toBe(planSeats(plan))
			}
		}
		// A currency the catalogue does not publish falls back to the base one.
		expect(priceFor({ usd: 1234 }, 'sek')).toEqual({ currency: 'usd', amountMinor: 1234 })
		expect(priceFor({}, 'usd')).toBeNull()
	})

	test('the locale picks the currency the catalogue maps it to', () => {
		expect(currencyForLocale('en-GB')).toBe('gbp')
		expect(currencyForLocale('en-gb')).toBe('gbp')
		expect(currencyForLocale('zh-HK')).toBe(currencyForLocale('en-US'))
	})

	test('the page shows the catalogue amounts in the shipped format', () => {
		const monthly = planById('individual_monthly')!
		expect(formatPrice(monthly.unit_amounts.usd, 'usd', 'en-US')).toBe('$4.99')
		expect(formatPrice(monthly.unit_amounts.gbp, 'gbp', 'en-GB')).toBe('£3.99')
	})

	test('every product, plan and free-tier name ships in every locale', () => {
		const names = [
			FREE.name,
			...PRODUCTS.map((product) => product.name),
			...PLANS.map((plan) => plan.name),
			...Object.values(FEATURES).map((feature) => feature.name),
		]
		for (const name of names) {
			for (const locale of LOCALES) {
				expect(name[locale], `${locale}: ${JSON.stringify(name)}`).toBeTruthy()
			}
		}
		// The page's eyebrow and the single-seat card are the same name.
		const individual = PRODUCTS.find((product) => !isFamilyProduct(product.id))!
		for (const locale of LOCALES) expect(brandName(locale)).toBe(individual.name[locale])
		expect(localizedName(individual.name, 'de-DE')).toBe(individual.name['en-US'])
	})

	test('the console plan names, still in i18n until cutover, match the catalogue', () => {
		// The settings page renders the plan name from the plan id it reads
		// back (`plus.subscription.plan.*`); the catalogue owns the same name.
		// When the console switches to the catalogue these keys go away.
		for (const locale of LOCALES) {
			for (const plan of PLANS) {
				expect(
					message(
						`apps/puzzled/src/messages/${locale}/plus.json`,
						`subscription.plan.${plan.plan_id}`,
					),
					`${locale} ${plan.plan_id}`,
				).toBe(plan.name[locale])
			}
		}
	})

	test('the terms link names a section the legal text has', () => {
		const url = new URL(POLICY.terms_url)
		expect(url.origin).toBe('https://puzzled.gg')
		const anchor = url.hash.slice(1)
		expect(`${url.pathname}#${anchor}`).toBe(TERMS_PATH)
		const terms = JSON.parse(read('apps/puzzled/src/messages/en-US/legal.json')).terms
		expect(Object.keys(terms.sections)).toContain(anchor)
	})

	test('the pricing page reads its amounts, names, seats and terms from the catalogue', () => {
		const page = read('apps/puzzled/src/app/[locale]/(main)/pricing/page.tsx')
		expect(page).toContain("from '@/lib/billing/catalogue'")
		expect(page).toContain('planCards(currency)')
		expect(page).toContain('href={TERMS_PATH}')
		expect(page).toContain('localizedName(product.name, locale)')
		expect(page).toContain('localizedName(FREE.name, locale)')
		// Names, seats and the cancellation window have one home: the file.
		expect(page).not.toMatch(/\?\?\s*\d+/)
		// The seat count has one home as well: the page passes the catalogue's
		// family seat count into the copy instead of writing a number.
		expect(page).toContain('FAMILY_MAX_MEMBERS')
		expect(page).not.toMatch(/count:\s*\d/)
		expect(page).not.toContain('plans.plans')
		expect(page).not.toContain('tPlus(')
		expect(page).not.toContain("t('freeTitle')")
		expect(page).not.toContain("t('family')")
	})

	test('the names the page now owns are gone from i18n', () => {
		for (const locale of LOCALES) {
			const path = `apps/puzzled/src/messages/${locale}/plus.json`
			expect(message(path, 'name')).toBeUndefined()
			expect(message(path, 'pricing.freeTitle')).toBeUndefined()
			expect(message(path, 'pricing.family')).toBeUndefined()
		}
	})

	test('no price literal is written outside the catalogue', () => {
		const amounts = new Set<number>()
		for (const plan of PLANS) {
			for (const amount of Object.values(plan.unit_amounts)) amounts.add(amount)
		}
		const formatted = new Set<string>()
		for (const amount of amounts) {
			const major = (amount / 100).toFixed(2).replace('.', '\\.')
			for (const currency of ['usd', 'gbp']) {
				const symbol = currency === 'usd' ? '\\$' : '£'
				formatted.add(`${symbol}\\s?${major}`)
				formatted.add(`US\\$\\s?${major}`)
			}
			formatted.add(`${major}\\s?(USD|GBP)`)
		}
		const patterns = [
			new RegExp([...formatted].join('|')),
			new RegExp(`\\b(${[...amounts].join('|')})\\b`),
		]
		// SVG path data (the brand mark's outline) is geometry: a coordinate
		// that happens to equal an amount is not a price.
		const PATH_DATA =
			/"[^"]*[MmLlHhVvCcSsQqTtAaZz][-\d][^"]*"|'[^']*[MmLlHhVvCcSsQqTtAaZz][-\d][^']*'/g

		const found: string[] = []
		for (const path of SCAN_ROOTS.flatMap(sourceFiles)) {
			for (const line of read(path).split('\n')) {
				for (const pattern of patterns) {
					const match = line.replace(PATH_DATA, '').match(pattern)
					if (match) found.push(`${relative(root, join(root, path))}: ${match[0]}`)
				}
			}
		}
		expect(found, `prices live only in ${CATALOGUE_PATH}; found: ${found.join(', ')}`).toEqual([])
	})
})
