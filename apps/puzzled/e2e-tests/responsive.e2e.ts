import { expect, test } from '@playwright/test'
import { settle, targetOffenders } from './a11y-support'

/**
 * Responsive Design E2E Tests
 *
 * Verifies across mobile (375x667), tablet (768x1024) and desktop (1280x720):
 * - no horizontal overflow on any audited route,
 * - the shell switches from bottom navigation to top navigation,
 * - shell navigation keeps the 44px target size at every width,
 * - forms and game pages fit the viewport.
 *
 * The English routes are unprefixed (`/`), the locale prefix is only added for
 * non-default locales (see `src/lib/i18n/routing.ts`).
 */

const VIEWPORTS = [
	{ name: 'mobile', width: 375, height: 667 },
	{ name: 'tablet', width: 768, height: 1024 },
	{ name: 'desktop', width: 1280, height: 720 },
]

const PAGES = [
	{ path: '/', name: 'Home Page' },
	{ path: '/games', name: 'Catalog Page' },
	{ path: '/pricing', name: 'Pricing Page' },
	{ path: '/login', name: 'Login Page' },
	{ path: '/signup', name: 'Signup Page' },
	{ path: '/stats', name: 'Stats Page' },
	{ path: '/leaderboard', name: 'Leaderboard Page' },
	{ path: '/support', name: 'Support Page' },
	{ path: '/privacy', name: 'Privacy Page' },
	{ path: '/terms', name: 'Terms Page' },
]

async function hasHorizontalOverflow(page: import('@playwright/test').Page) {
	return page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
}

test.describe('Responsive Design - Core Pages', () => {
	for (const { path, name } of PAGES) {
		test.describe(name, () => {
			for (const viewport of VIEWPORTS) {
				test(`renders without horizontal overflow on ${viewport.name}`, async ({ page }) => {
					await page.setViewportSize({ width: viewport.width, height: viewport.height })
					await page.goto(path, { waitUntil: 'domcontentloaded' })
					await settle(page)

					expect(await hasHorizontalOverflow(page), `${name} overflows at ${viewport.name}`).toBe(
						false,
					)
				})
			}
		})
	}
})

test.describe('Responsive Design - Shell navigation', () => {
	test('shows the bottom navigation on mobile and hides it on desktop', async ({ page }) => {
		const bottomNav = page.locator('nav[aria-label]').filter({ has: page.locator('a[href="/"]') })

		await page.setViewportSize({ width: 375, height: 667 })
		await page.goto('/', { waitUntil: 'domcontentloaded' })
		await settle(page)
		await expect(bottomNav.last()).toBeVisible()

		await page.setViewportSize({ width: 1280, height: 720 })
		await page.goto('/', { waitUntil: 'domcontentloaded' })
		await settle(page)
		await expect(bottomNav.last()).toBeHidden()
	})

	test('keeps shell navigation at the 44px company target on every width', async ({ page }) => {
		for (const viewport of VIEWPORTS) {
			await page.setViewportSize({ width: viewport.width, height: viewport.height })
			await page.goto('/', { waitUntil: 'domcontentloaded' })
			await settle(page)

			const offenders = await targetOffenders(
				page,
				'header a[href], header button, nav[aria-label] a[href], nav[aria-label] button',
			)
			expect(
				offenders,
				`${viewport.name}: ${offenders
					.map((entry) => `${entry.width}x${entry.height} "${entry.name}"`)
					.join(', ')}`,
			).toEqual([])
		}
	})
})

test.describe('Responsive Design - Game pages', () => {
	const GAMES = ['word-guess', 'word-groups', 'sudoku']

	for (const game of GAMES) {
		test(`${game} renders without horizontal overflow at every width`, async ({ page }) => {
			const overflowing: string[] = []

			for (const viewport of VIEWPORTS) {
				await page.setViewportSize({ width: viewport.width, height: viewport.height })
				await page.goto(`/games/${game}`, { waitUntil: 'domcontentloaded' })
				await settle(page)

				expect(await page.locator('h1').count(), `${game} renders a heading`).toBeGreaterThan(0)
				if (await hasHorizontalOverflow(page)) overflowing.push(viewport.name)
			}

			expect(overflowing, `${game} overflows on: ${overflowing.join(', ')}`).toEqual([])
		})
	}
})

test.describe('Responsive Design - Forms', () => {
	for (const path of ['/login', '/signup']) {
		test(`${path} fits every viewport`, async ({ page }) => {
			for (const viewport of VIEWPORTS) {
				await page.setViewportSize({ width: viewport.width, height: viewport.height })
				await page.goto(path, { waitUntil: 'domcontentloaded' })
				await page.waitForSelector('form', { timeout: 10000 })

				expect(await hasHorizontalOverflow(page), `${path} overflows at ${viewport.name}`).toBe(
					false,
				)

				for (const input of await page.locator('input').all()) {
					if (!(await input.isVisible())) continue
					const box = await input.boundingBox()
					if (!box) continue
					expect(
						box.x + box.width,
						`${path} input overflows at ${viewport.name}`,
					).toBeLessThanOrEqual(viewport.width)
				}
			}
		})
	}
})
