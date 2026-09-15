import { expect, test } from '@playwright/test'
import { MOBILE, settle, targetOffenders } from './a11y-support'

/**
 * Responsive UI tests for every module in the game catalog.
 *
 * The slug list is read from the catalog page itself instead of being
 * hand-maintained here: the previous hardcoded list still named modules that no
 * longer exist (`wordle`, `connections`, …) and pointed at the removed `/en`
 * locale prefix, so the suite passed without testing anything.
 *
 * Coverage: every catalog module once on mobile (the narrowest supported width),
 * plus three representative modules at tablet and desktop widths.
 */

const VIEWPORTS = [
	{ name: 'mobile', width: 375, height: 667 },
	{ name: 'tablet', width: 768, height: 1024 },
	{ name: 'desktop', width: 1280, height: 720 },
]

const REPRESENTATIVE = ['word-guess', 'word-groups', 'sudoku']

async function catalogSlugs(page: import('@playwright/test').Page) {
	await page.goto('/games')
	await settle(page)

	const hrefs = await page
		.locator('a[href^="/games/"]')
		.evaluateAll((links) => links.map((link) => link.getAttribute('href') ?? ''))

	return Array.from(
		new Set(
			hrefs
				.map((href) => href.split('?')[0].replace('/games/', '').split('/')[0])
				.filter((slug) => slug.length > 0),
		),
	).sort()
}

async function hasHorizontalOverflow(page: import('@playwright/test').Page) {
	return page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
}

test.describe('Game catalog responsiveness', () => {
	test('every module in the catalog renders without horizontal overflow', async ({ page }) => {
		const slugs = await catalogSlugs(page)
		expect(slugs.length, 'catalog exposes game modules').toBeGreaterThan(5)

		const failures: string[] = []
		for (const slug of slugs) {
			await page.setViewportSize({ width: MOBILE.width, height: MOBILE.height })
			await page.goto(`/games/${slug}`)
			await settle(page)

			if ((await page.locator('h1').count()) === 0) failures.push(`${slug}: no heading`)
			if (await hasHorizontalOverflow(page)) failures.push(`${slug}: horizontal overflow`)
		}

		expect(failures, `catalog modules failing on mobile: ${failures.join(', ')}`).toEqual([])
	})

	for (const slug of REPRESENTATIVE) {
		test(`${slug} renders and keeps board controls at 44px on every width`, async ({ page }) => {
			for (const viewport of VIEWPORTS) {
				await page.setViewportSize({ width: viewport.width, height: viewport.height })
				await page.goto(`/games/${slug}`)
				await settle(page)

				expect(
					await page.locator('h1').count(),
					`${slug} heading at ${viewport.name}`,
				).toBeGreaterThan(0)
				expect(await hasHorizontalOverflow(page), `${slug} overflow at ${viewport.name}`).toBe(
					false,
				)

				const offenders = await targetOffenders(
					page,
					'main button, main a[href], main [role="button"]',
				).catch(() => [])
				expect(
					offenders,
					`${slug} at ${viewport.name}: ${offenders
						.map((entry) => `${entry.width}x${entry.height} "${entry.name}"`)
						.join(', ')}`,
				).toEqual([])
			}
		})
	}
})
