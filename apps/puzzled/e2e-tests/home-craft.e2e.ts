import { expect, test } from '@playwright/test'
import { settle } from './a11y-support'

for (const viewport of [
	{ width: 1440, height: 900 },
	{ width: 768, height: 1024 },
	{ width: 390, height: 844 },
	{ width: 375, height: 667 },
]) {
	test(`home craft at ${viewport.width}x${viewport.height}`, async ({ page }, info) => {
		await page.setViewportSize(viewport)
		await page.goto('/')
		await expect(page.locator('[data-day-primary-action]')).toBeVisible()
		await settle(page)
		for (const consentState of ['open', 'dismissed']) {
			if (consentState === 'dismissed') {
				await page.getByRole('button', { name: 'Decline', exact: true }).click()
			}
			await page.evaluate(() => window.scrollTo(0, 0))
			await page.screenshot({
				path: info.outputPath(`${consentState}-initial.jpg`),
				type: 'jpeg',
				quality: 55,
				fullPage: false,
			})
			expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
				viewport.width,
			)
			const action = page.locator('[data-day-primary-action]')
			await action.evaluate((el) => el.scrollIntoView({ block: 'center' }))
			await expect(action).toBeInViewport({ ratio: 1 })
			await action.click({ trial: true })
			expect((await action.boundingBox())!.height).toBeGreaterThanOrEqual(48)
			await page.screenshot({
				path: info.outputPath(`${consentState}-play.jpg`),
				type: 'jpeg',
				quality: 55,
				fullPage: false,
			})
		}
	})
}

test('Chinese display type and reduced motion remain readable', async ({ page }, info) => {
	await page.setViewportSize({ width: 390, height: 844 })
	await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' })
	await page.goto('/zh-CN')
	const title = page.locator('.home-day-grid h1')
	await expect(title).toBeVisible()
	await settle(page)
	for (const selector of ['.home-day-grid h1', '.home-featured-title']) {
		const type = await page.locator(selector).evaluate((el) => {
			const style = getComputedStyle(el)
			return {
				tracking: style.letterSpacing,
				ratio: Number.parseFloat(style.lineHeight) / Number.parseFloat(style.fontSize),
			}
		})
		expect(type.tracking).toBe('0px')
		expect(type.ratio).toBeGreaterThanOrEqual(1.29)
	}
	const card = page.locator('.home-featured-card')
	await card.hover()
	await expect(card).toHaveCSS('transform', 'none')
	await page.screenshot({
		path: info.outputPath('chinese-dark-reduced-motion.jpg'),
		type: 'jpeg',
		quality: 55,
		fullPage: false,
	})
})
