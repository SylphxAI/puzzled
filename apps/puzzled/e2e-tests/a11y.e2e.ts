import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, type TestInfo, test } from '@playwright/test'

/**
 * WCAG 2.2 A/AA conformance gate for the Puzzled web app.
 *
 * Covers the audited surfaces (`.scratch/puzzled-recon/a11y.md`) at desktop and
 * mobile widths in light and dark themes, the localised roots, the sudoku board
 * once a puzzle is on screen, and the shared-shell invariants that must hold on
 * every route.
 *
 * The rule set is exactly the WCAG 2.2 A/AA tag set the product claims: no
 * best-practice or experimental rules, so a pass means "no WCAG 2.2 A/AA
 * violation axe can see", not "no accessibility work left".
 *
 * Known page-owned findings: this branch owns `apps/puzzled/src/shared/**`,
 * `packages/ui/**`, `apps/puzzled/src/games/**` and `globals.css`. Findings that
 * live in page files owned by the parallel workstreams are listed per route in
 * `owned` with the file that must close them and the owning PR recorded in the
 * PR body. Anything not listed must stay clean, so the shared shell and every
 * already-fixed page are regression-proof.
 */

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa']

type PageCase = {
	name: string
	path: string
	/** Rendered by the shared shell (top nav, bottom nav, footer). */
	shell: boolean
	/** axe rule ids a parallel workstream still owns on this route. */
	owned?: readonly string[]
	/** File that must close the owned rules. */
	owner?: string
}

const PAGES: readonly PageCase[] = [
	{ name: 'home', path: '/', shell: true },
	{ name: 'games', path: '/games', shell: true },
	{
		name: 'sudoku',
		path: '/games/sudoku',
		shell: true,
		owned: ['color-contrast'],
		owner:
			'difficulty badge tints in app/[locale]/(main)/games/[slug]/difficulty-selection-view.tsx and features/daily/components/difficulty-selector.tsx',
	},
	{ name: 'word-guess', path: '/games/word-guess', shell: true },
	{
		name: 'pricing',
		path: '/pricing',
		shell: true,
		owned: ['color-contrast', 'heading-order'],
		owner: 'app/[locale]/(main)/pricing/pricing-client.tsx',
	},
	{
		name: 'login',
		path: '/login',
		shell: false,
		owned: ['button-name', 'landmark-one-main', 'region'],
		owner: 'app/[locale]/(auth)/login/login-form.tsx, app/[locale]/(auth)/layout.tsx',
	},
	{
		name: 'signup',
		path: '/signup',
		shell: false,
		owned: ['button-name', 'landmark-one-main', 'link-in-text-block', 'region'],
		owner: 'app/[locale]/(auth)/signup/signup-form.tsx',
	},
	{ name: 'stats', path: '/stats', shell: true },
	{ name: 'leaderboard', path: '/leaderboard', shell: true },
	{
		name: 'support',
		path: '/support',
		shell: true,
		owned: ['heading-order', 'landmark-no-duplicate-contentinfo', 'landmark-unique'],
		owner: 'app/[locale]/(main)/support/page.tsx',
	},
	{
		name: 'settings',
		path: '/settings',
		shell: false,
		owned: ['button-name', 'landmark-one-main', 'region'],
		owner: 'app/[locale]/(main)/settings/**',
	},
	{
		name: 'privacy',
		path: '/privacy',
		shell: true,
		owned: ['landmark-one-main', 'region'],
		owner: 'app/[locale]/(main)/privacy/page.tsx',
	},
	{
		name: 'terms',
		path: '/terms',
		shell: true,
		owned: ['landmark-one-main', 'region'],
		owner: 'app/[locale]/(main)/terms/page.tsx',
	},
	{ name: 'challenge', path: '/challenge', shell: true },
]

export const MODES = [
	{ name: 'desktop-light', viewport: { width: 1440, height: 900 }, colorScheme: 'light' },
	{ name: 'desktop-dark', viewport: { width: 1440, height: 900 }, colorScheme: 'dark' },
	{ name: 'mobile-light', viewport: { width: 390, height: 844 }, colorScheme: 'light' },
	{ name: 'mobile-dark', viewport: { width: 390, height: 844 }, colorScheme: 'dark' },
] as const

export function describeViolations(
	violations: Awaited<ReturnType<AxeBuilder['analyze']>>['violations'],
) {
	return violations
		.map((violation) => {
			const nodes = violation.nodes.map((node) => `      ${node.target.join(' ')}`).join('\n')
			return `  [${violation.impact ?? 'unknown'}] ${violation.id}: ${violation.help}\n${nodes}`
		})
		.join('\n')
}

