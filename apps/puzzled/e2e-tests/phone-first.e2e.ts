import { devices, expect, test } from '@playwright/test'

test.use({ ...devices['iPhone 13'] })
test.describe.configure({ retries: 0 })

for (const viewport of [
	{ width: 390, height: 844 },
	{ width: 360, height: 640 },
]) {
	test(`first visit keeps the whole puzzle and Play above the consent bar at ${viewport.width}x${viewport.height}`, async ({
		page,
	}) => {
		// The served build is plain HTTP on loopback, where this spec's WebKit
		// would upgrade the build's own assets under `upgrade-insecure-requests`.
		// Drop only that directive from the document; every other directive stays.
		await page.route('**/*', async (route) => {
			if (route.request().resourceType() !== 'document') return route.continue()
			const response = await route.fetch({ maxRedirects: 0 })
			const headers = response.headers()
			const csp = headers['content-security-policy']
			if (csp) {
				headers['content-security-policy'] = csp
					.split(';')
					.filter((directive) => directive.trim() !== 'upgrade-insecure-requests')
					.join(';')
			}
			return route.fulfill({ response, headers })
		})
		await page.setViewportSize(viewport)
		await page.goto('/')
		const card = page.locator('[data-day-puzzle-card]')
		const play = page.locator('[data-day-primary-action]')
		const consent = page.locator('[data-consent-banner]')
		await expect(card).toHaveCount(1)
		await expect(play).toHaveCount(1)
		await expect(consent).toHaveCount(1)
		await expect(play).toBeVisible()
		await expect(consent.getByRole('button', { name: 'Decline', exact: true })).toBeVisible()
		const geometry = await page.evaluate(() => {
			const bounds = (selector: string) => {
				const node = document.querySelector(selector)!
				const r = node.getBoundingClientRect()
				return { top: r.top, bottom: r.bottom, height: r.height }
			}
			const action = document.querySelector('[data-day-primary-action]')!
			const r = action.getBoundingClientRect()
			return {
				cardDocTop:
					document.querySelector('[data-day-puzzle-card]')!.getBoundingClientRect().top +
					window.scrollY,
				card: bounds('[data-day-puzzle-card]'),
				play: bounds('[data-day-primary-action]'),
				consent: bounds('[data-consent-banner]'),
				nav: bounds('nav.fixed[aria-label="Main navigation"]'),
				hit: action.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)),
			}
		})
		// The consent bar sits at the bottom, above the tab bar, and below the
		// whole featured card: it never covers the puzzle or Play.
		expect(geometry.card.bottom).toBeLessThanOrEqual(geometry.consent.top)
		expect(geometry.consent.bottom).toBeLessThanOrEqual(geometry.nav.top + 1)
		expect(geometry.play.height).toBeGreaterThanOrEqual(48)
		expect(geometry.hit).toBe(true)
		await expect(play).toHaveAttribute('href', /start=1#play$/)
		await consent.getByRole('button', { name: 'Decline', exact: true }).click()
		await expect(consent).toBeHidden()
		await expect(play).toBeVisible()
		// Deciding moves nothing in the layout: the bar never pushed the hero down.
		// (Compared in document coordinates: pressing a sticky button may scroll.)
		const after = await card.evaluate((el) => el.getBoundingClientRect().top + window.scrollY)
		expect(after).toBeCloseTo(geometry.cardDocTop, 0)
	})
}
