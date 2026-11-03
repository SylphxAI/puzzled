import { expect, test } from '@playwright/test'

test('navigation offline shows the branded fallback and retry recovers the original URL', async ({
	page,
	context,
}) => {
	await page.goto('/')
	await page.evaluate(async () => {
		await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })
		await navigator.serviceWorker.ready
		if (!navigator.serviceWorker.controller) {
			await new Promise<void>((resolve) =>
				navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), {
					once: true,
				}),
			)
		}
	})
	await context.setOffline(true)
	await page.goto('/games/sudoku?offline-check=1')
	await expect(page.getByRole('heading', { name: "You're offline" })).toBeVisible()
	await expect(
		page.getByText('Puzzled needs an internet connection', { exact: false }),
	).toBeVisible()
	await expect(page.getByRole('img', { name: 'Puzzled' })).toBeVisible()
	await page.getByRole('link', { name: 'Try again' }).click()
	await expect(page.getByRole('heading', { name: "You're offline" })).toBeVisible()
	await expect(page).toHaveURL(/\/games\/sudoku\?offline-check=1$/)
	const cached = await page.evaluate(async () => {
		const cache = await caches.open('puzzled-offline-v1')
		return (await cache.keys()).map((request) => new URL(request.url).pathname)
	})
	expect(cached).toEqual(['/offline.html'])
	await context.setOffline(false)
	await page.getByRole('link', { name: 'Try again' }).click()
	await expect(page.getByRole('heading', { name: "You're offline" })).toHaveCount(0)
	await expect(page).toHaveURL(/\/games\/sudoku\?offline-check=1$/)
})