export async function auditPage(page: Page, testInfo: TestInfo) {
	const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze()
	await testInfo.attach(`axe-${results.testEngine.version}.json`, {
		body: JSON.stringify(results.violations, null, 2),
		contentType: 'application/json',
	})
	return results
}

for (const mode of MODES) {
	test.describe(`WCAG 2.2 A/AA — ${mode.name}`, () => {
		test.use({ viewport: mode.viewport, colorScheme: mode.colorScheme })

		for (const pageCase of PAGES) {
			test(`${pageCase.name} (${pageCase.path})`, async ({ page }, testInfo) => {
				await page.goto(pageCase.path)
				await settle(page)

				const results = await auditPage(page, testInfo)
				const owned = pageCase.owned ?? []
				const unexpected = results.violations.filter((violation) => !owned.includes(violation.id))

				expect(
					unexpected,
					`${pageCase.name} (${mode.name}) has unexpected WCAG 2.2 A/AA violations.\n${describeViolations(
						unexpected,
					)}`,
				).toEqual([])
			})
		}
	})
}

test.describe('Shared shell invariants', () => {
	test.use({ viewport: MODES[0].viewport, colorScheme: 'light' })

	for (const pageCase of PAGES) {
		test(`${pageCase.name} has at most one banner and one main landmark`, async ({ page }) => {
			await page.goto(pageCase.path)
			await settle(page)

			const counts = await page.evaluate(() => ({
				banners: document.querySelectorAll('header, [role="banner"]').length,
				mains: document.querySelectorAll('main, [role="main"]').length,
			}))

			expect(counts.banners, `${pageCase.name}: more than one banner landmark`).toBeLessThanOrEqual(
				1,
			)
			expect(counts.mains, `${pageCase.name}: more than one main landmark`).toBeLessThanOrEqual(1)

			if (pageCase.shell) {
				expect(counts.banners, `${pageCase.name}: shell routes render exactly one banner`).toBe(1)
			}
		})
	}

	test('every shell route exposes one skip link that targets the main region', async ({ page }) => {
		for (const pageCase of PAGES.filter((candidate) => candidate.shell)) {
			await page.goto(pageCase.path)
			await settle(page)

			expect(
				await page.locator('a[href="#main-content"]').count(),
				`${pageCase.name}: skip link`,
			).toBe(1)
			expect(await page.locator('#main-content').count(), `${pageCase.name}: #main-content`).toBe(1)
		}
	})
})

test.describe('Localised routes', () => {
	test('zh-HK root renders with a matching document language', async ({ page }, testInfo) => {
		await page.goto('/zh-HK')
		await settle(page)

		expect(page.url()).not.toContain('/zh-HK/zh-HK')
		expect(await page.locator('html').getAttribute('lang')).toBe('zh-HK')
		await expect(page.locator('main')).toBeVisible()
		await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

		const results = await auditPage(page, testInfo)
		expect(results.violations, describeViolations(results.violations)).toEqual([])
	})

	test('en-GB root renders with a matching document language', async ({ page }, testInfo) => {
		await page.goto('/en-GB')
		await settle(page)

		expect(await page.locator('html').getAttribute('lang')).toBe('en-GB')
		await expect(page.locator('main')).toBeVisible()

		const results = await auditPage(page, testInfo)
		expect(results.violations, describeViolations(results.violations)).toEqual([])
	})
})

test.describe('Game board once a puzzle is on screen', () => {
	test.use({ viewport: MODES[2].viewport, colorScheme: 'light' })

	test('sudoku board names every cell and stays free of WCAG 2.2 A/AA violations', async ({
		page,
	}, testInfo) => {
		await page.goto('/games/sudoku')
		await settle(page)

		// Free-today module: the picker links straight into a puzzle.
		await page.getByRole('link', { name: /easy/i }).first().click()
		await settle(page)

		const board = page.getByRole('group', { name: 'Sudoku' })
		await expect(board).toBeVisible()
		await expect(board.getByRole('button', { name: 'Row 1, Column 1' })).toBeVisible()

		const unnamed = await board.evaluate(
			(group) =>
				Array.from(group.querySelectorAll('button')).filter(
					(cell) => !(cell.getAttribute('aria-label') ?? '').trim(),
				).length,
		)
		expect(unnamed, 'sudoku cells without an accessible name').toBe(0)

		const results = await auditPage(page, testInfo)
		expect(results.violations, describeViolations(results.violations)).toEqual([])
	})
})
