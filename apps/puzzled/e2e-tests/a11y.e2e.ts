import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, type TestInfo, test } from '@playwright/test'
import { settle } from './a11y-support'

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

/**
 * A finding this branch routes to the workstream owning the page file.
 *
 * The allowance is node-scoped on purpose: `selector` must still match, so a new
 * violation inside the shared shell — or one that moved to another element —
 * fails even when its rule id is listed here.
 */
type OwnedFinding = {
	rule: string
	/** Substring at least one reported node target must contain. */
	selector: string
	/** File (and workstream) that must close it. */
	owner: string
}

type PageCase = {
	name: string
	path: string
	/** Rendered by the shared shell (top nav, bottom nav, footer). */
	shell: boolean
	/** Findings a parallel workstream still owns on this route. */
	owned?: readonly OwnedFinding[]
}

const PAGES: readonly PageCase[] = [
	{ name: 'home', path: '/', shell: true },
	{ name: 'games', path: '/games', shell: true },
	{
		name: 'sudoku',
		path: '/games/sudoku',
		shell: true,
		owned: [
			{
				rule: 'color-contrast',
				selector: 'difficulty',
				owner:
					'difficulty badge tints + the "Status unknown" link name: app/[locale]/(main)/games/[slug]/difficulty-selection-view.tsx, features/daily/components/difficulty-selector.tsx (PR #147)',
			},
		],
	},
	{ name: 'word-guess', path: '/games/word-guess', shell: true },
	{
		name: 'pricing',
		path: '/pricing',
		shell: true,
		owned: [
			{
				rule: 'color-contrast',
				selector: 'pricing-client',
				owner:
					'plan ribbon + badge tints: app/[locale]/(main)/pricing/pricing-client.tsx (PR #146)',
			},
			{
				rule: 'heading-order',
				selector: 'h3',
				owner: 'plan card titles: app/[locale]/(main)/pricing/pricing-client.tsx (PR #146)',
			},
		],
	},
	{
		name: 'login',
		path: '/login',
		shell: false,
		owned: [
			{
				rule: 'button-name',
				selector: 'button',
				owner: 'app/[locale]/(auth)/_components/auth-fields.tsx (fixed in PR #145)',
			},
			{
				rule: 'landmark-one-main',
				selector: 'html',
				owner: 'app/[locale]/(auth)/_components/auth-shell.tsx (fixed in PR #145)',
			},
			{ rule: 'region', selector: 'main', owner: 'auth shell regions (fixed in PR #145)' },
		],
	},
	{
		name: 'signup',
		path: '/signup',
		shell: false,
		owned: [
			{
				rule: 'button-name',
				selector: 'button',
				owner: 'app/[locale]/(auth)/_components/auth-fields.tsx (fixed in PR #145)',
			},
			{
				rule: 'landmark-one-main',
				selector: 'html',
				owner: 'app/[locale]/(auth)/_components/auth-shell.tsx (fixed in PR #145)',
			},
			{
				rule: 'link-in-text-block',
				selector: 'signup-form',
				owner: 'app/[locale]/(auth)/signup/signup-form.tsx (PR #145)',
			},
			{ rule: 'region', selector: 'main', owner: 'auth shell regions (fixed in PR #145)' },
		],
	},
	{ name: 'stats', path: '/stats', shell: true },
	{ name: 'leaderboard', path: '/leaderboard', shell: true },
	{
		name: 'support',
		path: '/support',
		shell: true,
		owned: [
			{
				rule: 'heading-order',
				selector: 'h2',
				owner: 'FAQ headings: app/[locale]/(main)/support/page.tsx (PR #146)',
			},
			{
				rule: 'landmark-no-duplicate-contentinfo',
				selector: 'footer',
				owner: 'page-local footer: app/[locale]/(main)/support/page.tsx (PR #146)',
			},
			{
				rule: 'landmark-unique',
				selector: 'footer',
				owner: 'page-local footer: app/[locale]/(main)/support/page.tsx (PR #146)',
			},
		],
	},
	{
		name: 'settings',
		path: '/settings',
		shell: false,
		owned: [
			{
				rule: 'button-name',
				selector: 'button',
				owner: 'app/[locale]/(auth)/_components/auth-fields.tsx (fixed in PR #145)',
			},
			{ rule: 'landmark-one-main', selector: 'html', owner: 'console shell (fixed in PR #145)' },
			{ rule: 'region', selector: 'main', owner: 'console shell regions (fixed in PR #145)' },
		],
	},
	{
		name: 'privacy',
		path: '/privacy',
		shell: true,
		owned: [
			{
				rule: 'landmark-one-main',
				selector: 'html',
				owner: 'app/[locale]/(main)/privacy/page.tsx (PR #146)',
			},
			{
				rule: 'region',
				selector: 'main-content',
				owner: 'app/[locale]/(main)/privacy/page.tsx (PR #146)',
			},
		],
	},
	{
		name: 'terms',
		path: '/terms',
		shell: true,
		owned: [
			{
				rule: 'landmark-one-main',
				selector: 'html',
				owner: 'app/[locale]/(main)/terms/page.tsx (PR #146)',
			},
			{
				rule: 'region',
				selector: 'main-content',
				owner: 'app/[locale]/(main)/terms/page.tsx (PR #146)',
			},
		],
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
				await page.goto(pageCase.path, { waitUntil: 'domcontentloaded' })
				await settle(page)

				const results = await auditPage(page, testInfo)
				const owned = pageCase.owned ?? []

				// Allow only the exact nodes a routed finding explains: the rule id
				// must match AND the node target must still look like the element the
				// routing table names, so a new violation inside the shared shell —
				// or one that moved to another element — still fails.
				const unexpected = results.violations
					.map((violation) => {
						const allowances = owned.filter((finding) => finding.rule === violation.id)
						if (allowances.length === 0) return violation
						const nodes = violation.nodes.filter(
							(node) =>
								!allowances.some((finding) => node.target.join(' ').includes(finding.selector)),
						)
						return nodes.length === 0 ? null : { ...violation, nodes }
					})
					.filter((violation) => violation !== null)

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
	// Both widths: the page-local mobile bar is `display:none` at 1440px, so a
	// duplicate banner can only show up at 390px.
	for (const mode of MODES) {
		test(`${mode.name}: at most one banner and one main landmark per route`, async ({ page }) => {
			await page.setViewportSize(mode.viewport)

			for (const pageCase of PAGES) {
				await page.goto(pageCase.path, { waitUntil: 'domcontentloaded' })
				await settle(page)

				const counts = await page.evaluate(() => ({
					banners: document.querySelectorAll('header, [role="banner"]').length,
					mains: document.querySelectorAll('main, [role="main"]').length,
				}))

				const where = `${pageCase.name} (${mode.name})`
				expect(counts.banners, `${where}: more than one banner landmark`).toBeLessThanOrEqual(1)
				expect(counts.mains, `${where}: more than one main landmark`).toBeLessThanOrEqual(1)

				if (pageCase.shell) {
					expect(counts.banners, `${where}: shell routes render exactly one banner`).toBe(1)
				}
			}
		})
	}

	test('every shell route exposes one skip link that targets the main region', async ({ page }) => {
		for (const pageCase of PAGES.filter((candidate) => candidate.shell)) {
			await page.goto(pageCase.path, { waitUntil: 'domcontentloaded' })
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
		await page.goto('/zh-HK', { waitUntil: 'domcontentloaded' })
		await settle(page)

		expect(page.url()).not.toContain('/zh-HK/zh-HK')
		expect(await page.locator('html').getAttribute('lang')).toBe('zh-HK')
		await expect(page.locator('main')).toBeVisible()
		await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

		const results = await auditPage(page, testInfo)
		expect(results.violations, describeViolations(results.violations)).toEqual([])
	})

	test('en-GB root renders with a matching document language', async ({ page }, testInfo) => {
		await page.goto('/en-GB', { waitUntil: 'domcontentloaded' })
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
		await page.goto('/games/sudoku', { waitUntil: 'domcontentloaded' })
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
